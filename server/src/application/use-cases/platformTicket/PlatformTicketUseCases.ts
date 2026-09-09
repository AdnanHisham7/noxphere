// src/application/use-cases/platformTicket/PlatformTicketUseCases.ts
import mongoose from "mongoose";
import {
  PlatformTicketModel,
  PlatformTicketDocument,
  TicketStatus,
} from "../../../infrastructure/database/models/PlatformTicket.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import {
  CreatePlatformTicketDTO,
  AddPlatformTicketReplyDTO,
} from "../../dto/platformTicket.dto";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../../shared/errors/AppError";
import { notificationService } from "../../../infrastructure/services/NotificationService";

export class PlatformTicketUseCases {
  async createTicket(params: {
    userId: string;
    academyId: string;
    dto: CreatePlatformTicketDTO;
  }): Promise<PlatformTicketDocument> {
    const { userId, academyId, dto } = params;

    const user = await UserModel.findById(userId).select("firstName lastName email role").lean();
    if (!user) {
      throw new NotFoundError("User");
    }

    const academy = await AcademyModel.findById(academyId).select("name").lean();
    if (!academy) {
      throw new NotFoundError("Academy");
    }

    // Generate unique ticket number: PLT-XXXXXX
    let ticketNumber = "";
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      attempts++;
      const rand = Math.floor(100000 + Math.random() * 900000);
      ticketNumber = `PLT-${rand}`;
      const existing = await PlatformTicketModel.findOne({ ticketNumber }).select("_id").lean();
      if (!existing) isUnique = true;
    }

    const senderName = `${user.firstName} ${user.lastName}`.trim();

    const ticket = await PlatformTicketModel.create({
      ticketNumber,
      academyId: new mongoose.Types.ObjectId(academyId),
      academyName: academy.name,
      raisedBy: new mongoose.Types.ObjectId(userId),
      raisedByName: senderName,
      raisedByEmail: user.email,
      subject: dto.subject,
      category: dto.category,
      priority: dto.priority,
      description: dto.description,
      status: "open",
      messages: [
        {
          senderId: new mongoose.Types.ObjectId(userId),
          senderRole: "manager",
          senderName,
          message: dto.description,
          createdAt: new Date(),
        },
      ],
      lastRepliedAt: new Date(),
      lastRepliedBy: new mongoose.Types.ObjectId(userId),
      lastRepliedRole: "manager",
    });

    // Notify Super Admins about new platform issue
    await notificationService.notifySuperAdmins({
      type: "platform_ticket_created",
      title: `Platform Issue: ${ticket.ticketNumber}`,
      body: `${academy.name} (${senderName}) reported: "${dto.subject}"`,
      metadata: {
        ticketId: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        academyId,
      },
    }).catch(() => undefined);

