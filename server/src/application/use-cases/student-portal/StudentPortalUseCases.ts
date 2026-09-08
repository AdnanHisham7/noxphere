// src/application/use-cases/student-portal/StudentPortalUseCases.ts
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { AttendanceModel } from "../../../infrastructure/database/models/Attendance.model";
import { FeeModel } from "../../../infrastructure/database/models/Fee.model";
import { PerformanceModel } from "../../../infrastructure/database/models/Performance.model";
import { CoachRemarkModel } from "../../../infrastructure/database/models/CoachRemark.model";
import { NotFoundError, ForbiddenError } from "../../../shared/errors/AppError";

export class StudentPortalUseCases {
  /** Every method here resolves the Student doc via the logged-in user's own
   *  account (userId), never a path param — a student can only ever see
   *  their own record, there is no id to tamper with. */

  private async getOwnStudentRecord(userId: string) {
    const student = await StudentModel.findOne({
      userId,
      deletedAt: { $exists: false },
    })
      .populate("teamId", "name ageGroup")
      .populate("coachId", "firstName lastName")
      .lean();
    if (!student) {
      throw new NotFoundError("No student record linked to this account yet");
    }
    return student;
  }

  async getMyProfile(userId: string) {
    return this.getOwnStudentRecord(userId);
  }

  async getMyDashboard(userId: string) {
    const student = await this.getOwnStudentRecord(userId);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayAttendance, fees, recentRemarks] = await Promise.all([
      AttendanceModel.findOne({
        studentId: student._id,
        sessionDate: { $gte: todayStart, $lte: todayEnd },
      }).lean(),
      FeeModel.find({ studentId: student._id }).lean(),
      CoachRemarkModel.find({ studentId: student._id }).sort({ createdAt: -1 }).limit(3).lean(),
    ]);

    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const upcomingFees: { installmentNumber: number; amount: number; dueDate: Date }[] = [];
    const overdueFees: { installmentNumber: number; amount: number; dueDate: Date }[] = [];

    for (const fee of fees) {
      for (const inst of fee.installments) {
        if (inst.status === "paid" || inst.status === "refunded") continue;
        const entry = {
          installmentNumber: inst.installmentNumber,
          amount: inst.amount - inst.paidAmount,
          dueDate: inst.dueDate,
        };
        if (inst.dueDate < now) overdueFees.push(entry);
        else if (inst.dueDate <= in14Days) upcomingFees.push(entry);
      }
    }

