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
        overdueFees: [],
      };
    }

    const studentIds = students.map((s) => s._id);
    const studentMap = new Map(students.map((s) => [s._id.toString(), s]));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayAttendance, fees] = await Promise.all([
      AttendanceModel.find({
        studentId: { $in: studentIds },
        sessionDate: { $gte: todayStart, $lte: todayEnd },
      }).lean(),
      FeeModel.find({ studentId: { $in: studentIds } }).lean(),
    ]);

    const lateFees: Array<any> = [];
    const pendingFees: Array<any> = [];
    const upcomingFees: Array<any> = [];
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    for (const fee of fees) {
      const student = studentMap.get(fee.studentId.toString());
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
          status: isLate ? "overdue" : inst.status,
          urgency: isLate ? "late" : isDueSoon ? "due_soon" : "upcoming",
          daysDiff,
          currency: fee.currency || "INR",
        };

        if (isLate) {
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
      overdueFees: lateFees, // backwards compatible
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
    await this.assertOwnsStudent(guardianUserId, studentId);
    const fees = await FeeModel.find({ studentId }).sort({ createdAt: -1 }).lean();
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

    return this.feesUseCases.recordPayment(
      feeId,
      installmentNumber,
      {
        amount: payload.amount,
        paymentMethod: payload.paymentMethod || "upi",
        transactionId: payload.transactionId,
        paymentBreakdown: payload.paymentBreakdown,
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
