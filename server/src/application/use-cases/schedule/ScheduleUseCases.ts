// src/application/use-cases/schedule/ScheduleUseCases.ts
import mongoose from "mongoose";
import { SessionModel } from "../../../infrastructure/database/models/Session.model";
import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { AttendanceModel } from "../../../infrastructure/database/models/Attendance.model";
import { PerformanceModel } from "../../../infrastructure/database/models/Performance.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import {
  AcademyModel,
  DEFAULT_ACADEMY_SESSION_TYPES,
} from "../../../infrastructure/database/models/Academy.model";
import { AcademySessionType } from "../../../domain/entities/Academy.entity";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { notificationService } from "../../../infrastructure/services/NotificationService";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../../shared/errors/AppError";
import {
  CreateSessionDto,
  UpdateSessionDto,
  ChangeLocationDto,
  CancelSessionDto,
} from "../../dtos/schedule.dto";

export interface MarkAttendanceRecord {
  studentId: string;
  status: "present" | "absent" | "late" | "excused";
  remarks?: string;
}

export interface LogPerformanceRecord {
  studentId: string;
  skillScores: { parameter: string; score: number }[];
  remarks?: string;
  videoUrl?: string;
}

/**
 * Resolves a possibly-populated reference field to a plain id string.
 * A populated ref can arrive here in three shapes depending on whether the
 * referenced model's own toJSON transform ran (it does, since Mongoose
 * calls toJSON on populated sub-documents too):
 *   - an unpopulated raw ObjectId/string -> use it directly
 *   - a populated doc whose transform kept `_id`               -> use _id
 *   - a populated doc whose transform renamed `_id` to `id`     -> use id
 * (User and Team both rename _id -> id in their toJSON transform, which
 * is why checking only `_id` here previously produced the literal string
 * "[object Object]" for every populated coachId/teamId.)
 */
function resolveRefId(value: any): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (value.id) return value.id.toString();
  return value.toString();
}