    return {
      profile: {
        id: student._id.toString(),
        firstName: student.firstName,
        lastName: student.lastName,
        photo: student.photo,
        attendancePercentage: student.attendancePercentage,
        overallRating: student.overallRating,
        team: student.teamId,
        position: student.position,
        positions: student.positions,
        jerseyNumber: student.jerseyNumber,
        dateOfBirth: student.dateOfBirth,
        ageGroup: student.ageGroup,
        guardian: student.guardian,
        medicalInfo: {
          emergencyContactName: student.medicalInfo?.emergencyContactName,
          emergencyContactPhone: student.medicalInfo?.emergencyContactPhone,
        },
        publicProfileToken: student.publicProfileToken,
        publicProfileEnabled: student.publicProfileEnabled,
        publicProfileSettings: student.publicProfileSettings,
        franchiseId: student.franchiseId ? student.franchiseId.toString() : null,
      },

      todayStatus: todayAttendance?.status ?? null,
      upcomingFees,
      overdueFees,
      recentRemarks,
    };
  }

  async updateMyProfile(
    userId: string,
    dto: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      position?: string;
      positions?: string[];
      jerseyNumber?: number;
      photo?: string;
      guardian?: { name?: string; phone?: string; email?: string };
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      bio?: string;
      preferredFoot?: string;
    },
  ) {
    const student = await StudentModel.findOne({
      userId,
      deletedAt: { $exists: false },
    });
    if (!student) {
      throw new NotFoundError("No student record linked to this account yet");
    }

    if (student.franchiseId) {
      throw new ForbiddenError(
        "Profile editing is disabled for academy-enrolled students. Your academy administers all player records. Please contact your coach or manager to update any information.",
      );
    }

    if (dto.firstName) student.firstName = dto.firstName.trim();
    if (dto.lastName) student.lastName = dto.lastName.trim();
    if (dto.position) {
      student.position = dto.position;
      student.positions = [dto.position];
    }
    if (dto.positions && dto.positions.length > 0) {
      student.positions = dto.positions;
      student.position = dto.positions[0];
    }
    if (dto.jerseyNumber !== undefined) student.jerseyNumber = dto.jerseyNumber;
    if (dto.photo !== undefined) student.photo = dto.photo;

    if (dto.dateOfBirth) {
      const dob = new Date(dto.dateOfBirth);
      if (!isNaN(dob.getTime())) {
        student.dateOfBirth = dob;
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
        student.ageGroup = `U-${Math.max(6, Math.min(25, age + 1))}`;
      }
    }

    if (dto.guardian) {
      student.guardian = {
        name: dto.guardian.name || student.guardian.name,
        phone: dto.guardian.phone || student.guardian.phone,
        email: dto.guardian.email || student.guardian.email,
      };
    }

    if (dto.emergencyContactName || dto.emergencyContactPhone) {
      student.medicalInfo.emergencyContactName =
        dto.emergencyContactName || student.medicalInfo.emergencyContactName;
      student.medicalInfo.emergencyContactPhone =
        dto.emergencyContactPhone || student.medicalInfo.emergencyContactPhone;
    }

    if (dto.bio !== undefined || dto.preferredFoot !== undefined) {
      student.publicProfileSettings = {
        ...(student.publicProfileSettings || {}),
        bio: dto.bio !== undefined ? dto.bio : student.publicProfileSettings?.bio,
        preferredFoot:
          dto.preferredFoot !== undefined
            ? dto.preferredFoot
            : student.publicProfileSettings?.preferredFoot,
      };
    }

    await student.save();
    return this.getMyDashboard(userId);
  }

  async updateMyPublicProfileSettings(
    userId: string,
    dto: {
      enabled?: boolean;
      settings?: {
        showPhoto?: boolean;
        showPosition?: boolean;
        showJerseyNumber?: boolean;
        showAgeGroup?: boolean;
        showRating?: boolean;
        showTeam?: boolean;
        bio?: string;
        preferredFoot?: string;
      };
    },
  ) {
    const student = await StudentModel.findOne({
      userId,
      deletedAt: { $exists: false },
    });
    if (!student) {
      throw new NotFoundError("No student record linked to this account yet");
    }

    if (dto.enabled !== undefined) {
      student.publicProfileEnabled = dto.enabled;
    }

    if (dto.settings) {
      student.publicProfileSettings = {
        ...(student.publicProfileSettings || {}),
        ...dto.settings,
      };
    }

    await student.save();
    return {
      publicProfileEnabled: student.publicProfileEnabled,
      publicProfileSettings: student.publicProfileSettings,
    };
  }

  async getMyAttendance(userId: string, month?: string) {
    const student = await this.getOwnStudentRecord(userId);

    const query: Record<string, unknown> = { studentId: student._id };
    if (month) {
      const [year, mon] = month.split("-").map(Number);
      query.sessionDate = {
        $gte: new Date(year, mon - 1, 1),
        $lte: new Date(year, mon, 0, 23, 59, 59, 999),
      };
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

  async getMyFees(userId: string) {
    const student = await this.getOwnStudentRecord(userId);
    return FeeModel.find({ studentId: student._id }).sort({ createdAt: -1 }).lean();
  }

  async getMyPerformance(userId: string) {
    const student = await this.getOwnStudentRecord(userId);
    const [performance, remarks] = await Promise.all([
      PerformanceModel.find({ studentId: student._id }).sort({ createdAt: -1 }).limit(20).lean(),
      CoachRemarkModel.find({ studentId: student._id }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    return { performance, remarks };
  }
}