    return ticket;
  }

  async listMyAcademyTickets(
    academyId: string,
    status?: string
  ): Promise<PlatformTicketDocument[]> {
    const filter: Record<string, unknown> = { academyId: new mongoose.Types.ObjectId(academyId) };
    if (status) filter.status = status;
    return PlatformTicketModel.find(filter).sort({ updatedAt: -1, createdAt: -1 });
  }

  async listAll(filters: {
    status?: string;
    priority?: string;
    category?: string;
    academyId?: string;
    search?: string;
  }): Promise<PlatformTicketDocument[]> {
    const query: Record<string, unknown> = {};

    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.category) query.category = filters.category;
    if (filters.academyId && mongoose.Types.ObjectId.isValid(filters.academyId)) {
      query.academyId = new mongoose.Types.ObjectId(filters.academyId);
    }

    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim();
      query.$or = [
        { subject: { $regex: term, $options: "i" } },
        { ticketNumber: { $regex: term, $options: "i" } },
        { academyName: { $regex: term, $options: "i" } },
        { raisedByName: { $regex: term, $options: "i" } },
        { raisedByEmail: { $regex: term, $options: "i" } },
      ];
    }

    return PlatformTicketModel.find(query).sort({ updatedAt: -1, createdAt: -1 });
  }

  async getTicketById(
    ticketId: string,
    user: { sub: string; role: string; academyId?: string }
  ): Promise<PlatformTicketDocument> {
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new BadRequestError("Invalid ticket ID format");
    }

    const ticket = await PlatformTicketModel.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError("Platform ticket");
    }

    if (user.role !== "super_admin") {
      if (!user.academyId || ticket.academyId.toString() !== user.academyId) {
        throw new ForbiddenError("You do not have permission to view this ticket");
      }
    }

    return ticket;
  }

  async addReply(params: {
    ticketId: string;
    user: { sub: string; role: string; academyId?: string };
    dto: AddPlatformTicketReplyDTO;
  }): Promise<PlatformTicketDocument> {
    const { ticketId, user, dto } = params;

    const ticket = await this.getTicketById(ticketId, user);

    const sender = await UserModel.findById(user.sub).select("firstName lastName role").lean();
    const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : "Support Agent";
    const senderRole = user.role === "super_admin" ? "super_admin" : "manager";

    ticket.messages.push({
      _id: new mongoose.Types.ObjectId(),
      senderId: new mongoose.Types.ObjectId(user.sub),
      senderRole,
      senderName,
      message: dto.message,
      createdAt: new Date(),
    } as any);

    ticket.lastRepliedAt = new Date();
    ticket.lastRepliedBy = new mongoose.Types.ObjectId(user.sub);
    ticket.lastRepliedRole = senderRole;

    if (dto.status) {
      ticket.status = dto.status;
      if (dto.status === "resolved") {
        ticket.resolvedAt = new Date();
        ticket.resolvedBy = new mongoose.Types.ObjectId(user.sub);
      }
    } else if (senderRole === "super_admin" && ticket.status === "open") {
      ticket.status = "in_progress";
    }

    await ticket.save();

    // Trigger notifications
    if (senderRole === "super_admin") {
      // Super admin replied -> notify the academy manager who raised it
      await notificationService.send({
        userIds: [ticket.raisedBy.toString()],
        type: "platform_ticket_response",
        title: `Super Admin responded: ${ticket.ticketNumber}`,
        body: dto.message.length > 120 ? `${dto.message.substring(0, 117)}...` : dto.message,
        channels: ["push", "email"],
        data: {
          ticketId: ticket._id.toString(),
          ticketNumber: ticket.ticketNumber,
        },
      }).catch(() => undefined);
    } else {
      // Manager replied -> notify Super Admins
      await notificationService.notifySuperAdmins({
        type: "platform_ticket_response",
        title: `Reply on ${ticket.ticketNumber} (${ticket.academyName})`,
        body: `${senderName}: ${dto.message.length > 120 ? `${dto.message.substring(0, 117)}...` : dto.message}`,
        metadata: {
          ticketId: ticket._id.toString(),
          ticketNumber: ticket.ticketNumber,
        },
      }).catch(() => undefined);
    }

    return ticket;
  }

  async updateStatus(params: {
    ticketId: string;
    user: { sub: string; role: string; academyId?: string };
    status: TicketStatus;
  }): Promise<PlatformTicketDocument> {
    const { ticketId, user, status } = params;

    const ticket = await this.getTicketById(ticketId, user);

    ticket.status = status;
    if (status === "resolved") {
      ticket.resolvedAt = new Date();
      ticket.resolvedBy = new mongoose.Types.ObjectId(user.sub);
    } else if (status === "open" || status === "in_progress") {
      ticket.resolvedAt = undefined;
      ticket.resolvedBy = undefined;
    }

    await ticket.save();

    if (user.role === "super_admin") {
      await notificationService.send({
        userIds: [ticket.raisedBy.toString()],
        type: "platform_ticket_response",
        title: `Ticket Status Updated: ${ticket.ticketNumber}`,
        body: `Your ticket "${ticket.subject}" is now marked as ${status.replace("_", " ")}.`,
        channels: ["push", "email"],
        data: {
          ticketId: ticket._id.toString(),
          ticketNumber: ticket.ticketNumber,
          status,
        },
      }).catch(() => undefined);
    }

    return ticket;
  }
}
