// src/interfaces/http/controllers/ComplaintController.ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { ComplaintUseCases } from "../../../application/use-cases/complaint/ComplaintUseCases";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";
import { ForbiddenError, BadRequestError } from "../../../shared/errors/AppError";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";

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
      let academyId = req.user?.academyId;

      // If academyId is not directly in the JWT (e.g. for guardian or student accounts),
      // resolve it through user record, user's franchise, or linked student profiles.
      if (!academyId && req.user?.sub) {
        const userId = req.user.sub;
        const user = await UserModel.findById(userId).select("academyId franchiseId").lean();
        if (user?.academyId) {
          academyId = user.academyId.toString();
        } else if (user?.franchiseId) {
          const franchise = await FranchiseModel.findById(user.franchiseId).select("academyId").lean();
          if (franchise?.academyId) {
            academyId = franchise.academyId.toString();
          }
        }

        if (!academyId && mongoose.Types.ObjectId.isValid(userId)) {
          const userObjId = new mongoose.Types.ObjectId(userId);
          const student = await StudentModel.findOne({
            $or: [{ guardianIds: userObjId }, { userId: userObjId }],
            isActive: true,
          })
            .select("franchiseId")
            .lean();

          if (student?.franchiseId) {
            const franchise = await FranchiseModel.findById(student.franchiseId).select("academyId").lean();
            if (franchise?.academyId) {
              academyId = franchise.academyId.toString();
            }
          }
        }

        // Cache resolved academyId on user document for faster future lookups
        if (academyId && mongoose.Types.ObjectId.isValid(userId)) {
          UserModel.updateOne(
            { _id: userId, academyId: { $exists: false } },
            { $set: { academyId: new mongoose.Types.ObjectId(academyId) } }
          ).exec().catch(() => undefined);
        }
      }

      if (!academyId) {
        throw new BadRequestError("Your account isn't linked to an academy");
      }

      const dto = CreateComplaintSchema.parse(req.body);
      const complaint = await this.useCases.create({
        academyId,
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