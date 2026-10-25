import { FeeModel } from "../../../infrastructure/database/models/Fee.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { NotFoundError, BadRequestError } from "../../../shared/errors/AppError";
import { schedulerService } from "../../../infrastructure/services/SchedulerService";
import { notificationService } from "../../../infrastructure/services/NotificationService";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { cloudinaryService } from "../../../infrastructure/services/CloudinaryService";
import { exchangeRateService } from "../../../infrastructure/services/ExchangeRateService";
import { generateReceiptPdf } from "../../../shared/utils/receiptGenerator";
import { logger } from "../../../shared/utils/logger";

export interface CreateFeeInput {
  studentId: string;
  franchiseId: string;
  feeType: "one_time" | "installment" | "early_bird";
  totalAmount: number;
  discount?: number;
  promoCode?: string;
  currency?: string;
  installments: { installmentNumber: number; amount: number; dueDate: string }[];
  notes?: string;
}

export interface PaymentBreakdownItem {
  method: string;
  amount: number;
  transactionId?: string;
}

export interface RecordPaymentInput {
  amount: number;
  paymentMethod?: string;
  transactionId?: string;
  paymentBreakdown?: PaymentBreakdownItem[];
}

function computeOverallStatus(installments: { status: string }[]): string {
  if (installments.every((i) => i.status === "paid")) return "paid";
  if (installments.some((i) => i.status === "overdue")) return "overdue";
  if (installments.some((i) => i.status === "pending_verification")) return "pending_verification";
  if (installments.some((i) => i.status === "partial" || i.status === "paid")) return "partial";
  return "pending";
}

export interface UpdateFeeInput {
  feeType?: "one_time" | "installment" | "early_bird";
  totalAmount?: number;
  discount?: number;
  notes?: string;
  installments?: {
    installmentNumber: number;
    amount: number;
    dueDate: string;
  }[];
}

