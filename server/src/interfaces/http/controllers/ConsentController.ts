// src/interfaces/http/controllers/ConsentController.ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ConsentUseCases, CONSENT_NOTICE } from "../../../application/use-cases/consent/ConsentUseCases";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";
import { BadRequestError } from "../../../shared/errors/AppError";

const WithdrawSchema = z.object({
  reason: z.string().max(500).optional(),
});

export class ConsentController {
  constructor(private consentUseCases: ConsentUseCases) {}

  getNotice = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      ResponseHandler.success(res, CONSENT_NOTICE, "Consent notice retrieved");
    } catch (err) {
      next(err);
    }
  };

  getMyStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "guardian") {
        throw new BadRequestError("Only guardian accounts have consent status");
      }
      const status = await this.consentUseCases.getStatusForGuardian(req.user!.sub);
      ResponseHandler.success(res, status, "Consent status retrieved");
    } catch (err) {
      next(err);
    }
  };

  grant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "guardian") {
        throw new BadRequestError("Only guardian accounts can grant consent");
      }
      await this.consentUseCases.grantConsent(req.params.studentId, req.user!.sub, {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      ResponseHandler.success(res, null, "Consent recorded");
    } catch (err) {
      next(err);
    }
  };

  withdraw = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== "guardian") {
        throw new BadRequestError("Only guardian accounts can withdraw consent");
      }
      const dto = WithdrawSchema.parse(req.body);
      await this.consentUseCases.withdrawConsent(req.params.studentId, req.user!.sub, dto.reason, {
        ip: req.ip,
      });
      ResponseHandler.success(res, null, "Consent withdrawn");
    } catch (err) {
      next(err);
    }
  };

  getFranchiseStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const franchiseId = req.query.franchiseId as string;
      if (!franchiseId) throw new BadRequestError("franchiseId is required");
      const status = await this.consentUseCases.getStatusForFranchise(franchiseId);
      ResponseHandler.success(res, status, "Consent status retrieved");
    } catch (err) {
      next(err);
    }
  };
}