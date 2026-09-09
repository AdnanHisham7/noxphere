// src/interfaces/http/controllers/PlatformTicketController.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { PlatformTicketUseCases } from "../../../application/use-cases/platformTicket/PlatformTicketUseCases";
import {
  CreatePlatformTicketSchema,
  AddPlatformTicketReplySchema,
  UpdatePlatformTicketStatusSchema,
} from "../../../application/dto/platformTicket.dto";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";
import { BadRequestError, ForbiddenError } from "../../../shared/errors/AppError";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";

export class PlatformTicketController {
  constructor(private useCases: PlatformTicketUseCases) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.role !== "manager" && req.user?.role !== "super_admin") {
        throw new ForbiddenError("Only academy managers can submit platform support tickets");
      }

      let academyId = req.user.academyId;
      const userId = req.user.sub;

      if (!academyId) {
        const user = await UserModel.findById(userId).select("academyId").lean();
        if (user?.academyId) {
          academyId = user.academyId.toString();
        } else {
          const academy = await AcademyModel.findOne({ managerId: new mongoose.Types.ObjectId(userId) })
            .select("_id")
            .lean();
          if (academy) {
            academyId = academy._id.toString();
          }
        }
      }

      if (!academyId) {
        throw new BadRequestError("You must be linked to an academy to submit a platform ticket");
      }

      const dto = CreatePlatformTicketSchema.parse(req.body);
      const ticket = await this.useCases.createTicket({
        userId,
        academyId,
        dto,
      });

      ResponseHandler.created(res, ticket, "Platform ticket submitted successfully");
    } catch (err) {
      next(err);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      let academyId = req.user?.academyId;
      const userId = req.user!.sub;

      if (!academyId) {
        const user = await UserModel.findById(userId).select("academyId").lean();
        if (user?.academyId) {
          academyId = user.academyId.toString();
        } else {
          const academy = await AcademyModel.findOne({ managerId: new mongoose.Types.ObjectId(userId) })
            .select("_id")
            .lean();
          if (academy) {
            academyId = academy._id.toString();
          }
        }
      }

      if (!academyId) {
        return ResponseHandler.success(res, [], "No academy linked");
      }

      const status = req.query.status as string | undefined;
      const tickets = await this.useCases.listMyAcademyTickets(academyId, status);
      ResponseHandler.success(res, tickets, "Platform tickets retrieved");
    } catch (err) {
      next(err);
    }
  };

  listAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.role !== "super_admin") {
        throw new ForbiddenError("Only super administrators can view all platform tickets");
      }

      const { status, priority, category, academyId, search } = req.query as {
        status?: string;
        priority?: string;
        category?: string;
        academyId?: string;
        search?: string;
      };

      const tickets = await this.useCases.listAll({
        status,
        priority,
        category,
        academyId,
        search,
      });

      ResponseHandler.success(res, tickets, "All platform tickets retrieved");
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await this.useCases.getTicketById(req.params.id, {
        sub: req.user!.sub,
        role: req.user!.role,
        academyId: req.user?.academyId,
      });
      ResponseHandler.success(res, ticket, "Platform ticket retrieved");
    } catch (err) {
      next(err);
    }
  };

  reply = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = AddPlatformTicketReplySchema.parse(req.body);
      const ticket = await this.useCases.addReply({
        ticketId: req.params.id,
        user: {
          sub: req.user!.sub,
          role: req.user!.role,
          academyId: req.user?.academyId,
        },
        dto,
      });
      ResponseHandler.success(res, ticket, "Reply sent successfully");
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = UpdatePlatformTicketStatusSchema.parse(req.body);
      const ticket = await this.useCases.updateStatus({
        ticketId: req.params.id,
        user: {
          sub: req.user!.sub,
          role: req.user!.role,
          academyId: req.user?.academyId,
        },
        status: dto.status,
      });
      ResponseHandler.success(res, ticket, "Ticket status updated");
    } catch (err) {
      next(err);
    }
  };
}