export class AdminFeesUseCases {
  async createFee(input: CreateFeeInput, createdBy: string) {
    const discount = input.discount ?? 0;
    const finalAmount = input.totalAmount - discount;

    let feeCurrency = input.currency?.toUpperCase();
    if (!feeCurrency && input.franchiseId) {
      const franchise = await FranchiseModel.findById(input.franchiseId).select("academyId").lean();
      if (franchise?.academyId) {
        const academy = await AcademyModel.findById(franchise.academyId).select("currency").lean();
        if (academy?.currency) {
          feeCurrency = academy.currency.toUpperCase();
        }
      }
    }
    if (!feeCurrency) feeCurrency = "INR";

    const fee = await FeeModel.create({
      studentId: input.studentId,
      franchiseId: input.franchiseId,
      feeType: input.feeType,
      totalAmount: input.totalAmount,
      discount,
      promoCode: input.promoCode,
      currency: feeCurrency,
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

    const [fees, franchise] = await Promise.all([
      FeeModel.find(query)
        .populate("studentId", "firstName lastName photo")
        .sort({ createdAt: -1 })
        .lean(),
      FranchiseModel.findById(franchiseId).select("academyId").lean(),
    ]);

    let academyCurrency: string | null = null;
    if (franchise?.academyId) {
      const academy = await AcademyModel.findById(franchise.academyId).select("currency").lean();
      if (academy?.currency) academyCurrency = academy.currency.toUpperCase();
    }

    if (academyCurrency && academyCurrency !== "INR") {
      return fees.map((f: any) => ({
        ...f,
        currency: f.currency && f.currency !== "INR" ? f.currency : academyCurrency,
      }));
    }

    return fees;
  }

  async updateFee(feeId: string, input: UpdateFeeInput, performedBy: string) {
    const fee = await FeeModel.findById(feeId);
    if (!fee) throw new NotFoundError("Fee record not found");

    const user = await UserModel.findById(performedBy).select("firstName lastName").lean();
    const performedByName = user ? `${user.firstName} ${user.lastName}` : "Manager";

    if (fee.overallStatus === "paid") {
      throw new BadRequestError("Cannot edit a fee schedule that is already fully paid.");
    }

    // If installments are being updated
    if (input.installments && Array.isArray(input.installments) && input.installments.length > 0) {
      // Check if any existing installment with payments recorded is being removed or reduced below paid amount
      for (const existingInst of fee.installments) {
        if (existingInst.paidAmount > 0) {
          const matchingUpdated = input.installments.find(
            (i) => i.installmentNumber === existingInst.installmentNumber,
          );
          if (!matchingUpdated) {
            throw new BadRequestError(
              `Installment #${existingInst.installmentNumber} has recorded payments of ${existingInst.paidAmount} and cannot be removed.`,
            );
          }
          if (matchingUpdated.amount < existingInst.paidAmount) {
            throw new BadRequestError(
              `Installment #${existingInst.installmentNumber} amount (${matchingUpdated.amount}) cannot be less than already paid amount (${existingInst.paidAmount}).`,
            );
          }
        }
      }

      // Cancel old reminder queue entries before rescheduling
      schedulerService.cancelFeeReminders(String(fee._id)).catch((err) => {
        logger.error(`[AdminFeesUseCases] Failed cancelling old reminders for fee ${fee._id}:`, err);
      });

      const now = new Date();
      // Re-map installments preserving paid status and paidAmounts
      fee.installments = input.installments.map((item) => {
        const existing = fee.installments.find(
          (i) => i.installmentNumber === item.installmentNumber,
        );
        const paidAmount = existing ? existing.paidAmount : 0;
        const dueDate = new Date(item.dueDate);
        let status = "pending";
        if (paidAmount >= item.amount) {
          status = "paid";
        } else if (paidAmount > 0) {
          status = "partial";
        } else if (dueDate < now) {
          status = "overdue";
        }

        return {
          installmentNumber: item.installmentNumber,
          amount: item.amount,
          dueDate,
          paidAmount,
          paidAt: existing?.paidAt,
          status,
          paymentMethod: existing?.paymentMethod,
          transactionId: existing?.transactionId,
          paymentBreakdown: existing?.paymentBreakdown,
          verificationProof: existing?.verificationProof,
          receiptUrl: existing?.receiptUrl,
          reminderSentCount: existing?.reminderSentCount ?? 0,
          lastReminderAt: existing?.lastReminderAt,
        } as any;
      });
    }

    if (input.feeType) {
      fee.feeType = input.feeType;
    }
    if (input.notes !== undefined) {
      fee.notes = input.notes;
    }
    if (input.discount !== undefined) {
      fee.discount = input.discount;
    }
    if (input.totalAmount !== undefined) {
      fee.totalAmount = input.totalAmount;
    } else if (input.installments) {
      fee.totalAmount = input.installments.reduce((sum, i) => sum + i.amount, 0);
    }

    fee.finalAmount = Math.max(0, fee.totalAmount - (fee.discount || 0));
    fee.overallStatus = computeOverallStatus(fee.installments);

    fee.auditLog.push({
      action: "update_fee_schedule",
      amount: fee.finalAmount,
      installmentNumber: 0,
      timestamp: new Date(),
      performedBy: performedBy as any,
      performedByName,
      details: `Fee plan details or schedule updated. Final amount: ${fee.currency || "INR"} ${fee.finalAmount}`,
    });

    await fee.save();

    // Re-schedule reminders for pending installments
    this.scheduleInstallmentReminders(fee).catch((err) => {
      logger.error(`[AdminFeesUseCases] Failed rescheduling reminders for updated fee ${fee._id}:`, err);
    });

    return FeeModel.findById(fee._id).populate("studentId", "firstName lastName photo").lean();
  }

  async deleteFee(feeId: string, performedBy: string) {
    const fee = await FeeModel.findById(feeId);
    if (!fee) throw new NotFoundError("Fee record not found");

    const totalPaid = fee.installments.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
    if (totalPaid > 0) {
      throw new BadRequestError(
        `Cannot delete a fee plan that already has recorded payments (${fee.currency || "INR"} ${totalPaid.toLocaleString()}). Undo all recorded payments first or mark remaining as settled.`,
      );
    }

    // Delete fee record from database immediately so deletion is instant
    await FeeModel.findByIdAndDelete(feeId);

    // Cancel pending reminder jobs in background without blocking response
    schedulerService.cancelFeeReminders(String(fee._id)).catch((err) => {
      logger.error(`[AdminFeesUseCases] Failed cancelling reminders for deleted fee ${feeId}:`, err);
    });

    logger.info(`[AdminFeesUseCases] Fee ${feeId} deleted by user ${performedBy}`);
    return { success: true, message: "Fee schedule deleted successfully" };
  }

  async getFeeById(id: string) {
    const fee = await FeeModel.findById(id).populate("studentId", "firstName lastName photo").lean();
    if (!fee) throw new NotFoundError("Fee record not found");
    if (fee.franchiseId) {
      const franchise = await FranchiseModel.findById(fee.franchiseId).select("academyId").lean();
      if (franchise?.academyId) {
        const academy = await AcademyModel.findById(franchise.academyId).select("currency").lean();
        if (academy?.currency && academy.currency.toUpperCase() !== "INR" && (!fee.currency || fee.currency === "INR")) {
          return { ...fee, currency: academy.currency.toUpperCase() };
        }
      }
    }
    return fee;
  }

  async recordPayment(feeId: string, installmentNumber: number, input: RecordPaymentInput, performedBy: string) {
    // If a paymentBreakdown array is supplied, validate it and recalculate total
    let effectiveAmount = input.amount;
    let paymentBreakdown = input.paymentBreakdown;

    if (paymentBreakdown && Array.isArray(paymentBreakdown) && paymentBreakdown.length > 0) {
      const breakdownSum = paymentBreakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      if (breakdownSum <= 0) {
        throw new BadRequestError("Sum of payment breakdown amounts must be greater than zero");
      }
      effectiveAmount = breakdownSum;
    }

    if (effectiveAmount <= 0) throw new BadRequestError("Payment amount must be greater than zero");

    const fee = await FeeModel.findById(feeId);
    if (!fee) throw new NotFoundError("Fee record not found");

    const installment = fee.installments.find((i) => i.installmentNumber === installmentNumber);
    if (!installment) throw new NotFoundError("Installment not found");

    const feeCurrency = fee.currency || "INR";
    const { rate: exchangeRateToInr, amountInInr } = await exchangeRateService.convertToInr(effectiveAmount, feeCurrency);

    installment.paidAmount = Math.min(installment.amount, installment.paidAmount + effectiveAmount);
    installment.paidAt = new Date();
    installment.exchangeRateToInr = exchangeRateToInr;
    installment.paidAmountInInr = (installment.paidAmountInInr || 0) + amountInInr;

    // Determine paymentMethod description
    if (paymentBreakdown && paymentBreakdown.length > 1) {
      installment.paymentMethod = input.paymentMethod || "mixed";
      installment.paymentBreakdown = paymentBreakdown;
      // Synthesize transaction IDs if available
      const txnIds = paymentBreakdown.map((b) => b.transactionId).filter(Boolean);
      installment.transactionId = input.transactionId || (txnIds.length > 0 ? txnIds.join(", ") : undefined);
    } else if (paymentBreakdown && paymentBreakdown.length === 1) {
      installment.paymentMethod = paymentBreakdown[0].method || input.paymentMethod || "cash";
      installment.paymentBreakdown = paymentBreakdown;
      installment.transactionId = paymentBreakdown[0].transactionId || input.transactionId;
    } else {
      installment.paymentMethod = input.paymentMethod;
      installment.transactionId = input.transactionId;
    }

    installment.status = installment.paidAmount >= installment.amount ? "paid" : "partial";

    // mark any past-due, still-unpaid installments as overdue
    const now = new Date();
    for (const inst of fee.installments) {
      if (inst.status === "pending" && inst.dueDate < now) inst.status = "overdue";
    }

    const user = await UserModel.findById(performedBy).select("firstName lastName").lean();
    const performedByName = user ? `${user.firstName} ${user.lastName}` : "System";

    const breakdownText = paymentBreakdown && paymentBreakdown.length > 1
      ? ` (Mixed: ${paymentBreakdown.map((b) => `${b.method.toUpperCase()} ${fee.currency || 'INR'} ${b.amount}${b.transactionId ? ` [${b.transactionId}]` : ''}`).join(', ')})`
      : '';

    fee.auditLog.push({
      action: "record_payment",
      amount: effectiveAmount,
      installmentNumber,
      paymentMethod: installment.paymentMethod,
      transactionId: installment.transactionId,
      paymentBreakdown: paymentBreakdown,
      exchangeRateToInr,
      amountInInr,
      timestamp: new Date(),
      performedBy: performedBy as any,
      performedByName,
      details: `Recorded payment of ${fee.currency || 'INR'} ${effectiveAmount}${breakdownText} for installment #${installmentNumber}.`
    });

    fee.overallStatus = computeOverallStatus(fee.installments) as typeof fee.overallStatus;
    await fee.save();

    await this.sendPaymentReceipt(fee, installmentNumber, effectiveAmount);

    return fee.toJSON ? fee.toJSON() : fee;
  }

  async updatePayment(
    feeId: string,
    installmentNumber: number,
    input: { amount: number; paymentMethod?: string; transactionId?: string; paymentBreakdown?: PaymentBreakdownItem[] },
    performedBy: string
  ) {
    let effectiveAmount = input.amount;
    let paymentBreakdown = input.paymentBreakdown;

    if (paymentBreakdown && Array.isArray(paymentBreakdown) && paymentBreakdown.length > 0) {
      const breakdownSum = paymentBreakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      effectiveAmount = breakdownSum;
    }

    if (effectiveAmount < 0) throw new BadRequestError("Payment amount cannot be negative");

    const fee = await FeeModel.findById(feeId);
    if (!fee) throw new NotFoundError("Fee record not found");

    const installment = fee.installments.find((i) => i.installmentNumber === installmentNumber);
    if (!installment) throw new NotFoundError("Installment not found");

    const user = await UserModel.findById(performedBy).select("firstName lastName").lean();
    const performedByName = user ? `${user.firstName} ${user.lastName}` : "System";

    const oldAmount = installment.paidAmount;
    installment.paidAmount = Math.min(installment.amount, effectiveAmount);

    const feeCurrency = fee.currency || "INR";
    const { rate: exchangeRateToInr, amountInInr } = await exchangeRateService.convertToInr(effectiveAmount, feeCurrency);
    installment.exchangeRateToInr = exchangeRateToInr;
    installment.paidAmountInInr = amountInInr;

    if (paymentBreakdown && paymentBreakdown.length > 1) {
      installment.paymentMethod = input.paymentMethod || "mixed";
      installment.paymentBreakdown = paymentBreakdown;
      const txnIds = paymentBreakdown.map((b) => b.transactionId).filter(Boolean);
      installment.transactionId = input.transactionId || (txnIds.length > 0 ? txnIds.join(", ") : undefined);
    } else if (paymentBreakdown && paymentBreakdown.length === 1) {
      installment.paymentMethod = paymentBreakdown[0].method || input.paymentMethod || "cash";
      installment.paymentBreakdown = paymentBreakdown;
      installment.transactionId = paymentBreakdown[0].transactionId || input.transactionId;
    } else {
      installment.paymentMethod = input.paymentMethod;
      installment.transactionId = input.transactionId;
      installment.paymentBreakdown = undefined;
    }

    installment.status = installment.paidAmount >= installment.amount ? "paid" : installment.paidAmount > 0 ? "partial" : "pending";
    if (installment.paidAmount > 0 && !installment.paidAt) {
      installment.paidAt = new Date();
    }

    const breakdownText = paymentBreakdown && paymentBreakdown.length > 1
      ? ` (Mixed: ${paymentBreakdown.map((b) => `${b.method.toUpperCase()} ${fee.currency || 'INR'} ${b.amount}${b.transactionId ? ` [${b.transactionId}]` : ''}`).join(', ')})`
      : '';

    fee.auditLog.push({
      action: "update_payment",
      amount: effectiveAmount,
      installmentNumber,
      paymentMethod: installment.paymentMethod,
      transactionId: installment.transactionId,
      paymentBreakdown: paymentBreakdown,
      exchangeRateToInr,
      amountInInr,
      timestamp: new Date(),
      performedBy: performedBy as any,
      performedByName,
      details: `Updated installment #${installmentNumber} payment from ${fee.currency || 'INR'} ${oldAmount} to ${fee.currency || 'INR'} ${effectiveAmount}${breakdownText}.`
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

  async submitPaymentProof(
    feeId: string,
    installmentNumber: number,
    input: {
      amount: number;
      paymentMethod?: string;
      transactionId?: string;
      notes?: string;
    },
    performedBy: string,
  ) {
    const fee = await FeeModel.findById(feeId);
    if (!fee) throw new NotFoundError("Fee record not found");

    const installment = fee.installments.find((i) => i.installmentNumber === installmentNumber);
    if (!installment) throw new NotFoundError("Installment not found");

    if (installment.status === "paid") {
      throw new BadRequestError("This installment is already fully paid");
    }

    installment.status = "pending_verification";
    installment.verificationProof = {
      claimedAmount: input.amount,
      paymentMethod: input.paymentMethod || "upi",
      transactionId: input.transactionId,
      notes: input.notes,
      submittedAt: new Date(),
      submittedBy: performedBy,
    };

    const user = await UserModel.findById(performedBy).select("firstName lastName").lean();
    const performedByName = user ? `${user.firstName} ${user.lastName}` : "Guardian";

    fee.auditLog.push({
      action: "payment_proof_submitted",
      amount: input.amount,
      installmentNumber,
      paymentMethod: input.paymentMethod,
      transactionId: input.transactionId,
      timestamp: new Date(),
      performedBy: performedBy as any,
      performedByName,
      details: `Guardian submitted payment proof of ${fee.currency || 'INR'} ${input.amount} via ${input.paymentMethod || 'upi'}${input.transactionId ? ` (Ref: ${input.transactionId})` : ''}. Awaiting academy verification.`
    });

    fee.overallStatus = computeOverallStatus(fee.installments) as typeof fee.overallStatus;
    await fee.save();

    // System alerts: Notify academy managers & operational managers
    try {
      const student = await StudentModel.findById(fee.studentId).select("firstName lastName").lean();
      const studentName = student ? `${student.firstName} ${student.lastName}` : "Student";

      const managerUsers = await UserModel.find({
        isActive: true,
        $or: [
          { role: { $in: ["manager", "operational_manager", "super_admin"] } },
          { "permissions.canManageFinance": true },
        ],
        $and: [
          {
            $or: [
              { franchiseId: fee.franchiseId },
              { role: "super_admin" },
              { franchiseId: { $exists: false } },
              { franchiseId: null },
            ],
          },
        ],
      }).select("_id").lean();

      const recipientIds = managerUsers.map((u) => u._id.toString());
      if (recipientIds.length > 0) {
        await notificationService.send({
          userIds: recipientIds,
          type: "system_alert" as any,
          title: "Fee Payment Proof Submitted",
          body: `${performedByName} submitted payment proof of ${fee.currency || "INR"} ${input.amount} for ${studentName} (Installment #${installmentNumber}). Awaiting verification.`,
          data: {
            feeId: fee._id.toString(),
            installmentNumber: String(installmentNumber),
            studentId: fee.studentId?.toString() || "",
            studentName,
            amount: String(input.amount),
            currency: fee.currency || "INR",
            url: `/admin/fees?filter=pending_verification&feeId=${fee._id.toString()}`,
          },
          franchiseId: fee.franchiseId?.toString(),
        });
      }
    } catch (notifErr) {
      logger.error("[AdminFeesUseCases] Failed to send submission alerts to managers:", notifErr);
    }

    return fee.toJSON ? fee.toJSON() : fee;
  }

  async verifyPayment(
    feeId: string,
    installmentNumber: number,
    input: {
      action: "approve" | "reject";
      rejectionReason?: string;
      adjustedAmount?: number;
    },
    performedBy: string,
  ) {
    const fee = await FeeModel.findById(feeId);
    if (!fee) throw new NotFoundError("Fee record not found");

    const installment = fee.installments.find((i) => i.installmentNumber === installmentNumber);
    if (!installment) throw new NotFoundError("Installment not found");

    if (installment.status !== "pending_verification") {
      throw new BadRequestError("This installment does not have a pending verification");
    }

    const user = await UserModel.findById(performedBy).select("firstName lastName").lean();
    const performedByName = user ? `${user.firstName} ${user.lastName}` : "Academy Manager";
    const proofSubmittedBy = installment.verificationProof?.submittedBy?.toString();

    if (input.action === "approve") {
      const proof = installment.verificationProof;
      const effectiveAmount = input.adjustedAmount ?? proof?.claimedAmount ?? (installment.amount - installment.paidAmount);

      const feeCurrency = fee.currency || "INR";
      const { rate: exchangeRateToInr, amountInInr } = await exchangeRateService.convertToInr(effectiveAmount, feeCurrency);

      installment.paidAmount = Math.min(installment.amount, installment.paidAmount + effectiveAmount);
      installment.paidAt = new Date();
      installment.exchangeRateToInr = exchangeRateToInr;
      installment.paidAmountInInr = (installment.paidAmountInInr || 0) + amountInInr;
      installment.paymentMethod = proof?.paymentMethod || installment.paymentMethod || "upi";
      installment.transactionId = proof?.transactionId || installment.transactionId;
      installment.status = installment.paidAmount >= installment.amount ? "paid" : "partial";
      installment.verificationProof = undefined;

      fee.auditLog.push({
        action: "verify_payment_approved",
        amount: effectiveAmount,
        installmentNumber,
        paymentMethod: installment.paymentMethod,
        transactionId: installment.transactionId,
        exchangeRateToInr,
        amountInInr,
        timestamp: new Date(),
        performedBy: performedBy as any,
        performedByName,
        details: `Verified & approved payment proof of ${fee.currency || 'INR'} ${effectiveAmount} for installment #${installmentNumber}.`
      });

      fee.overallStatus = computeOverallStatus(fee.installments) as typeof fee.overallStatus;
      await fee.save();

      await this.sendPaymentReceipt(fee, installmentNumber, effectiveAmount);

      if (proofSubmittedBy) {
        try {
          const student = await StudentModel.findById(fee.studentId).select("firstName lastName").lean();
          const studentName = student ? `${student.firstName} ${student.lastName}` : "Student";
          await notificationService.send({
            userIds: [proofSubmittedBy],
            type: "payment_reminder" as any,
            title: "Payment Proof Approved",
            body: `Your payment proof of ${fee.currency || 'INR'} ${effectiveAmount} for ${studentName} (Installment #${installmentNumber}) has been approved and verified!`,
            data: {
              feeId: fee._id.toString(),
              installmentNumber: String(installmentNumber),
            },
            franchiseId: fee.franchiseId?.toString(),
          });
        } catch (e) {
          logger.error("[AdminFeesUseCases] Failed to notify guardian of approval:", e);
        }
      }
    } else {
      const now = new Date();
      const isOverdue = installment.dueDate < now;
      installment.status = isOverdue ? "overdue" : (installment.paidAmount > 0 ? "partial" : "pending");

      const reason = input.rejectionReason || "Payment proof could not be verified by academy.";
      installment.verificationProof = undefined;

      fee.auditLog.push({
        action: "verify_payment_rejected",
        amount: 0,
        installmentNumber,
        timestamp: new Date(),
        performedBy: performedBy as any,
        performedByName,
        details: `Rejected payment proof for installment #${installmentNumber}. Reason: ${reason}`
      });

      fee.overallStatus = computeOverallStatus(fee.installments) as typeof fee.overallStatus;
      await fee.save();

      if (proofSubmittedBy) {
        try {
          const student = await StudentModel.findById(fee.studentId).select("firstName lastName").lean();
          const studentName = student ? `${student.firstName} ${student.lastName}` : "Student";
          await notificationService.send({
            userIds: [proofSubmittedBy],
            type: "system_alert" as any,
            title: "Payment Proof Verification Rejected",
            body: `Payment proof for ${studentName} (Installment #${installmentNumber}) was rejected.${input.rejectionReason ? ` Reason: ${input.rejectionReason}` : ''}`,
            data: {
              feeId: fee._id.toString(),
              installmentNumber: String(installmentNumber),
              rejectionReason: reason,
            },
            franchiseId: fee.franchiseId?.toString(),
          });
        } catch (e) {
          logger.error("[AdminFeesUseCases] Failed to notify guardian of rejection:", e);
        }
      }
    }

    return FeeModel.findById(fee._id).populate("studentId", "firstName lastName photo").lean();
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
    const academy = franchise
      ? await AcademyModel.findById(franchise.academyId)
          .select("feeQrImageUrl feePaymentMethod bankDetails")
          .lean()
      : null;
    const qrImageUrl = academy?.feeQrImageUrl;
    const feePaymentMethod = (academy?.feePaymentMethod as any) || "qr";
    const bankDetails = academy?.bankDetails;

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
      bankDetails,
      feePaymentMethod,
      {
        studentId: student._id ? student._id.toString() : String(student.id || student),
        feeId: fee._id ? fee._id.toString() : String(fee.id),
        installmentNumber: String(installmentNumber),
      },
      fee.currency || "INR",
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
      details: `Sent payment reminder for installment #${installmentNumber} (${fee.currency || "INR"} ${remainingAmount.toLocaleString()}) with ${qrImageUrl ? "payment QR code" : "payment details"}. Total reminders: ${installment.reminderSentCount}.`,
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
        paymentBreakdown: installment.paymentBreakdown,
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
        {
          studentId: student._id ? student._id.toString() : String(student.id || student),
          feeId: String(fee._id),
          installmentNumber: String(installmentNumber),
        },
        fee.currency || "INR",
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
