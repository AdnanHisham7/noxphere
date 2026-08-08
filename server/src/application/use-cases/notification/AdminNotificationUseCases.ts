// src/application/use-cases/notification/AdminNotificationUseCases.ts
import { NotificationModel, NotificationAudience } from "../../../infrastructure/database/models/Notification.model";
import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { SessionModel } from "../../../infrastructure/database/models/Session.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
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

    const getFranchiseCoaches = async (fId: string) => {
      const [teamCoachIds, sessionCoachIds] = await Promise.all([
        TeamModel.find({ franchiseId: fId, deletedAt: { $exists: false } }).distinct("coachId"),
        SessionModel.find({ franchiseId: fId, deletedAt: { $exists: false } }).distinct("coachIds"),
      ]);
      const ids: string[] = [];
      for (const id of [...teamCoachIds, ...sessionCoachIds]) {
        if (id) ids.push(id.toString());
      }
      return ids;
    };

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

    if (audience === "players") {
      const students = await StudentModel.find({ franchiseId, isActive: true }).select("userId").lean();
      for (const s of students) if (s.userId) recipientIds.add(s.userId.toString());
    }

    if (audience === "guardians") {
      const students = await StudentModel.find({ franchiseId, isActive: true }).select("guardianIds").lean();
      for (const s of students) for (const g of s.guardianIds) recipientIds.add(g.toString());
    }

    if (audience === "coaches") {
      const coaches = await getFranchiseCoaches(franchiseId);
      for (const c of coaches) recipientIds.add(c);
    }

    if (audience === "managers") {
      const franchise = await FranchiseModel.findById(franchiseId).select("academyId").lean();
      if (franchise) {
        const managers = await UserModel.find({
          role: { $in: ["manager", "super_admin"] },
          academyId: franchise.academyId,
          isActive: true,
        }).select("_id").lean();
        for (const m of managers) recipientIds.add(m._id.toString());
      }
    }

    if (audience === "franchise") {
      // 1. Players & Guardians
      const students = await StudentModel.find({ franchiseId, isActive: true }).select("userId guardianIds").lean();
      for (const s of students) {
        if (s.userId) recipientIds.add(s.userId.toString());
        for (const g of s.guardianIds) recipientIds.add(g.toString());
      }
      // 2. Coaches
      const coaches = await getFranchiseCoaches(franchiseId);
      for (const c of coaches) recipientIds.add(c);
      // 3. Managers
      const franchise = await FranchiseModel.findById(franchiseId).select("academyId").lean();
      if (franchise) {
        const managers = await UserModel.find({
          role: { $in: ["manager", "super_admin"] },
          academyId: franchise.academyId,
          isActive: true,
        }).select("_id").lean();
        for (const m of managers) recipientIds.add(m._id.toString());
      }
    }

    if (audience === "academy") {
      const franchise = await FranchiseModel.findById(franchiseId).select("academyId").lean();
      if (franchise) {
        const siblingFranchises = await FranchiseModel.find({ academyId: franchise.academyId }).select("_id").lean();
        const franchiseIds = siblingFranchises.map((f: any) => f._id);

        // 1. Players & Guardians
        const students = await StudentModel.find({ franchiseId: { $in: franchiseIds }, isActive: true }).select("userId guardianIds").lean();
        for (const s of students) {
          if (s.userId) recipientIds.add(s.userId.toString());
          for (const g of s.guardianIds) recipientIds.add(g.toString());
        }
        // 2. Coaches
        const coachLists = await Promise.all(franchiseIds.map((fId: any) => getFranchiseCoaches(fId.toString())));
        for (const list of coachLists) {
          for (const c of list) recipientIds.add(c);
        }
        // 3. Managers
        const managers = await UserModel.find({
          role: { $in: ["manager", "super_admin"] },
          academyId: franchise.academyId,
          isActive: true,
        }).select("_id").lean();
        for (const m of managers) recipientIds.add(m._id.toString());
      }
    }

    return Array.from(recipientIds);
  }

  async create(input: CreateNotificationInput & { channels?: string[]; attachments?: { name: string; url: string }[] }, createdBy: string) {
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
      attachments: input.attachments,
      channels: input.channels,
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
        channels: (input.channels && input.channels.length > 0 ? input.channels : ["push", "whatsapp"]) as any,
        whatsappImageUrl: input.imageUrl,
        whatsappDocumentUrl: input.documentUrl || (input.attachments && input.attachments[0]?.url),
        whatsappDocumentFilename: input.documentFilename || (input.attachments && input.attachments[0]?.name),
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
