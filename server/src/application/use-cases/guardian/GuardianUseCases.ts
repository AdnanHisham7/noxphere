// src/application/use-cases/guardian/GuardianUseCases.ts
import mongoose from "mongoose";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { AttendanceModel } from "../../../infrastructure/database/models/Attendance.model";
import { FeeModel } from "../../../infrastructure/database/models/Fee.model";
import { PerformanceModel } from "../../../infrastructure/database/models/Performance.model";
import { SessionModel } from "../../../infrastructure/database/models/Session.model";
import { CoachRemarkModel } from "../../../infrastructure/database/models/CoachRemark.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { AdminFeesUseCases } from "../fees/AdminFeesUseCases";
import { ForbiddenError, NotFoundError } from "../../../shared/errors/AppError";

export class GuardianUseCases {
  constructor(private feesUseCases: AdminFeesUseCases = new AdminFeesUseCases()) {}
  /** Every read in this class is scoped to students linked to `guardianUserId`.
   *  A guardian can never fetch data for a student that isn't theirs. */

  private async assertOwnsStudent(guardianUserId: string, studentId: string) {
    const student = await StudentModel.findOne({
      _id: studentId,
      guardianIds: new mongoose.Types.ObjectId(guardianUserId),
      deletedAt: { $exists: false },
    });
    if (!student) {
      throw new ForbiddenError("You do not have access to this student");
    }
    return student;
  }

  async getMyChildren(guardianUserId: string) {
    const students = await StudentModel.find({
      guardianIds: new mongoose.Types.ObjectId(guardianUserId),
      deletedAt: { $exists: false },
    })
      .populate("teamId", "name ageGroup")
      .sort({ firstName: 1 })
      .lean();

    return students;
  }

