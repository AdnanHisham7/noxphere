// src/interfaces/http/controllers/RegistrationController.ts
import { Request, Response, NextFunction } from "express";
import { RegistrationUseCases } from "../../../application/use-cases/student/RegistrationUseCases";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";

export class RegistrationController {
  constructor(private readonly registrationUseCases: RegistrationUseCases) {}

  getAcademyPublicInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.registrationUseCases.getAcademyPublicInfo(req.params.academyId);
      ResponseHandler.success(res, data, "Academy public info retrieved");
    } catch (err) {
      next(err);
    }
  };

  sendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;
      const result = await this.registrationUseCases.sendOtp(email);
      ResponseHandler.success(res, result, "Verification code sent");
    } catch (err) {
      next(err);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, otp } = req.body;
      const result = await this.registrationUseCases.verifyOtp(email, otp);
      ResponseHandler.success(res, result, "Verification successful");
    } catch (err) {
      next(err);
    }
  };

  submitRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.registrationUseCases.submitRequest({
        ...req.body,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });
      ResponseHandler.created(res, result, "Registration request submitted");
    } catch (err) {
      next(err);
    }
  };

  listRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const academyId = (req.user as any)?.academyId || (req.query.academyId as string);
      const franchiseId = (req.query.franchiseId as string) || undefined;
      const status = req.query.status as string;

      const requests = await this.registrationUseCases.listRequests(academyId, franchiseId, status);
      ResponseHandler.success(res, { requests, total: requests.length }, "Registration requests retrieved");
    } catch (err) {
      next(err);
    }
  };

  rejectRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reason } = req.body;
      const result = await this.registrationUseCases.rejectRequest(req.params.id, reason, req.user!.sub);
      ResponseHandler.success(res, result, "Registration request rejected");
    } catch (err) {
      next(err);
    }
  };

  approveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.registrationUseCases.approveRequest(req.params.id, req.body, req.user!.sub);
      ResponseHandler.success(res, result, "Registration request approved");
    } catch (err) {
      next(err);
    }
  };
}
