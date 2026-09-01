// src/interfaces/http/controllers/ComplaintController.ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ComplaintUseCases } from "../../../application/use-cases/complaint/ComplaintUseCases";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";
import { ForbiddenError, BadRequestError } from "../../../shared/errors/AppError";

const CreateComplaintSchema = z.object({
  subject: z.string().min(1).max(150),
  message: z.string().min(1).max(3000),
});

const RespondSchema = z.object({
  response: z.string().min(1).max(3000),
  status: z.enum(["in_progress", "resolved"]),
});

function assertAcademyAccess(req: Request, academyId: string): void {
  if (req.user!.role === "super_admin") return;
  if (req.user!.role === "manager" && req.user!.academyId === academyId) return;
  throw new ForbiddenError("You can only manage your own academy's complaints");
}

export class ComplaintController {
  constructor(private useCases: ComplaintUseCases) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user!.academyId) {
        throw new BadRequestError("Your account isn't linked to an academy");
      }
      const dto = CreateComplaintSchema.parse(req.body);
      const complaint = await this.useCases.create({
        academyId: req.user!.academyId,
        raisedBy: req.user!.sub,
        subject: dto.subject,
        message: dto.message,
      });
      ResponseHandler.created(res, complaint, "Complaint submitted");
    } catch (err) {
      next(err);
    }
  };

  listForAcademy = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const status = req.query.status as "open" | "in_progress" | "resolved" | undefined;
      const complaints = await this.useCases.listForAcademy(academyId, status);
      ResponseHandler.success(res, complaints, "Complaints retrieved");
    } catch (err) {
      next(err);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const complaints = await this.useCases.listMine(req.user!.sub);
      ResponseHandler.success(res, complaints, "Your complaints retrieved");
    } catch (err) {
      next(err);
    }
  };

  respond = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const dto = RespondSchema.parse(req.body);
      const complaint = await this.useCases.respond(
        req.params.complaintId,
        academyId,
        req.user!.sub,
        dto.response,
        dto.status,
      );
      ResponseHandler.success(res, complaint, "Response sent");
    } catch (err) {
      next(err);
    }
  };
}