  async getDashboard(guardianUserId: string) {
    const students = await StudentModel.find({
      guardianIds: new mongoose.Types.ObjectId(guardianUserId),
      deletedAt: { $exists: false },
    }).lean();

    if (!students.length) {
      return {
        children: [],
        todayAttendance: [],
        lateFees: [],
        pendingFees: [],
        upcomingFees: [],
        verificationPendingFees: [],
        overdueFees: [],
        sessions: {
          today: [],
          tomorrow: [],
          upcoming: [],
          recentCompleted: [],
        },
      };
    }

    const studentIds = students.map((s) => s._id);
    const studentMap = new Map(students.map((s) => [s._id.toString(), s]));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = `${tomorrowDate.getFullYear()}-${pad(tomorrowDate.getMonth() + 1)}-${pad(tomorrowDate.getDate())}`;
    const currentTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    // Collect conditions for all children to fetch their sessions
    const allConditions: Array<Record<string, unknown>> = [];
    const franchiseIds = Array.from(
      new Set(students.map((s) => s.franchiseId?.toString()).filter(Boolean)),
    ).map((id) => new mongoose.Types.ObjectId(id));

    for (const s of students) {
      allConditions.push({ playerIds: s._id });
      allConditions.push({ rosterPlayerIds: s._id });
      if (s.teamId) {
        allConditions.push({ targetType: "team", teamId: s.teamId });
      }
      if (s.ageGroup) {
        allConditions.push(
          { targetType: "category", category: s.ageGroup },
          { targetType: "category", categories: s.ageGroup },
        );
      }
    }

    const [todayAttendance, fees, upcomingRawSessions, attendedRecords] = await Promise.all([
      AttendanceModel.find({
        studentId: { $in: studentIds },
        sessionDate: { $gte: todayStart, $lte: todayEnd },
      }).lean(),
      FeeModel.find({ studentId: { $in: studentIds } }).lean(),
      SessionModel.find({
        franchiseId: { $in: franchiseIds },
        deletedAt: { $exists: false },
        date: { $gte: todayStr },
        status: { $ne: "cancelled" },
        ...(allConditions.length > 0 ? { $or: allConditions } : {}),
      })
        .populate("teamId", "name ageGroup")
        .populate("coachId", "firstName lastName")
        .populate("coachIds", "firstName lastName")
        .sort({ date: 1, startTime: 1 })
        .limit(25)
        .lean(),
      AttendanceModel.find({
        studentId: { $in: studentIds },
        sessionId: { $exists: true },
      })
        .select("sessionId studentId status remarks")
        .sort({ sessionDate: -1 })
        .limit(20)
        .lean(),
    ]);

    const attendedSessionIds = Array.from(
      new Set(attendedRecords.map((a) => a.sessionId?.toString()).filter(Boolean)),
    ).map((id) => new mongoose.Types.ObjectId(id));

    const pastRawSessions = attendedSessionIds.length > 0
      ? await SessionModel.find({
          _id: { $in: attendedSessionIds },
          deletedAt: { $exists: false },
        })
          .populate("teamId", "name ageGroup")
          .populate("coachId", "firstName lastName")
          .populate("coachIds", "firstName lastName")
          .sort({ date: -1 })
          .limit(10)
          .lean()
      : [];

    const mapSessionCard = (s: any, isPast = false) => {
      const matchingChildren = students.filter((child) => {
        if (s.playerIds?.some((p: any) => p.toString() === child._id.toString())) return true;
        if (s.rosterPlayerIds?.some((p: any) => p.toString() === child._id.toString())) return true;
        if (s.targetType === "team" && child.teamId && (s.teamId?._id?.toString() === child.teamId.toString() || s.teamId?.toString() === child.teamId.toString())) return true;
        if (s.targetType === "category") {
          if (s.category && s.category === child.ageGroup) return true;
          if (s.categories && s.categories.includes(child.ageGroup)) return true;
        }
        return false;
      });

      const isLive = s.date === todayStr && s.startTime <= currentTimeStr && s.endTime >= currentTimeStr && s.status !== "cancelled" && s.status !== "completed";

      const coachName = s.coachId
        ? `${s.coachId.firstName} ${s.coachId.lastName}`
        : s.coachIds?.[0]
          ? `${s.coachIds[0].firstName} ${s.coachIds[0].lastName}`
          : undefined;

      const teamName = s.targetType === "category"
        ? (s.category || (Array.isArray(s.categories) ? s.categories.join(", ") : "Category"))
        : (s.teamId?.name || "Team");

      const childNames = matchingChildren.map((c) => `${c.firstName} ${c.lastName}`.trim()).filter(Boolean);
      const studentName = childNames.join(", ") || (students[0] ? `${students[0].firstName} ${students[0].lastName}`.trim() : "Student");
      const venue = s.location || (s.fieldNumber ? `Field ${s.fieldNumber}` : "Academy Pitch");
      const title = s.notes || (s.type ? `${s.type.charAt(0).toUpperCase() + s.type.slice(1)} Session` : "Training Session");

      return {
        id: s._id.toString(),
        title,
        type: s.type || "training",
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        location: venue,
        venue,
        fieldNumber: s.fieldNumber,
        pitch: s.fieldNumber ? `Field ${s.fieldNumber}` : undefined,
        pitchId: s.pitchId,
        googleMapsUrl: s.googleMapsUrl,
        latitude: s.latitude,
        longitude: s.longitude,
        status: s.status,
        notes: s.notes,
        isLive,
        coachName,
        teamName,
        studentName,
        children: matchingChildren.map((c) => ({
          id: c._id.toString(),
          name: `${c.firstName} ${c.lastName}`.trim(),
          photo: c.photo,
        })),
      };
    };

    const todaySessions = upcomingRawSessions
      .filter((s) => s.date === todayStr)
      .map((s) => mapSessionCard(s));

    const tomorrowSessions = upcomingRawSessions
      .filter((s) => s.date === tomorrowStr)
      .map((s) => mapSessionCard(s));

    const upcomingFutureSessions = upcomingRawSessions
      .filter((s) => s.date > tomorrowStr)
      .map((s) => mapSessionCard(s));

    const recentCompletedSessions = pastRawSessions.map((s) => mapSessionCard(s, true));

    const lateFees: Array<any> = [];
    const pendingFees: Array<any> = [];
    const upcomingFees: Array<any> = [];
    const verificationPendingFees: Array<any> = [];
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const franchiseDocs = await FranchiseModel.find({ _id: { $in: franchiseIds } }).select("academyId").lean();
    const academyIds = Array.from(new Set(franchiseDocs.map((f) => f.academyId?.toString()).filter(Boolean)));
    const academyDocs = await AcademyModel.find({ _id: { $in: academyIds } }).select("currency").lean();
    const franchiseAcademyMap = new Map(franchiseDocs.map((f) => [f._id.toString(), f.academyId?.toString()]));
    const academyCurrencyMap = new Map(academyDocs.map((a) => [a._id.toString(), a.currency?.toUpperCase()]));

    for (const fee of fees) {
      const student = studentMap.get(fee.studentId.toString());
      const fId = (fee.franchiseId || student?.franchiseId)?.toString();
      const aId = fId ? franchiseAcademyMap.get(fId) : null;
      const acadCurrency = aId ? academyCurrencyMap.get(aId) : null;
      const feeCurrency = (fee.currency && fee.currency !== "INR") ? fee.currency : (acadCurrency || fee.currency || "INR");

      for (const inst of fee.installments) {
        if (inst.status === "paid" || inst.status === "refunded") continue;
        const remainingAmount = inst.amount - inst.paidAmount;
        if (remainingAmount <= 0) continue;

        const dueDate = new Date(inst.dueDate);
        const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isLate = dueDate < now;
        const isDueSoon = !isLate && dueDate <= in14Days;

        const entry = {
          feeId: fee._id.toString(),
          studentId: fee.studentId.toString(),
          studentName: student ? `${student.firstName} ${student.lastName}`.trim() : "Student",
          studentPhoto: student?.photo,
          feeType: fee.feeType,
          installmentNumber: inst.installmentNumber,
          amount: remainingAmount,
          totalAmount: inst.amount,
          paidAmount: inst.paidAmount,
          dueDate: inst.dueDate,
          status: inst.status === "pending_verification" ? "pending_verification" : (isLate ? "overdue" : inst.status),
          urgency: inst.status === "pending_verification" ? "under_review" : (isLate ? "late" : isDueSoon ? "due_soon" : "upcoming"),
          daysDiff,
          currency: feeCurrency,
          verificationProof: (inst as any).verificationProof,
        };

        if (inst.status === "pending_verification") {
          verificationPendingFees.push(entry);
        } else if (isLate) {
          lateFees.push(entry);
        } else if (isDueSoon) {
          pendingFees.push(entry);
        } else {
          upcomingFees.push(entry);
        }
      }
    }

    lateFees.sort((a, b) => a.daysDiff - b.daysDiff);
    pendingFees.sort((a, b) => a.daysDiff - b.daysDiff);
    upcomingFees.sort((a, b) => a.daysDiff - b.daysDiff);
    verificationPendingFees.sort((a, b) => a.daysDiff - b.daysDiff);

    return {
      children: students.map((s) => ({
        id: s._id.toString(),
        firstName: s.firstName,
        lastName: s.lastName,
        photo: s.photo,
        attendancePercentage: s.attendancePercentage,
        overallRating: s.overallRating,
      })),
      todayAttendance: todayAttendance.map((a) => ({
        studentId: a.studentId.toString(),
        status: a.status,
      })),
      lateFees,
      pendingFees,
      upcomingFees,
      verificationPendingFees,
      overdueFees: lateFees, // backwards compatible
      sessions: {
        today: todaySessions,
        tomorrow: tomorrowSessions,
        upcoming: upcomingFutureSessions,
        recentCompleted: recentCompletedSessions,
      },
    };
  }

