import { FeeModel } from "../../../infrastructure/database/models/Fee.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { NotFoundError, BadRequestError } from "../../../shared/errors/AppError";
import { schedulerService } from "../../../infrastructure/services/SchedulerService";
import { notificationService } from "../../../infrastructure/services/NotificationService";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { cloudinaryService } from "../../../infrastructure/services/CloudinaryService";
import { generateReceiptPdf } from "../../../shared/utils/receiptGenerator";
import { logger } from "../../../shared/utils/logger";

export interface CreateFeeInput {
  studentId: string;
  franchiseId: string;
  feeType: "one_time" | "installment" | "early_bird";
  totalAmount: number;
  discount?: number;
  promoCode?: string;
  installments: { installmentNumber: number; amount: number; dueDate: string }[];
  notes?: string;
}

export interface RecordPaymentInput {
  amount: number;
  paymentMethod?: string;
  transactionId?: string;
}

function computeOverallStatus(installments: { status: string }[]): string {
  if (installments.every((i) => i.status === "paid")) return "paid";
  if (installments.some((i) => i.status === "overdue")) return "overdue";
  if (installments.some((i) => i.status === "partial" || i.status === "paid")) return "partial";
  return "pending";
}

export class AdminFeesUseCases {
  async createFee(input: CreateFeeInput, createdBy: string) {
    const discount = input.discount ?? 0;
    const finalAmount = input.totalAmount - discount;

    const fee = await FeeModel.create({
      studentId: input.studentId,
      franchiseId: input.franchiseId,
      feeType: input.feeType,
      totalAmount: input.totalAmount,
      discount,
      promoCode: input.promoCode,
      finalAmount,
      notes: input.notes,
      createdBy,
      installments: input.installments.map((i) => ({
        installmentNumber: i.installmentNumber,
        amount: i.amount,
        dueDate: new Date(i.dueDate),
        paidAmount: 0,
        status: "pending",
        reminderSentCount: 0,
      })),
    });

    // Schedule installment reminders asynchronously in the background so fee creation returns immediately
    this.scheduleInstallmentReminders(fee).catch((err) => {
      logger.error(`[AdminFeesUseCases] Background reminder scheduling failed for fee ${fee._id}:`, err);
    });

    return fee.toJSON ? fee.toJSON() : fee;
  }

  async listFees(franchiseId: string, filters: { studentId?: string; status?: string } = {}) {
    const query: Record<string, unknown> = { franchiseId };
    if (filters.studentId) query.studentId = filters.studentId;
    if (filters.status) query.overallStatus = filters.status;

    return FeeModel.find(query)
      .populate("studentId", "firstName lastName photo")
      .sort({ createdAt: -1 })
      .lean();
  }

  async getFeeById(id: string) {
    const fee = await FeeModel.findById(id).populate("studentId", "firstName lastName photo").lean();
    if (!fee) throw new NotFoundError("Fee record not found");
    return fee;
  }

  async recordPayment(feeId: string, installmentNumber: number, input: RecordPaymentInput, performedBy: string) {
    if (input.amount <= 0) throw new BadRequestError("Payment amount must be greater than zero");

    const fee = await FeeModel.findById(feeId);
    if (!fee) throw new NotFoundError("Fee record not found");

    const installment = fee.installments.find((i) => i.installmentNumber === installmentNumber);
    if (!installment) throw new NotFoundError("Installment not found");

    installment.paidAmount = Math.min(installment.amount, installment.paidAmount + input.amount);
    installment.paidAt = new Date();
    installment.paymentMethod = input.paymentMethod;
    installment.transactionId = input.transactionId;
    installment.status = installment.paidAmount >= installment.amount ? "paid" : "partial";

    // mark any past-due, still-unpaid installments as overdue
    const now = new Date();
    for (const inst of fee.installments) {
      if (inst.status === "pending" && inst.dueDate < now) inst.status = "overdue";
    }

    const user = await UserModel.findById(performedBy).select("firstName lastName").lean();
    const performedByName = user ? `${user.firstName} ${user.lastName}` : "System";

    fee.auditLog.push({
      action: "record_payment",
      amount: input.amount,
      installmentNumber,
      paymentMethod: input.paymentMethod,
      transactionId: input.transactionId,
      timestamp: new Date(),
      performedBy: performedBy as any,
      performedByName,
      details: `Recorded payment of INR ${input.amount} for installment #${installmentNumber}.`
    });

    fee.overallStatus = computeOverallStatus(fee.installments) as typeof fee.overallStatus;
    await fee.save();

    await this.sendPaymentReceipt(fee, installmentNumber, input.amount);

    return fee.toJSON ? fee.toJSON() : fee;
  }

