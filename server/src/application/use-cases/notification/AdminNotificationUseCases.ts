// src/application/use-cases/notification/AdminNotificationUseCases.ts
import { NotificationModel, NotificationAudience } from "../../../infrastructure/database/models/Notification.model";
import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { SessionModel } from "../../../infrastructure/database/models/Session.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { NotFoundError, BadRequestError } from "../../../shared/errors/AppError";
import { notificationService } from "../../../infrastructure/services/NotificationService";

export interface CreateNotificationInput {
  franchiseId: string;
  title: string;
  body: string;
  audience: NotificationAudience;
  teamId?: string;
  imageUrl?: string;
  documentUrl?: string;
  documentFilename?: string;
}

export class AdminNotificationUseCases {
  /**
   * Resolves an audience to concrete recipient user ids. Players are
   * never included, under any audience value — "guardians"/"both"/"team"
   * only ever reach a student's guardian account, never the student's own
   * account.
   */
  private async resolveRecipients(franchiseId: string, audience: NotificationAudience, teamId?: string): Promise<string[]> {
    const recipientIds = new Set<string>();

    if (audience === "team") {
      if (!teamId) throw new BadRequestError("teamId is required for the 'team' audience");
      const [team, students] = await Promise.all([
        TeamModel.findOne({ _id: teamId, franchiseId }).select("coachId").lean(),
        StudentModel.find({ teamId, franchiseId, isActive: true }).select("guardianIds").lean(),
      ]);
      if (!team) throw new NotFoundError("Team");
      if (team.coachId) recipientIds.add(team.coachId.toString());
      for (const s of students) for (const g of s.guardianIds) recipientIds.add(g.toString());
      return Array.from(recipientIds);
    }

    if (audience === "guardians" || audience === "both") {
      const students = await StudentModel.find({ franchiseId, isActive: true }).select("guardianIds").lean();
      for (const s of students) for (const g of s.guardianIds) recipientIds.add(g.toString());
    }

    if (audience === "coaches" || audience === "both") {
      // A coach isn't bound to a franchise — "coaches in this franchise"
      // means coaches actually assigned to a team or session here, the
      // same live derivation CoachPortalUseCases.getMyFranchises uses in
      // reverse.
      const [teamCoachIds, sessionCoachIds] = await Promise.all([
        TeamModel.find({ franchiseId, deletedAt: { $exists: false } }).distinct("coachId"),
        SessionModel.find({ franchiseId, deletedAt: { $exists: false } }).distinct("coachId"),
      ]);
      for (const id of [...teamCoachIds, ...sessionCoachIds]) {
        if (id) recipientIds.add(id.toString());
      }
    }

    return Array.from(recipientIds);
  }

  async create(input: CreateNotificationInput, createdBy: string) {
    if (!input.title || !input.body) throw new BadRequestError("title and body are required");

    const recipientIds = await this.resolveRecipients(input.franchiseId, input.audience, input.teamId);

    const notification = await NotificationModel.create({
      franchiseId: input.franchiseId,
      title: input.title,
      body: input.body,
      audience: input.audience,
      teamId: input.teamId,
      imageUrl: input.imageUrl,
      documentUrl: input.documentUrl,
      documentFilename: input.documentFilename,
      createdBy,
      readBy: [],
    });

    if (recipientIds.length > 0) {
      await notificationService.send({
        userIds: recipientIds,
        type: "announcement",
        title: input.title,
        body: input.body,
        franchiseId: input.franchiseId,
        channels: ["push", "whatsapp"],
        whatsappImageUrl: input.imageUrl,
        whatsappDocumentUrl: input.documentUrl,
        whatsappDocumentFilename: input.documentFilename,
      });
    }

    return notification.toJSON();
  }

  async list(franchiseId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      NotificationModel.find({ franchiseId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotificationModel.countDocuments({ franchiseId }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async markRead(id: string, userId: string) {
    const notification = await NotificationModel.findByIdAndUpdate(
      id,
      { $addToSet: { readBy: userId } },
      { new: true },
    );
    if (!notification) throw new NotFoundError("Notification not found");
    return notification.toJSON();
  }
}
