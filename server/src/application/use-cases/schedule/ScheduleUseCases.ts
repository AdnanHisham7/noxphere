// src/application/use-cases/schedule/ScheduleUseCases.ts
import mongoose from "mongoose";
import { SessionModel } from "../../../infrastructure/database/models/Session.model";
import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { AttendanceModel } from "../../../infrastructure/database/models/Attendance.model";
import { PerformanceModel } from "../../../infrastructure/database/models/Performance.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
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
    const query: Record<string, unknown> = {};
    if (filters.franchiseId) {
      query.franchiseId = filters.franchiseId;
    } else if (filters.academyId) {
      const franchises = await FranchiseModel.find({ academyId: filters.academyId }).select("_id").lean();
      query.franchiseId = { $in: franchises.map((f) => f._id) };
    } else if (filters.coachId) {
      // Allowed for a coach querying their assigned sessions across franchises
    } else {
      throw new BadRequestError("franchiseId or academyId is required");
    }

    if (filters.teamId) query.teamId = filters.teamId;
    if (filters.coachId) {
      const coachIdStr = filters.coachId.toString();
      const coachObjId = mongoose.isValidObjectId(coachIdStr) ? new mongoose.Types.ObjectId(coachIdStr) : null;
      const coachConditions: any[] = [{ coachId: coachIdStr }, { coachIds: coachIdStr }];
      if (coachObjId) {
        coachConditions.push({ coachId: coachObjId }, { coachIds: coachObjId });
      }
      query.$or = coachConditions;
    }
    if (filters.status) query.status = filters.status;
    if (filters.from || filters.to) {
      query.date = {
        ...(filters.from && { $gte: filters.from }),
        ...(filters.to && { $lte: filters.to }),
      };
    }
    const sessions = await SessionModel.find(query)
      .populate("coachId", "firstName lastName")
      .populate("coachIds", "firstName lastName")
      .populate("teamId", "name ageGroup")
      .sort({ date: -1, startTime: -1 })
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
      const franchise = await FranchiseModel.findById(dto.franchiseId).select("ageGroups").lean();
      if (!franchise) throw new NotFoundError("Franchise");
      const targetCat = dto.category!;
      if (franchise.ageGroups?.length && !franchise.ageGroups.includes(targetCat)) {
        throw new BadRequestError(
          `"${targetCat}" isn't one of this franchise's configured age groups (${franchise.ageGroups.join(", ")})`,
        );
      }
    } else {
      if (!dto.teamId) throw new BadRequestError("teamId is required for a team session");
      const team = await TeamModel.findById(dto.teamId);
      if (!team) throw new NotFoundError("Team");
      if (team.franchiseId) {
        if (team.franchiseId.toString() !== dto.franchiseId) {
          throw new BadRequestError("That team doesn't belong to this franchise");
        }
      } else {
        const franchise = await FranchiseModel.findById(dto.franchiseId).select("academyId").lean();
        if (!franchise || franchise.academyId.toString() !== team.academyId?.toString()) {
          throw new BadRequestError("That global team is not part of this franchise's academy");
        }
      }
      if (requestingCoachId && team.coachId?.toString() !== requestingCoachId) {
        throw new ForbiddenError("You can only schedule sessions for a team assigned to you");
      }
    }

    let resolvedPlayerIds: any[] = [];
    if (dto.targetType === "batch") {
      resolvedPlayerIds = (dto.playerIds || []).map((id) => new mongoose.Types.ObjectId(id));
    } else if (dto.targetType === "category") {
      const categoriesFilter = dto.categories && dto.categories.length > 0 ? { $in: dto.categories } : dto.category;
      const baseStudents = await StudentModel.find({
        franchiseId: dto.franchiseId,
        ageGroup: categoriesFilter,
        isActive: true,
      }).select("_id").lean();
      resolvedPlayerIds = baseStudents.map((s) => s._id);
    } else {
      const baseStudents = await StudentModel.find({
        teamId: dto.teamId,
        isActive: true,
      }).select("_id").lean();
      resolvedPlayerIds = baseStudents.map((s) => s._id);
    }

    let datesToCreate: string[] = [dto.date];
    if (dto.startDate && dto.endDate && dto.startDate !== dto.endDate) {
      const [startYear, startMonth, startDay] = dto.startDate.split("-").map(Number);
      const [endYear, endMonth, endDay] = dto.endDate.split("-").map(Number);
      
      let currentDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
      const endDateUTC = new Date(Date.UTC(endYear, endMonth - 1, endDay));
      
      datesToCreate = [];
      while (currentDate <= endDateUTC) {
        const year = currentDate.getUTCFullYear();
        const month = String(currentDate.getUTCMonth() + 1).padStart(2, "0");
        const day = String(currentDate.getUTCDate()).padStart(2, "0");
        datesToCreate.push(`${year}-${month}-${day}`);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
    }

    await this.assertCoachesAvailable(dto.coachIds && dto.coachIds.length > 0 ? dto.coachIds : [dto.coachId!], datesToCreate);

    const sessionsToCreate = datesToCreate.map((dateStr) => ({
      franchiseId: dto.franchiseId,
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
      location: dto.location,
      fieldNumber: dto.fieldNumber,
      notes: dto.notes,
      playerIds: dto.playerIds,
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
    const target =
      dto.targetType === "team"
        ? (populated?.teamId as any)?.name
        : dto.targetType === "batch"
        ? "custom batch squad"
        : dto.category;

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
          dto.franchiseId,
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
   * to be scored against. Falls back to the platform default set if
   * somehow neither record carries any (keeps old data / dev fixtures
   * from hard-failing).
   */
  private async getSkillParametersForFranchise(franchiseId: mongoose.Types.ObjectId | string): Promise<string[]> {
    const franchise = await FranchiseModel.findById(franchiseId).select("skillParameters").lean();
    if (!franchise) throw new NotFoundError("Franchise");
    // Return franchise-specific skills; fallback to default set if empty
    return franchise.skillParameters?.length ? franchise.skillParameters : [
      "Dribbling", "Passing", "Shooting", "Speed", "Tactical Awareness", "Attitude"
    ];
  }


  /**
   * The roster for a session: every student on that session's team, merged
   * with whatever attendance/performance has already been recorded for
   * this exact session (so re-opening a partially-marked session shows
   * what's already saved instead of a blank sheet).
   */
  async getSessionRoster(sessionId: string) {
    const session = await SessionModel.findById(sessionId)
      .populate("teamId", "name ageGroup")
      .populate("coachId", "firstName lastName")
      .populate("coachIds", "firstName lastName");
    if (!session) throw new NotFoundError("Session");

    const studentQuery: any = { isActive: true };
    if (session.rosterPlayerIds !== undefined) {
      const allRosterPlayerIds = [...(session.rosterPlayerIds || []), ...(session.playerIds || [])];
      studentQuery._id = { $in: allRosterPlayerIds };
    } else {
      const categoriesFilter = session.categories && session.categories.length > 0 ? { $in: session.categories } : session.category;
      const playerQueryList = session.playerIds && session.playerIds.length > 0 ? { _id: { $in: session.playerIds } } : null;

      if (session.targetType === "category") {
        const defaultFilter = { franchiseId: session.franchiseId, ageGroup: categoriesFilter };
        studentQuery.$or = playerQueryList ? [defaultFilter, playerQueryList] : [defaultFilter];
      } else {
        const defaultFilter = { teamId: session.teamId };
        studentQuery.$or = playerQueryList ? [defaultFilter, playerQueryList] : [defaultFilter];
      }
    }

    const students = await StudentModel.find(studentQuery)
      .select("firstName lastName photo position jerseyNumber teamId")
      .sort({ firstName: 1 })
      .lean();

    const [attendance, performance, skillParameters] = await Promise.all([
      AttendanceModel.find({ sessionId }).lean(),
      PerformanceModel.find({ sessionId }).lean(),
      this.getSkillParametersForFranchise(session.franchiseId),
    ]);
    const attendanceByStudent = new Map(attendance.map((a) => [a.studentId.toString(), a]));
    const performanceByStudent = new Map(performance.map((p) => [p.studentId.toString(), p]));

    return {
      session: toCard(session),
      skillParameters,
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

    const studentTeamMap = new Map<string, mongoose.Types.ObjectId | undefined>();
    if (session.targetType === "category") {
      const students = await StudentModel.find({ _id: { $in: records.map((r) => r.studentId) } })
        .select("teamId")
        .lean();
      for (const s of students) studentTeamMap.set(s._id.toString(), s.teamId);
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
            franchiseId: session.franchiseId,
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
          session.franchiseId.toString(),
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
            session.franchiseId.toString(),
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

    const allowedParameters = await this.getSkillParametersForFranchise(session.franchiseId);
    const allowedSet = new Set(allowedParameters);

    const studentTeamMap = new Map<string, mongoose.Types.ObjectId | undefined>();
    if (session.targetType === "category") {
      const students = await StudentModel.find({ _id: { $in: records.map((r) => r.studentId) } })
        .select("teamId")
        .lean();
      for (const s of students) studentTeamMap.set(s._id.toString(), s.teamId);
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
          `Invalid skill parameter(s) for this academy: ${invalidParams.join(", ")}. Allowed: ${allowedParameters.join(", ")}`,
        );
      }
      const overallScore =
        r.skillScores.reduce((sum, s) => sum + s.score, 0) / r.skillScores.length;

      await PerformanceModel.updateOne(
        { studentId: r.studentId, sessionId },
        {
          $set: {
            studentId: r.studentId,
            franchiseId: session.franchiseId,
            teamId: session.targetType === "team" ? session.teamId : studentTeamMap.get(r.studentId),
            coachId,
            sessionId,
            sessionDate: new Date(session.date),
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
    session: { targetType: string; teamId?: mongoose.Types.ObjectId; category?: string; franchiseId: mongoose.Types.ObjectId; rosterPlayerIds?: mongoose.Types.ObjectId[]; playerIds?: mongoose.Types.ObjectId[] },
    opts: { title: string; body: string; type: "session_location_change" },
  ) {
    let query: any;
    if (session.rosterPlayerIds !== undefined) {
      const allRosterPlayerIds = [...(session.rosterPlayerIds || []), ...(session.playerIds || [])];
      query = { _id: { $in: allRosterPlayerIds }, isActive: true };
    } else {
      query =
        session.targetType === "category"
          ? { franchiseId: session.franchiseId, ageGroup: session.category, isActive: true }
          : { teamId: session.teamId, isActive: true };
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
      channels: ["push"],
    });
  }
}