  async updatePayment(
    feeId: string,
    installmentNumber: number,
    input: { amount: number; paymentMethod?: string; transactionId?: string },
    performedBy: string
  ) {
    if (input.amount < 0) throw new BadRequestError("Payment amount cannot be negative");

    const fee = await FeeModel.findById(feeId);
    if (!fee) throw new NotFoundError("Fee record not found");

    const installment = fee.installments.find((i) => i.installmentNumber === installmentNumber);
    if (!installment) throw new NotFoundError("Installment not found");

    const user = await UserModel.findById(performedBy).select("firstName lastName").lean();
    const performedByName = user ? `${user.firstName} ${user.lastName}` : "System";

    const oldAmount = installment.paidAmount;
    installment.paidAmount = Math.min(installment.amount, input.amount);
    installment.paymentMethod = input.paymentMethod;
    installment.transactionId = input.transactionId;
    installment.status = installment.paidAmount >= installment.amount ? "paid" : installment.paidAmount > 0 ? "partial" : "pending";
    if (installment.paidAmount > 0 && !installment.paidAt) {
      installment.paidAt = new Date();
    }

    fee.auditLog.push({
      action: "update_payment",
      amount: input.amount,
      installmentNumber,
      paymentMethod: input.paymentMethod,
      transactionId: input.transactionId,
      timestamp: new Date(),
      performedBy: performedBy as any,
      performedByName,
      details: `Updated installment #${installmentNumber} payment from INR ${oldAmount} to INR ${input.amount}.`
    });

    fee.overallStatus = computeOverallStatus(fee.installments) as any;
    await fee.save();

    return fee.toJSON ? fee.toJSON() : fee;
  }

  async undoPayment(
    feeId: string,
    installmentNumber: number,
    performedBy: string
  ) {
    const fee = await FeeModel.findById(feeId);
    if (!fee) throw new NotFoundError("Fee record not found");

    const installment = fee.installments.find((i) => i.installmentNumber === installmentNumber);
    if (!installment) throw new NotFoundError("Installment not found");

    const user = await UserModel.findById(performedBy).select("firstName lastName").lean();
    const performedByName = user ? `${user.firstName} ${user.lastName}` : "System";

    const oldAmount = installment.paidAmount;
    installment.paidAmount = 0;
    installment.paidAt = undefined;
    installment.paymentMethod = undefined;
    installment.transactionId = undefined;
    installment.status = "pending";

    fee.auditLog.push({
      action: "undo_payment",
      amount: 0,
      installmentNumber,
      timestamp: new Date(),
      performedBy: performedBy as any,
      performedByName,
      details: `Undid payment of INR ${oldAmount} for installment #${installmentNumber}.`
    });

    fee.overallStatus = computeOverallStatus(fee.installments) as any;
    await fee.save();

    return fee.toJSON ? fee.toJSON() : fee;
  }

  async sendInstallmentReminder(feeId: string, installmentNumber: number, performedBy: string) {
    const fee = await FeeModel.findById(feeId).populate("studentId", "firstName lastName guardianIds");
    if (!fee) throw new NotFoundError("Fee record not found");

    const installment = fee.installments.find((i) => i.installmentNumber === installmentNumber);
    if (!installment) throw new NotFoundError("Installment not found");

    if (installment.status === "paid") {
      throw new BadRequestError("This installment is already marked as paid");
    }

    const student = fee.studentId as any;
    if (!student) throw new NotFoundError("Player record not found");

    if (!student.guardianIds || student.guardianIds.length === 0) {
      throw new BadRequestError("No guardians are linked to this player. Link a guardian to send alerts.");
    }

    const guardians = await UserModel.find({ _id: { $in: student.guardianIds } }).select("_id phone firstName lastName");
    if (!guardians || guardians.length === 0) {
      throw new BadRequestError("No guardian user accounts found for this player.");
    }

    const franchise = await FranchiseModel.findById(fee.franchiseId).select("academyId").lean();
    const academy = franchise ? await AcademyModel.findById(franchise.academyId).select("feeQrImageUrl").lean() : null;
    const qrImageUrl = academy?.feeQrImageUrl;

    const remainingAmount = installment.amount - installment.paidAmount;
    const studentName = `${student.firstName} ${student.lastName}`.trim();
    const dueDateObj = new Date(installment.dueDate);
    const formattedDueDate = dueDateObj.toLocaleDateString("en-IN");
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    await notificationService.sendFeeDueAlert(
      guardians.map((g) => g._id.toString()),
      studentName,
      remainingAmount,
      formattedDueDate,
      daysUntilDue,
      String(fee.franchiseId),
      qrImageUrl,
    );

    installment.reminderSentCount = (installment.reminderSentCount || 0) + 1;
    installment.lastReminderAt = new Date();

    const user = await UserModel.findById(performedBy).select("firstName lastName").lean();
    const performedByName = user ? `${user.firstName} ${user.lastName}` : "System";

    fee.auditLog.push({
      action: "send_reminder",
      amount: remainingAmount,
      installmentNumber,
      timestamp: new Date(),
      performedBy: performedBy as any,
      performedByName,
      details: `Sent payment reminder for installment #${installmentNumber} (₹${remainingAmount.toLocaleString("en-IN")}) with ${qrImageUrl ? "payment QR code" : "payment details"}. Total reminders: ${installment.reminderSentCount}.`,
    });

    await fee.save();

    return FeeModel.findById(fee._id).populate("studentId", "firstName lastName photo").lean();
  }