function toCard(doc: any) {
  const json = doc.toJSON ? doc.toJSON() : doc;
  return {
    id: json.id || json._id?.toString(),
    franchiseId: json.franchiseId?.toString ? json.franchiseId.toString() : json.franchiseId,
    academyId: json.academyId?.toString ? json.academyId.toString() : json.academyId,
    targetType: json.targetType ?? "team",
    teamId: resolveRefId(json.teamId),
    category: json.category ?? json.teamId?.ageGroup ?? undefined,
    teamName: json.teamId?.name ?? undefined,
    categoryColor: "#ccff00",
    coach: json.coachId?.firstName
      ? `${json.coachId.firstName} ${json.coachId.lastName ?? ""}`.trim()
      : undefined,
    coachId: resolveRefId(json.coachId),
    coachIds: (json.coachIds || []).map((id: any) => resolveRefId(id) || id?.toString()).filter(Boolean),
    coaches: (json.coachIds || []).map((c: any) => c.firstName ? `${c.firstName} ${c.lastName || ""}`.trim() : (c.name || resolveRefId(c) || c.toString())).filter(Boolean),
    categories: json.categories ?? [],
    startDate: json.startDate,
    endDate: json.endDate,
    dailyStartTime: json.dailyStartTime,
    dailyEndTime: json.dailyEndTime,
    playerIds: json.playerIds?.map((id: any) => id._id?.toString() || id.toString() || id) ?? [],
    rosterPlayerIds: json.rosterPlayerIds?.map((id: any) => id._id?.toString() || id.toString() || id) ?? [],
    documents: json.documents ?? [],
    type: json.type,
    date: json.date,
    startTime: json.startTime,
    endTime: json.endTime,
    location: json.location,
    fieldNumber: json.fieldNumber,
    pitchId: json.pitchId,
    googleMapsUrl: json.googleMapsUrl,
    latitude: json.latitude,
    longitude: json.longitude,
    status: json.status,
    notes: json.notes,
    cancelReason: json.cancelReason,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

export class ScheduleUseCases {
  async listSessions(filters: {
    franchiseId?: string;
    academyId?: string;
    from?: string;
    to?: string;
    teamId?: string;
    coachId?: string;
    status?: string;
  }) {
    const conditions: any[] = [];

    if (filters.teamId) {
      // Querying all sessions for a specific team/squad
      conditions.push({ teamId: filters.teamId });
    } else if (filters.franchiseId) {
      const franchise = await FranchiseModel.findById(filters.franchiseId).select("academyId").lean();
      if (franchise?.academyId) {
        // When viewing a branch schedule, show branch sessions AND academy team events!
        conditions.push({
          $or: [
            { franchiseId: filters.franchiseId },
            { academyId: franchise.academyId, targetType: "team" },
          ],
        });
      } else {
        conditions.push({ franchiseId: filters.franchiseId });
      }
    } else if (filters.academyId) {
      const franchises = await FranchiseModel.find({ academyId: filters.academyId }).select("_id").lean();
      const franchiseIds = franchises.map((f) => f._id);
      conditions.push({
        $or: [
          { franchiseId: { $in: franchiseIds } },
          { academyId: filters.academyId },
        ],
      });
    } else if (filters.coachId) {
      // Allowed for a coach querying their assigned sessions across franchises
    } else {
      throw new BadRequestError("franchiseId, academyId or teamId is required");
    }
    if (filters.coachId) {
      const coachIdStr = filters.coachId.toString();
      const coachObjId = mongoose.isValidObjectId(coachIdStr) ? new mongoose.Types.ObjectId(coachIdStr) : null;
      const coachConditions: any[] = [{ coachId: coachIdStr }, { coachIds: coachIdStr }];
      if (coachObjId) {
        coachConditions.push({ coachId: coachObjId }, { coachIds: coachObjId });
      }
      conditions.push({ $or: coachConditions });
    }
    if (filters.status) conditions.push({ status: filters.status });
    if (filters.from || filters.to) {
      conditions.push({
        date: {
          ...(filters.from && { $gte: filters.from }),
          ...(filters.to && { $lte: filters.to }),
        },
      });
    }

    const query = conditions.length === 1 ? conditions[0] : conditions.length > 1 ? { $and: conditions } : {};
    const sessions = await SessionModel.find(query)
      .populate("coachId", "firstName lastName")
      .populate("coachIds", "firstName lastName")
      .populate("teamId", "name ageGroup")
      .sort({ date: -1, startTime: -1, createdAt: -1 })
      .lean();
    return sessions.map(toCard);
  }

  async getSessionById(id: string) {
    const session = await SessionModel.findById(id)
      .populate("teamId", "name ageGroup")
      .populate("coachId", "firstName lastName")
      .populate("coachIds", "firstName lastName");
    if (!session) throw new NotFoundError("Session");
    return toCard(session);
  }

  /**
   * @param requestingCoachId Set only when the request originated from a
   * coach (never from a manager/super_admin). When present, this method
   * enforces the two rules that make up "a coach can only create sessions
   * for their own team": category-wide sessions are rejected outright, and
   * a team-type session is rejected unless that exact team's assigned
   * coach is this coach. This is enforced here — not just in the
   * controller — so the rule holds no matter what calls this use-case.
   */
  // A manager can mark a coach unavailable for a day of the week
  // (weeklyAvailability) or a specific date (customUnavailableDates).
  // The session-assignment UI disables picking such a coach for a
  // conflicting date, but this backend check exists too so the same
  // rule holds for any direct API call, not just the form. A coach with
  // no weeklyAvailability configured at all is treated as always
  // available — nothing has been set for them to conflict with.
  private async assertCoachesAvailable(coachIds: string[], dates: string[]): Promise<void> {
    const uniqueCoachIds = Array.from(new Set(coachIds.filter(Boolean)));
    if (uniqueCoachIds.length === 0 || dates.length === 0) return;

    const coaches = await UserModel.find({ _id: { $in: uniqueCoachIds } })
      .select("firstName lastName weeklyAvailability customUnavailableDates")
      .lean();

    for (const coach of coaches) {
      const hasWeeklyRules = (coach.weeklyAvailability?.length ?? 0) > 0;
      const unavailableDates = new Set(coach.customUnavailableDates ?? []);
      const availableDays = new Set((coach.weeklyAvailability ?? []).map((wa) => wa.dayOfWeek));
      const coachName = `${coach.firstName} ${coach.lastName}`;

      for (const dateStr of dates) {
        if (unavailableDates.has(dateStr)) {
          throw new BadRequestError(`${coachName} has been marked unavailable on ${dateStr}`);
        }
        if (hasWeeklyRules) {
          const [year, month, day] = dateStr.split("-").map(Number);
          const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
          if (!availableDays.has(dayOfWeek)) {
            throw new BadRequestError(`${coachName} isn't available on that day of the week`);
          }
        }
      }
    }
  }

  async createSession(dto: CreateSessionDto & { coachIds?: string[]; categories?: string[]; startDate?: string; endDate?: string; dailyStartTime?: string; dailyEndTime?: string; playerIds?: string[]; documents?: { name: string; url: string }[] }, createdBy: string, requestingCoachId?: string) {
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestError("endTime must be after startTime");
    }
    if (!dto.coachId && (!dto.coachIds || dto.coachIds.length === 0)) {
      throw new BadRequestError("coachId or coachIds are required");
    }
    if (dto.coachIds && dto.coachIds.length > 0 && !dto.coachId) {
      dto.coachId = dto.coachIds[0];
    }
    if (requestingCoachId && dto.targetType === "category") {
      throw new ForbiddenError("Coaches can only schedule sessions for a team they are assigned to");
    }

    if (dto.targetType === "batch") {
      if (!dto.playerIds || dto.playerIds.length === 0) {
        throw new BadRequestError("playerIds are required for a batch session");
      }
    } else if (dto.targetType === "category") {
      if (!dto.category && (!dto.categories || dto.categories.length === 0)) {
        throw new BadRequestError("category or categories are required for a category session");
      }
      if (dto.categories && dto.categories.length > 0 && !dto.category) {
        dto.category = dto.categories[0];
      }
      const franchise = await FranchiseModel.findById(dto.franchiseId).select("_id").lean();
      if (!franchise) throw new NotFoundError("Franchise");
    } else {
      if (!dto.teamId) throw new BadRequestError("teamId is required for a team session");
      const team = await TeamModel.findById(dto.teamId);
      if (!team) throw new NotFoundError("Team");
      if (team.academyId && !dto.academyId) {
        dto.academyId = team.academyId.toString();
      }
      if (requestingCoachId && team.coachId?.toString() !== requestingCoachId) {
        throw new ForbiddenError("You can only schedule sessions for a team assigned to you");
      }
    }

    let resolvedPlayerIds: any[] = [];
    const activeStudentFilter = {
      isActive: true,
      deletedAt: { $exists: false },
      status: { $nin: ["inactive", "on_leave", "graduated", "dropped_out"] },
    };

    if (dto.targetType === "batch") {
      const candidateIds = (dto.playerIds || []).map((id) => new mongoose.Types.ObjectId(id));
      const validStudents = await StudentModel.find({
        _id: { $in: candidateIds },
        ...activeStudentFilter,
      }).select("_id").lean();
      resolvedPlayerIds = validStudents.map((s) => s._id);
    } else if (dto.targetType === "category") {
      const categoriesFilter = dto.categories && dto.categories.length > 0 ? { $in: dto.categories } : dto.category;
      const baseStudents = await StudentModel.find({
        franchiseId: dto.franchiseId,
        ageGroup: categoriesFilter,
        ...activeStudentFilter,
      }).select("_id").lean();
      resolvedPlayerIds = baseStudents.map((s) => s._id);
    } else {
      const teamObjId = mongoose.isValidObjectId(dto.teamId)
        ? new mongoose.Types.ObjectId(dto.teamId)
        : dto.teamId;
      const baseStudents = await StudentModel.find({
        $or: [{ teamId: teamObjId }, { teamIds: teamObjId }],
        ...activeStudentFilter,
      }).select("_id").lean();
      resolvedPlayerIds = baseStudents.map((s) => s._id);
    }

    let datesToCreate: string[] = [dto.date];
    if (dto.startDate && dto.endDate && dto.startDate !== dto.endDate) {
      const [startYear, startMonth, startDay] = dto.startDate.split("-").map(Number);
      const [endYear, endMonth, endDay] = dto.endDate.split("-").map(Number);
      
      let currentDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
      const endDateUTC = new Date(Date.UTC(endYear, endMonth - 1, endDay));
      const selectedDays = dto.daysOfWeek && dto.daysOfWeek.length > 0 ? new Set(dto.daysOfWeek) : null;
      
      datesToCreate = [];
      while (currentDate <= endDateUTC) {
        const dayOfWeek = currentDate.getUTCDay();
        if (!selectedDays || selectedDays.has(dayOfWeek)) {
          const year = currentDate.getUTCFullYear();
          const month = String(currentDate.getUTCMonth() + 1).padStart(2, "0");
          const day = String(currentDate.getUTCDate()).padStart(2, "0");
          datesToCreate.push(`${year}-${month}-${day}`);
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
      if (datesToCreate.length === 0) {
        throw new BadRequestError("No matching days found in the selected date range");
      }
    }

    await this.assertCoachesAvailable(dto.coachIds && dto.coachIds.length > 0 ? dto.coachIds : [dto.coachId!], datesToCreate);

    const sessionsToCreate = datesToCreate.map((dateStr) => ({
      franchiseId: dto.franchiseId || undefined,
      academyId: dto.academyId || undefined,
      targetType: dto.targetType,
      teamId: dto.targetType === "team" ? dto.teamId : undefined,
      category: dto.targetType === "category" ? dto.category : undefined,
      categories: dto.categories || (dto.category ? [dto.category] : []),
      coachId: dto.coachId,
      coachIds: dto.coachIds || [dto.coachId],
      type: dto.type,
      date: dateStr,
      startTime: dto.dailyStartTime || dto.startTime,
      endTime: dto.dailyEndTime || dto.endTime,
      startDate: dateStr,
      endDate: dateStr,
      dailyStartTime: dto.dailyStartTime || dto.startTime,
      dailyEndTime: dto.dailyEndTime || dto.endTime,
      daysOfWeek: dto.daysOfWeek,
      location: dto.location,
      fieldNumber: dto.fieldNumber,
      pitchId: dto.pitchId,
      googleMapsUrl: dto.googleMapsUrl,
      latitude: dto.latitude,
      longitude: dto.longitude,
      notes: dto.notes,
      playerIds: resolvedPlayerIds.map((id) => id.toString()),
      rosterPlayerIds: resolvedPlayerIds,
      documents: dto.documents,
      createdBy,
      status: "upcoming",
    }));

    const createdSessions = await SessionModel.create(sessionsToCreate);
    const firstSession = createdSessions[0];

    const populated = await SessionModel.findById(firstSession.id)
      .populate("teamId", "name ageGroup")
      .populate("coachId", "firstName lastName")
      .populate("coachIds", "firstName lastName");

    const sessionDate = new Date(dto.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    const categoryLabel = dto.categories && dto.categories.length > 0 ? dto.categories.join(", ") : dto.category;
    const target =
      dto.targetType === "team"
        ? (populated?.teamId as any)?.name
        : dto.targetType === "batch"
        ? "custom batch squad"
        : `${categoryLabel} squad`;

    // A coach scheduling their own session already knows about it —
    // notify any assigned coach who did not create it.
    const allAssignedCoachIds = Array.from(
      new Set([
        ...(dto.coachIds || []),
        ...(dto.coachId ? [dto.coachId] : []),
      ])
    ).filter(Boolean);

    const coachesToNotify = allAssignedCoachIds.filter(
      (cid) => cid !== requestingCoachId && cid !== createdBy
    );

    for (const cid of coachesToNotify) {
      await notificationService
        .sendSessionCreatedAlert(
          cid,
          `A new session has been scheduled for ${target ?? "your squad"} on ${sessionDate}, ${dto.startTime}–${dto.endTime} at ${dto.location}.`,
          dto.franchiseId || "",
        )
        .catch(() => undefined);
    }

    // Whoever creates the session (manager, super_admin, or coach), all players assigned/included
    // in the session (and their guardians) must be alerted of the scheduled session.
    if (resolvedPlayerIds.length > 0) {
      const students = await StudentModel.find({ _id: { $in: resolvedPlayerIds } })
        .select("userId guardianIds firstName")
        .lean();
      const recipientUserIds = Array.from(
        new Set(
          students.flatMap((s) => [s.userId?.toString(), ...(s.guardianIds || []).map((g: any) => g.toString())]).filter(Boolean)
        )
      );
      if (recipientUserIds.length > 0) {
        await notificationService.send({
          userIds: recipientUserIds,
          type: "session_created",
          title: "New Session Scheduled",
          body: `A new session has been scheduled for ${target ?? "your squad"} on ${sessionDate}, ${dto.startTime}–${dto.endTime} at ${dto.location}.`,
          data: { sessionId: (populated?._id || firstSession._id || firstSession.id).toString() },
          franchiseId: dto.franchiseId,
          channels: ["push"],
        }).catch(() => undefined);
      }
    }

    return toCard(populated);
  }

  async updateSession(id: string, dto: UpdateSessionDto & { coachIds?: string[]; categories?: string[]; startDate?: string; endDate?: string; dailyStartTime?: string; dailyEndTime?: string; playerIds?: string[]; documents?: { name: string; url: string }[] }) {
    const session = await SessionModel.findById(id);
    if (!session) throw new NotFoundError("Session");
    if (dto.startTime && dto.endTime && dto.endTime <= dto.startTime) {
      throw new BadRequestError("endTime must be after startTime");
    }
    if (dto.coachIds && dto.coachIds.length > 0) {
      dto.coachId = dto.coachIds[0];
    }
    if (dto.coachId || (dto.coachIds && dto.coachIds.length > 0)) {
      const nextCoachIds = dto.coachIds && dto.coachIds.length > 0 ? dto.coachIds : [dto.coachId!];
      const sessionDate = dto.date ?? session.date;
      await this.assertCoachesAvailable(nextCoachIds, [sessionDate]);
    }
    if (dto.categories && dto.categories.length > 0) {
      dto.category = dto.categories[0];
    }
    const targetType = dto.targetType ?? session.targetType;
    if (targetType === "category") {
      const activeFranchiseId = dto.franchiseId ?? session.franchiseId;
      const cats = dto.categories && dto.categories.length > 0 ? dto.categories : (dto.category ? [dto.category] : session.categories);
      const catFilter = cats && cats.length > 0 ? { $in: cats } : (dto.category ?? session.category);
      if (catFilter) {
        const matchingStudents = await StudentModel.find({
          franchiseId: activeFranchiseId,
          ageGroup: catFilter,
          isActive: true,
          deletedAt: { $exists: false },
        }).select("_id").lean();
        const resolvedIds = matchingStudents.map((s) => s._id);
        (dto as any).rosterPlayerIds = resolvedIds;
        (dto as any).playerIds = resolvedIds.map((id) => id.toString());
      }
    } else if (targetType === "team") {
      const activeTeamId = dto.teamId ?? session.teamId;
      if (activeTeamId) {
        const teamObjId = mongoose.isValidObjectId(activeTeamId)
          ? new mongoose.Types.ObjectId(activeTeamId.toString())
          : activeTeamId;
        const matchingStudents = await StudentModel.find({
          $or: [{ teamId: teamObjId }, { teamIds: teamObjId }],
          isActive: true,
          deletedAt: { $exists: false },
        }).select("_id").lean();
        const resolvedIds = matchingStudents.map((s) => s._id);
        (dto as any).rosterPlayerIds = resolvedIds;
        (dto as any).playerIds = resolvedIds.map((id) => id.toString());
      }
    }
    Object.assign(session, dto);
    await session.save();
    const populated = await SessionModel.findById(id)
      .populate("teamId", "name ageGroup")
      .populate("coachId", "firstName lastName")
      .populate("coachIds", "firstName lastName");
    return toCard(populated);
  }

  async cancelSession(id: string, dto: CancelSessionDto) {
    const session = await SessionModel.findById(id);
    if (!session) throw new NotFoundError("Session");
    session.status = "cancelled";
    session.cancelReason = dto.reason;
    await session.save();
    await this.notifySessionGuardians(session, {
      title: "Session cancelled",
      body: `The ${session.date} session at ${session.location} has been cancelled. Reason: ${dto.reason}`,
      type: "session_location_change",
    });
    const populated = await SessionModel.findById(id)
      .populate("teamId", "name ageGroup")
      .populate("coachId", "firstName lastName");
    return toCard(populated);
  }

  async deleteSession(id: string): Promise<void> {
    const session = await SessionModel.findByIdAndUpdate(id, { deletedAt: new Date() });
    if (!session) throw new NotFoundError("Session");
  }

  async changeLocation(id: string, dto: ChangeLocationDto) {
    const session = await SessionModel.findById(id);
    if (!session) throw new NotFoundError("Session");
    session.location = dto.location;
    if (dto.fieldNumber !== undefined) session.fieldNumber = dto.fieldNumber;
    if (dto.pitchId !== undefined) session.pitchId = dto.pitchId;
    if (dto.googleMapsUrl !== undefined) session.googleMapsUrl = dto.googleMapsUrl;
    if (dto.latitude !== undefined) session.latitude = dto.latitude;
    if (dto.longitude !== undefined) session.longitude = dto.longitude;
    await session.save();

    if (dto.notifyGuardians) {
      await this.notifySessionGuardians(session, {
        title: "Session location changed",
        body: `The ${session.date} session is now at ${dto.location}${dto.fieldNumber ? ` (${dto.fieldNumber})` : ""}.`,
        type: "session_location_change",
      });
    }
    const populated = await SessionModel.findById(id)
      .populate("teamId", "name ageGroup")
      .populate("coachId", "firstName lastName");
    return toCard(populated);
  }

  async alertAllGuardians(franchiseId: string, message: string) {
    const students = await StudentModel.find({ franchiseId, isActive: true });
    const guardianIds = Array.from(
      new Set(students.flatMap((s) => s.guardianIds.map((g) => g.toString()))),
    );
    if (guardianIds.length === 0) return { notified: 0 };
    await notificationService.send({
      userIds: guardianIds,
      type: "session_location_change",
      title: "Schedule update",
      body: message,
      franchiseId,
      channels: ["push"],
    });
    return { notified: guardianIds.length };
  }

  /**
   * Performance skill parameters are owned by the Academy record (defined
   * there by the manager), not by the Franchise — every session belongs to
   * a franchise, and every franchise belongs to exactly one academy, so we
   * resolve franchise -> academy to find the parameter list that's allowed
   * to be scored against. Guaranteed to reflect the 6 skill parameters
   * established when the parent academy was created. Falls back to the
   * platform default set if neither record carries any.
   */
  /**
   * Resolves the academy's dynamic session types and the specific submetrics
   * belonging to this session's type. If the session type matches one of the
   * academy's configured session types, its submetrics are returned for evaluation.
   * Falls back gracefully to standard defaults if unconfigured.
   */
  private async getSessionTypesAndSkills(
    sessionType?: string,
    franchiseId?: mongoose.Types.ObjectId | string,
    academyId?: mongoose.Types.ObjectId | string,
  ): Promise<{ skillParameters: string[]; sessionTypes: AcademySessionType[]; currentSessionType?: string }> {
    let academy: any = null;
    if (academyId) {
      academy = await AcademyModel.findById(academyId).select("skillParameters sessionTypes").lean();
    } else if (franchiseId) {
      const franchise = await FranchiseModel.findById(franchiseId).select("academyId").lean();
      if (franchise?.academyId) {
        academy = await AcademyModel.findById(franchise.academyId).select("skillParameters sessionTypes").lean();
      }
    }

    const sessionTypes: AcademySessionType[] =
      academy?.sessionTypes && academy.sessionTypes.length > 0
        ? academy.sessionTypes
        : DEFAULT_ACADEMY_SESSION_TYPES;

    if (sessionType) {
      const target = sessionType.toLowerCase().trim();
      const matched = sessionTypes.find(
        (st) => st.id.toLowerCase() === target || st.name.toLowerCase() === target
      );
      if (matched && matched.submetrics && matched.submetrics.length > 0) {
        return { skillParameters: matched.submetrics, sessionTypes, currentSessionType: matched.name };
      }
      // Common aliases fallback
      if (target.includes("fit") || target.includes("phys")) {
        const phys = sessionTypes.find((s) => s.id === "physical" || s.name.toLowerCase() === "physical");
        if (phys) return { skillParameters: phys.submetrics, sessionTypes, currentSessionType: phys.name };
      }
      if (target.includes("tech") || target.includes("train")) {
        const tech = sessionTypes.find((s) => s.id === "technical" || s.name.toLowerCase() === "technical");
        if (tech) return { skillParameters: tech.submetrics, sessionTypes, currentSessionType: tech.name };
      }
      if (target.includes("match")) {
        const match = sessionTypes.find((s) => s.id === "match" || s.name.toLowerCase() === "match");
        if (match) return { skillParameters: match.submetrics, sessionTypes, currentSessionType: match.name };
      }
      if (target.includes("tact")) {
        const tact = sessionTypes.find((s) => s.id === "tactical" || s.name.toLowerCase() === "tactical");
        if (tact) return { skillParameters: tact.submetrics, sessionTypes, currentSessionType: tact.name };
      }
      if (target.includes("ment") || target.includes("psych")) {
        const ment = sessionTypes.find((s) => s.id === "mental" || s.name.toLowerCase() === "mental");
        if (ment) return { skillParameters: ment.submetrics, sessionTypes, currentSessionType: ment.name };
      }
    }

    // Default to the first session type's submetrics if present
    if (sessionTypes.length > 0 && sessionTypes[0].submetrics.length > 0) {
      return { skillParameters: sessionTypes[0].submetrics, sessionTypes, currentSessionType: sessionTypes[0].name };
    }

    const fallbackSkills = academy?.skillParameters?.length
      ? academy.skillParameters
      : ["Dribbling", "Passing", "Shooting", "Speed", "Tactical Awareness", "Attitude"];

    return { skillParameters: fallbackSkills, sessionTypes, currentSessionType: sessionType };
  }

  /**
   * The roster for a session: every student on that session's team, merged
   * with whatever attendance/performance has already been recorded for
   * this exact session. Also returns the dynamic skill parameters for
   * this session's type.
   */
  async getSessionRoster(sessionId: string) {
    const session = await SessionModel.findById(sessionId)
      .populate("teamId", "name ageGroup")
      .populate("coachId", "firstName lastName")
      .populate("coachIds", "firstName lastName");
    if (!session) throw new NotFoundError("Session");

    const studentQuery: any = { isActive: true, deletedAt: { $exists: false } };
    if (session.rosterPlayerIds !== undefined && session.rosterPlayerIds.length > 0) {
      const allRosterPlayerIds = [...(session.rosterPlayerIds || []), ...(session.playerIds || [])];
      studentQuery._id = { $in: allRosterPlayerIds };
    } else {
      const categoriesFilter = session.categories && session.categories.length > 0 ? { $in: session.categories } : session.category;
      const playerQueryList = session.playerIds && session.playerIds.length > 0 ? { _id: { $in: session.playerIds } } : null;

      if (session.targetType === "category") {
        const defaultFilter = { franchiseId: session.franchiseId, ageGroup: categoriesFilter };
        studentQuery.$or = playerQueryList ? [defaultFilter, playerQueryList] : [defaultFilter];
      } else {
        const teamObjId = session.teamId
          ? (mongoose.isValidObjectId(session.teamId) ? new mongoose.Types.ObjectId(session.teamId.toString()) : session.teamId)
          : null;
        const defaultFilter = { $or: [{ teamId: teamObjId }, { teamIds: teamObjId }] };
        studentQuery.$or = playerQueryList ? [defaultFilter, playerQueryList] : [defaultFilter];
      }
    }

    const students = await StudentModel.find(studentQuery)
      .select("firstName lastName photo position jerseyNumber teamId")
      .sort({ firstName: 1 })
      .lean();

    const [attendance, performance, sessionSkillsInfo] = await Promise.all([
      AttendanceModel.find({ sessionId }).lean(),
      PerformanceModel.find({ sessionId }).lean(),
      this.getSessionTypesAndSkills(session.type, session.franchiseId, session.academyId),
    ]);
    const attendanceByStudent = new Map(attendance.map((a) => [a.studentId.toString(), a]));
    const performanceByStudent = new Map(performance.map((p) => [p.studentId.toString(), p]));

    return {
      session: toCard(session),
      sessionType: sessionSkillsInfo.currentSessionType || session.type,
      skillParameters: sessionSkillsInfo.skillParameters,
      sessionTypes: sessionSkillsInfo.sessionTypes,
      roster: students.map((s) => {
        const att = attendanceByStudent.get(s._id.toString());
        const perf = performanceByStudent.get(s._id.toString());
        return {
          studentId: s._id.toString(),
          firstName: s.firstName,
          lastName: s.lastName,
          photo: s.photo,
          position: s.position,
          jerseyNumber: s.jerseyNumber,
          attendanceStatus: att?.status ?? null,
          attendanceRemarks: att?.remarks ?? null,
          performanceRecorded: !!perf,
          skillScores: perf?.skillScores ?? null,
          overallScore: perf?.overallScore ?? null,
          performanceRemarks: perf?.remarks ?? null,
        };
      }),
    };
  }

  /**
   * Bulk-mark attendance for a session's roster. This is the only path to
   * write attendance — it always requires a real, non-cancelled scheduled
   * session, so attendance can never be recorded for a date/team that was
   * never actually scheduled.
   */
  async markSessionAttendance(sessionId: string, records: MarkAttendanceRecord[], coachId: string) {
    if (!records.length) throw new BadRequestError("At least one attendance record is required");
    const session = await SessionModel.findById(sessionId);
    if (!session) throw new NotFoundError("Session");
    if (session.status === "cancelled") {
      throw new BadRequestError("This session was cancelled — attendance can't be marked for it");
    }

    // Resolve full roster of students to ensure attendance is mandatory for all athletes
    const studentQuery: any = { isActive: true, deletedAt: { $exists: false } };
    if (session.rosterPlayerIds !== undefined && session.rosterPlayerIds.length > 0) {
      const allRosterPlayerIds = [...(session.rosterPlayerIds || []), ...(session.playerIds || [])];
      studentQuery._id = { $in: allRosterPlayerIds };
    } else {
      const categoriesFilter = session.categories && session.categories.length > 0 ? { $in: session.categories } : session.category;
      const playerQueryList = session.playerIds && session.playerIds.length > 0 ? { _id: { $in: session.playerIds } } : null;

      if (session.targetType === "category") {
        const defaultFilter = { franchiseId: session.franchiseId, ageGroup: categoriesFilter };
        studentQuery.$or = playerQueryList ? [defaultFilter, playerQueryList] : [defaultFilter];
      } else {
        const teamObjId = session.teamId
          ? (mongoose.isValidObjectId(session.teamId) ? new mongoose.Types.ObjectId(session.teamId.toString()) : session.teamId)
          : null;
        const defaultFilter = { $or: [{ teamId: teamObjId }, { teamIds: teamObjId }] };
        studentQuery.$or = playerQueryList ? [defaultFilter, playerQueryList] : [defaultFilter];
      }
    }

    const students = await StudentModel.find(studentQuery)
      .select("_id firstName lastName teamId franchiseId")
      .lean();

    if (students.length > 0) {
      const markedIds = new Set(
        records
          .filter((r) => r.status && ["present", "absent", "late", "excused"].includes(r.status))
          .map((r) => r.studentId.toString())
      );
      const missing = students.filter((s) => !markedIds.has(s._id.toString()));
      if (missing.length > 0) {
        throw new BadRequestError(
          `Attendance is mandatory for all roster athletes before saving. Missing attendance status for ${missing.length} athlete(s).`
        );
      }
    }

    const studentTeamMap = new Map<string, mongoose.Types.ObjectId | undefined>();
    const studentFranchiseMap = new Map<string, mongoose.Types.ObjectId | undefined>();
    for (const s of students) {
      if (s.teamId) studentTeamMap.set(s._id.toString(), s.teamId);
      if (s.franchiseId) studentFranchiseMap.set(s._id.toString(), s.franchiseId);
    }

    const ops = records.map((r) => ({
      updateOne: {
        filter: {
          studentId: new mongoose.Types.ObjectId(r.studentId),
          sessionId: new mongoose.Types.ObjectId(sessionId),
        },
        update: {
          $set: {
            studentId: new mongoose.Types.ObjectId(r.studentId),
            franchiseId: session.franchiseId || studentFranchiseMap.get(r.studentId),
            teamId: session.targetType === "team" ? session.teamId : studentTeamMap.get(r.studentId),
            coachId: new mongoose.Types.ObjectId(coachId),
            sessionId: new mongoose.Types.ObjectId(sessionId),
            sessionDate: new Date(session.date),
            status: r.status,
            remarks: r.remarks,
            markedBy: coachId,
          },
        },
        upsert: true,
      },
    }));
    await AttendanceModel.bulkWrite(ops);

    // keep the denormalised attendancePercentage on Student roughly current
    for (const r of records) {
      const [total, present] = await Promise.all([
        AttendanceModel.countDocuments({ studentId: r.studentId }),
        AttendanceModel.countDocuments({
          studentId: r.studentId,
          status: { $in: ["present", "late"] },
        }),
      ]);
      await StudentModel.updateOne(
        { _id: r.studentId },
        { $set: { attendancePercentage: total ? Math.round((present / total) * 100) : 0 } },
      );
    }

    // Marking attendance means the session took place — close it out.
    if (session.status === "upcoming" || session.status === "ongoing") {
      session.status = "completed";
      await session.save();
    }

    // Notify guardians of absent/late players for this session.
    const absentOrLate = records.filter((r) => r.status === "absent" || r.status === "late");
    for (const r of absentOrLate) {
      const student = await StudentModel.findById(r.studentId);
      if (!student || student.guardianIds.length === 0) continue;
      await notificationService
        .sendAttendanceAlert(
          student.guardianIds.map((g) => g.toString()),
          `${student.firstName} ${student.lastName}`,
          r.status as "absent" | "late",
          session.franchiseId ? session.franchiseId.toString() : "",
        )
        .catch(() => undefined);
    }

    // Scenario: N consecutive absent days (N = academy.absentAlertDays,
    // default 5) triggers a separate, stronger "repeated absence" alert
    // to guardians — distinct from the per-session absent notification
    // above. This only fires guardians for students actually marked
    // absent just now, and only once per streak (a record's
    // guardianNotified flag stops it firing again on every subsequent
    // absence once the streak has already been reported).
    const justAbsent = records.filter((r) => r.status === "absent");
    if (justAbsent.length > 0) {
      const franchise = await FranchiseModel.findById(session.franchiseId).select("academyId").lean();
      const academy = franchise ? await AcademyModel.findById(franchise.academyId).select("absentAlertDays").lean() : null;
      const threshold = academy?.absentAlertDays ?? 5;

      for (const r of justAbsent) {
        const recentRecords = await AttendanceModel.find({ studentId: r.studentId })
          .sort({ sessionDate: -1 })
          .limit(threshold)
          .lean();
        if (recentRecords.length < threshold) continue;
        const allAbsent = recentRecords.every((rec) => rec.status === "absent");
        const alreadyNotifiedForStreak = recentRecords.some((rec) => rec.guardianNotified);
        if (!allAbsent || alreadyNotifiedForStreak) continue;

        const student = await StudentModel.findById(r.studentId);
        if (!student || student.guardianIds.length === 0) continue;

        await notificationService
          .sendRepeatedAbsenceAlert(
            student.guardianIds.map((g) => g.toString()),
            `${student.firstName} ${student.lastName}`,
            threshold,
            session.franchiseId ? session.franchiseId.toString() : "",
          )
          .catch(() => undefined);

        await AttendanceModel.updateMany(
          { _id: { $in: recentRecords.map((rec) => rec._id) } },
          { $set: { guardianNotified: true } },
        );
      }
    }

    return this.getSessionRoster(sessionId);
  }

  /**
   * Bulk-log performance for a session's roster. Same constraint as
   * attendance — always tied to a real, non-cancelled scheduled session.
   */
  async logSessionPerformance(sessionId: string, records: LogPerformanceRecord[], coachId: string) {
    if (!records.length) throw new BadRequestError("At least one performance record is required");
    const session = await SessionModel.findById(sessionId);
    if (!session) throw new NotFoundError("Session");
    if (session.status === "cancelled") {
      throw new BadRequestError("This session was cancelled — performance can't be logged for it");
    }

    const { skillParameters: typeParameters, sessionTypes } = await this.getSessionTypesAndSkills(
      session.type,
      session.franchiseId,
      session.academyId
    );
    // Allow any parameter configured for this session type, or anywhere in the academy's session types
    const allAllowed = Array.from(new Set([
      ...typeParameters,
      ...sessionTypes.flatMap((st) => st.submetrics),
    ]));
    const allowedSet = new Set(allAllowed);

    const students = await StudentModel.find({ _id: { $in: records.map((r) => r.studentId) } })
      .select("teamId franchiseId")
      .lean();
    const studentTeamMap = new Map<string, mongoose.Types.ObjectId | undefined>();
    const studentFranchiseMap = new Map<string, mongoose.Types.ObjectId | undefined>();
    for (const s of students) {
      if (s.teamId) studentTeamMap.set(s._id.toString(), s.teamId);
      if (s.franchiseId) studentFranchiseMap.set(s._id.toString(), s.franchiseId);
    }

    for (const r of records) {
      if (!r.skillScores.length) {
        throw new BadRequestError(`At least one skill score is required for student ${r.studentId}`);
      }
      const invalidParams = r.skillScores
        .map((s) => s.parameter)
        .filter((p) => !allowedSet.has(p));
      if (invalidParams.length) {
        throw new BadRequestError(
          `Invalid skill parameter(s) for this session: ${invalidParams.join(", ")}. Allowed: ${typeParameters.join(", ")}`,
        );
      }
      const overallScore =
        r.skillScores.reduce((sum, s) => sum + s.score, 0) / r.skillScores.length;

      await PerformanceModel.updateOne(
        { studentId: r.studentId, sessionId },
        {
          $set: {
            studentId: r.studentId,
            franchiseId: session.franchiseId || studentFranchiseMap.get(r.studentId),
            teamId: session.targetType === "team" ? session.teamId : studentTeamMap.get(r.studentId),
            coachId,
            sessionId,
            sessionDate: new Date(session.date),
            sessionType: session.type,
            skillScores: r.skillScores,
            overallScore: Math.round(overallScore * 10) / 10,
            remarks: r.remarks,
            videoUrl: r.videoUrl,
          },
        },
        { upsert: true },
      );
    }

    // keep the denormalised overallRating on Student roughly current
    for (const r of records) {
      const recent = await PerformanceModel.find({ studentId: r.studentId })
        .sort({ sessionDate: -1 })
        .limit(10)
        .select("overallScore")
        .lean();
      const avg = recent.length
        ? recent.reduce((sum, p) => sum + p.overallScore, 0) / recent.length
        : 0;
      await StudentModel.updateOne(
        { _id: r.studentId },
        { $set: { overallRating: Math.round(avg * 10) / 10 } },
      );
    }

    if (session.status === "upcoming" || session.status === "ongoing") {
      session.status = "completed";
      await session.save();
    }

    return this.getSessionRoster(sessionId);
  }

  private async notifySessionGuardians(
    session: {
      _id?: any;
      id?: any;
      targetType: string;
      teamId?: mongoose.Types.ObjectId;
      category?: string;
      franchiseId?: mongoose.Types.ObjectId;
      rosterPlayerIds?: mongoose.Types.ObjectId[];
      playerIds?: mongoose.Types.ObjectId[];
    },
    opts: { title: string; body: string; type: "session_location_change" },
  ) {
    let query: any;
    if (session.rosterPlayerIds !== undefined && session.rosterPlayerIds.length > 0) {
      const allRosterPlayerIds = [...(session.rosterPlayerIds || []), ...(session.playerIds || [])];
      query = { _id: { $in: allRosterPlayerIds }, isActive: true };
    } else {
      const teamObjId = session.teamId
        ? (mongoose.isValidObjectId(session.teamId) ? new mongoose.Types.ObjectId(session.teamId.toString()) : session.teamId)
        : null;
      query =
        session.targetType === "category"
          ? { franchiseId: session.franchiseId, ageGroup: session.category, isActive: true }
          : { $or: [{ teamId: teamObjId }, { teamIds: teamObjId }], isActive: true };
    }
    const students = await StudentModel.find(query);
    const guardianIds = Array.from(
      new Set(students.flatMap((s) => s.guardianIds.map((g) => g.toString()))),
    );
    if (guardianIds.length === 0) return;
    await notificationService.send({
      userIds: guardianIds,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      data: { sessionId: ((session as any)._id || (session as any).id || "").toString() },
      franchiseId: session.franchiseId ? session.franchiseId.toString() : undefined,
      channels: ["push"],
    });
  }
}