import { Request, Response, NextFunction } from "express";
import { AdminFeesUseCases } from "../../../application/use-cases/fees/AdminFeesUseCases";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";
import { BadRequestError } from "../../../shared/errors/AppError";

export class AdminFeesController {
  constructor(private feesUseCases: AdminFeesUseCases) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, franchiseId, feeType, totalAmount, discount, promoCode, installments, notes } = req.body;
      if (!studentId || !franchiseId || !feeType || !totalAmount || !Array.isArray(installments)) {
        throw new BadRequestError("studentId, franchiseId, feeType, totalAmount and installments[] are required");
      }
      const fee = await this.feesUseCases.createFee(
        { studentId, franchiseId, feeType, totalAmount, discount, promoCode, installments, notes },
        req.user!.sub,
      );
      ResponseHandler.created(res, fee, "Fee plan created");
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { franchiseId, studentId, status } = req.query;
      if (!franchiseId) throw new BadRequestError("franchiseId is required");
      const fees = await this.feesUseCases.listFees(franchiseId as string, {
        studentId: studentId as string | undefined,
        status: status as string | undefined,
      });
      ResponseHandler.success(res, fees, "Fees retrieved");
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fee = await this.feesUseCases.getFeeById(req.params.id);
      ResponseHandler.success(res, fee, "Fee retrieved");
    } catch (err) {
      next(err);
    }
  };

  recordPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, paymentMethod, transactionId, paymentBreakdown } = req.body;
      const numAmount = Number(amount);
      if (!numAmount && (!Array.isArray(paymentBreakdown) || paymentBreakdown.length === 0)) {
        throw new BadRequestError("amount or paymentBreakdown is required");
      }
      const fee = await this.feesUseCases.recordPayment(
        req.params.id,
        Number(req.params.installmentNumber),
        { amount: numAmount, paymentMethod, transactionId, paymentBreakdown },
        req.user!.sub,
      );
      ResponseHandler.success(res, fee, "Payment recorded");
    } catch (err) {
      next(err);
    }
  };

  updatePayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, paymentMethod, transactionId, paymentBreakdown } = req.body;
      const numAmount = amount !== undefined ? Number(amount) : 0;
      if (amount === undefined && (!Array.isArray(paymentBreakdown) || paymentBreakdown.length === 0)) {
        throw new BadRequestError("amount or paymentBreakdown is required");
      }
      const fee = await this.feesUseCases.updatePayment(
        req.params.id,
        Number(req.params.installmentNumber),
        { amount: numAmount, paymentMethod, transactionId, paymentBreakdown },
        req.user!.sub,
      );
      ResponseHandler.success(res, fee, "Payment updated");
    } catch (err) {
      next(err);
    }
  };

  undoPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fee = await this.feesUseCases.undoPayment(
        req.params.id,
        Number(req.params.installmentNumber),
        req.user!.sub,
      );
      ResponseHandler.success(res, fee, "Payment undone");
    } catch (err) {
      next(err);
    }
  };

  sendReminder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fee = await this.feesUseCases.sendInstallmentReminder(
        req.params.id,
        Number(req.params.installmentNumber),
        req.user!.sub,
      );
      ResponseHandler.success(res, fee, "Payment reminder alert sent");
    } catch (err) {
      next(err);
    }
  };

  verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { action, rejectionReason, adjustedAmount } = req.body;
      if (!action || (action !== "approve" && action !== "reject")) {
        throw new BadRequestError("Action must be either 'approve' or 'reject'");
      }
      const fee = await this.feesUseCases.verifyPayment(
        req.params.id,
        Number(req.params.installmentNumber),
        { action, rejectionReason, adjustedAmount },
        req.user!.sub,
      );
      ResponseHandler.success(res, fee, action === "approve" ? "Payment verified and recorded" : "Payment proof rejected");
    } catch (err) {
      next(err);
    }
  };
}
