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

    await this.scheduleInstallmentReminders(fee);

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

  async recordPayment(feeId: string, installmentNumber: number, input: RecordPaymentInput) {
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

    fee.overallStatus = computeOverallStatus(fee.installments) as typeof fee.overallStatus;
    await fee.save();

    await this.sendPaymentReceipt(fee, installmentNumber, input.amount);

    return fee.toJSON ? fee.toJSON() : fee;
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
    for (const installment of fee.installments) {
      try {
        await schedulerService.scheduleFeeReminders(feeId, installment.installmentNumber, installment.dueDate, franchiseId);
      } catch (err) {
        // Scheduling is best-effort — a Redis hiccup shouldn't fail fee
        // creation itself, which is a much more important operation.
        logger.error(
          `[AdminFeesUseCases] Couldn't schedule reminder for fee ${feeId} installment ${installment.installmentNumber}:`,
          err,
        );
      }
    }
  }
}