  async getChildAttendance(guardianUserId: string, studentId: string, month?: string) {
    await this.assertOwnsStudent(guardianUserId, studentId);

    const query: Record<string, unknown> = { studentId };
    if (month) {
      // month format: YYYY-MM
      const [year, mon] = month.split("-").map(Number);
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 0, 23, 59, 59, 999);
      query.sessionDate = { $gte: start, $lte: end };
    }

    const records = await AttendanceModel.find(query).sort({ sessionDate: -1 }).lean();
    const present = records.filter((r) => r.status === "present" || r.status === "late").length;

    return {
      records,
      summary: {
        total: records.length,
        present,
        absent: records.filter((r) => r.status === "absent").length,
        late: records.filter((r) => r.status === "late").length,
        excused: records.filter((r) => r.status === "excused").length,
        percentage: records.length ? Math.round((present / records.length) * 100) : 0,
      },
    };
  }

  async getChildFees(guardianUserId: string, studentId: string) {
    const student = await this.assertOwnsStudent(guardianUserId, studentId);
    const fees = await FeeModel.find({ studentId }).sort({ createdAt: -1 }).lean();
    if (student.franchiseId) {
      const franchise = await FranchiseModel.findById(student.franchiseId).select("academyId").lean();
      if (franchise?.academyId) {
        const academy = await AcademyModel.findById(franchise.academyId).select("currency").lean();
        if (academy?.currency && academy.currency.toUpperCase() !== "INR") {
          const academyCurrency = academy.currency.toUpperCase();
          return fees.map((f: any) => ({
            ...f,
            currency: f.currency && f.currency !== "INR" ? f.currency : academyCurrency,
          }));
        }
      }
    }
    return fees;
  }

  async getChildPaymentConfig(guardianUserId: string, studentId: string) {
    const student = await this.assertOwnsStudent(guardianUserId, studentId);
    if (!student.franchiseId) {
      return {
        academyName: "Academy",
        paymentMethod: "qr",
        feeQrImageUrl: undefined,
        bankDetails: undefined,
        currency: "INR",
      };
    }

    const franchise = await FranchiseModel.findById(student.franchiseId).select("name academyId").lean();
    if (!franchise || !franchise.academyId) {
      return {
        academyName: franchise?.name || "Academy",
        paymentMethod: "qr",
        feeQrImageUrl: undefined,
        bankDetails: undefined,
        currency: "INR",
      };
    }

    const academy = await AcademyModel.findById(franchise.academyId)
      .select("name feePaymentMethod feeQrImageUrl bankDetails currency")
      .lean();

    return {
      academyName: academy?.name || franchise.name,
      paymentMethod: (academy?.feePaymentMethod as any) || "qr",
      feeQrImageUrl: academy?.feeQrImageUrl,
      bankDetails: academy?.bankDetails,
      currency: academy?.currency || "INR",
    };
  }

  async payChildFee(
    guardianUserId: string,
    feeId: string,
    installmentNumber: number,
    payload: {
      amount: number;
      paymentMethod?: string;
      transactionId?: string;
      notes?: string;
      paymentBreakdown?: any[];
    },
  ) {
    const fee = await FeeModel.findById(feeId);
    if (!fee) throw new NotFoundError("Fee record not found");

    // Verify ownership of the child
    await this.assertOwnsStudent(guardianUserId, fee.studentId.toString());

    return this.feesUseCases.submitPaymentProof(
      feeId,
      installmentNumber,
      {
        amount: payload.amount,
        paymentMethod: payload.paymentMethod || "upi",
        transactionId: payload.transactionId,
        notes: payload.notes,
      },
      guardianUserId,
    );
  }

  async getChildPerformance(guardianUserId: string, studentId: string) {
    await this.assertOwnsStudent(guardianUserId, studentId);
    const records = await PerformanceModel.find({ studentId })
      .populate("sessionId", "title date startTime endTime location type notes")
      .populate("coachId", "firstName lastName")
      .sort({ sessionDate: -1, createdAt: -1 })
      .limit(50)
      .lean();
    return records;
  }

  async getChildRemarks(guardianUserId: string, studentId: string) {
    await this.assertOwnsStudent(guardianUserId, studentId);
    const remarks = await CoachRemarkModel.find({ studentId })
      .populate("coachId", "firstName lastName")
      .sort({ date: -1 })
      .lean();
    return remarks;
  }

  async getChildProfile(guardianUserId: string, studentId: string) {
    await this.assertOwnsStudent(guardianUserId, studentId);
    const student = await StudentModel.findById(studentId)
      .populate("teamId", "name ageGroup")
      .populate("franchiseId", "name academyId")
      .lean();
    return student;
  }

  async getChildSessions(guardianUserId: string, studentId: string): Promise<any[]> {
    const student = await this.assertOwnsStudent(guardianUserId, studentId);
    const conditions: Array<Record<string, unknown>> = [
      { playerIds: student._id },
      { rosterPlayerIds: student._id },
    ];
    if (student.teamId) {
      conditions.push({ targetType: "team", teamId: student.teamId });
    }
    if (student.ageGroup) {
      conditions.push(
        { targetType: "category", category: student.ageGroup },
        { targetType: "category", categories: student.ageGroup },
      );
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Upcoming sessions: from today onwards, scoped to this student's team/category/roster
    const upcomingFilter: Record<string, unknown> = {
      franchiseId: student.franchiseId,
      deletedAt: { $exists: false },
      date: { $gte: todayStart },
      $or: conditions,
    };

    const upcomingSessions = await SessionModel.find(upcomingFilter)
      .populate("teamId", "name")
      .populate("coachId", "firstName lastName")
      .sort({ date: 1, startTime: 1 })
      .limit(20)
      .lean();

    // Past sessions: only those the student actually attended
    const attendedRecords = await AttendanceModel.find({
      studentId: student._id,
      sessionId: { $exists: true },
    })
      .select("sessionId status")
      .sort({ sessionDate: -1 })
      .limit(20)
      .lean();

    const attendedSessionIds = attendedRecords.map((a) => a.sessionId);
    const attendedMap = new Map(
      attendedRecords.map((a) => [a.sessionId?.toString(), a.status])
    );

    const pastSessions = attendedSessionIds.length
      ? await SessionModel.find({
          _id: { $in: attendedSessionIds },
          deletedAt: { $exists: false },
        })
          .populate("teamId", "name")
          .populate("coachId", "firstName lastName")
          .sort({ date: -1 })
          .lean()
      : [];

    // Build upcoming attendance map for sessions that have already been marked
    const upcomingSessionIds = upcomingSessions.map((s) => s._id);
    const upcomingAttendance = upcomingSessionIds.length
      ? await AttendanceModel.find({
          studentId: student._id,
          sessionId: { $in: upcomingSessionIds },
        })
          .select("sessionId status")
          .lean()
      : [];
    const upcomingAttendanceMap = new Map(
      upcomingAttendance.map((a) => [a.sessionId?.toString(), a.status])
    );

    const mappedUpcoming = upcomingSessions.map((s) => ({
      ...s,
      isMarked: s.status === "completed" || upcomingAttendanceMap.has(s._id.toString()),
      attendanceStatus: upcomingAttendanceMap.get(s._id.toString()) || null,
    }));

    const mappedPast = pastSessions.map((s) => ({
      ...s,
      isMarked: true,
      attendanceStatus: attendedMap.get(s._id.toString()) || null,
    }));

    return [...mappedUpcoming, ...mappedPast];
  }
}