  /**
   * Scenario: when a manager records a payment, guardians get a
   * system notification plus a WhatsApp text+document message carrying
   * an auto-generated receipt. Failures here (Cloudinary/WhatsApp being
   * down, no guardian phone, etc.) are logged and swallowed — a receipt
   * delivery problem must never undo or block the payment that was just
   * recorded.
   */
  private async sendPaymentReceipt(
    fee: { _id: unknown; franchiseId: unknown; studentId: unknown; currency: string },
    installmentNumber: number,
    amountJustPaid: number,
  ) {
    try {
      const student = await StudentModel.findById(fee.studentId).select("firstName lastName guardianIds").lean();
      if (!student || student.guardianIds.length === 0) return;

      const populatedFee = await FeeModel.findById(fee._id).lean();
      const installment = populatedFee?.installments.find((i) => i.installmentNumber === installmentNumber);
      if (!installment) return;

      const studentName = `${student.firstName} ${student.lastName}`;
      const academy = await FranchiseModel.findById(fee.franchiseId).select("academyId").lean();
      const academyDoc = academy ? await AcademyModel.findById(academy.academyId).select("name").lean() : null;
      const academyName = academyDoc?.name ?? "Your Academy";

      const receiptNumber = `${String(fee._id).slice(-8).toUpperCase()}-${installmentNumber}`;
      const pdfBuffer = await generateReceiptPdf({
        academyName,
        studentName,
        installmentNumber,
        amountPaid: amountJustPaid,
        totalInstallmentAmount: installment.amount,
        currency: fee.currency,
        paymentMethod: installment.paymentMethod,
        transactionId: installment.transactionId,
        paidAt: installment.paidAt ?? new Date(),
        receiptNumber,
      });

      const upload = await cloudinaryService.uploadBuffer(pdfBuffer, "fee_receipt", `receipt-${receiptNumber}.pdf`);

      await FeeModel.updateOne(
        { _id: fee._id, "installments.installmentNumber": installmentNumber },
        { $set: { "installments.$.receiptUrl": upload.url } },
      );

      const guardians = await UserModel.find({ _id: { $in: student.guardianIds } }).select("_id").lean();
      await notificationService.sendPaymentReceiptAlert(
        guardians.map((g) => g._id.toString()),
        studentName,
        amountJustPaid,
        upload.url,
        String(fee.franchiseId),
      );
    } catch (err) {
      logger.error("[AdminFeesUseCases] Couldn't generate/send payment receipt:", err);
    }
  }

  private async scheduleInstallmentReminders(fee: {
    id?: string;
    _id?: unknown;
    franchiseId: unknown;
    installments: { installmentNumber: number; dueDate: Date }[];
  }) {
    const feeId = (fee.id ?? String(fee._id)) as string;
    const franchiseId = String(fee.franchiseId);

    try {
      const franchise = await FranchiseModel.findById(franchiseId).select("academyId").lean();
      const academy = franchise ? await AcademyModel.findById(franchise.academyId).select("dueDateAlertDays").lean() : null;
      const daysBefore = academy?.dueDateAlertDays ?? 3;

      const tasks = fee.installments.map(async (installment) => {
        try {
          await schedulerService.scheduleSingleFeeReminder(
            feeId,
            installment.installmentNumber,
            installment.dueDate,
            daysBefore,
          );
        } catch (err) {
          logger.error(
            `[AdminFeesUseCases] Couldn't schedule reminder for fee ${feeId} installment ${installment.installmentNumber}:`,
            err,
          );
        }
      });

      await Promise.allSettled(tasks);
    } catch (err) {
      logger.error(`[AdminFeesUseCases] Couldn't schedule reminders for fee ${feeId}:`, err);
    }
  }
}
