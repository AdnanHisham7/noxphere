import { IStudentRepository } from "../../../domain/repositories/IStudentRepository";
import { IUserRepository } from "../../../domain/repositories/IUserRepository";
import { StudentEntity } from "../../../domain/entities/Student.entity";
import {
  defaultPermissions,
  UserEntity,
  UserRole,
} from "../../../domain/entities/User.entity";
import {
  AppError,
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from "../../../shared/errors/AppError";
import {
  CreateStudentDto,
  UpdateStudentDto,
  AddCoachRemarkDto,
  TransferStudentFranchiseDto,
} from "../../dtos/student.dto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { CoachRemarkModel } from "../../../infrastructure/database/models/CoachRemark.model";
import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { FranchiseTransferLogModel } from "../../../infrastructure/database/models/FranchiseTransferLog.model";
import { AcademySubscriptionUseCases } from "../subscription/AcademySubscriptionUseCases";

export class StudentUseCases {
  constructor(
    private studentRepo: IStudentRepository,
    private userRepo: IUserRepository,
    private academySubscriptionUseCases: AcademySubscriptionUseCases,
  ) {}

  private async validateTeamAssignment(franchiseId: string, teamId: string): Promise<void> {
    const team = await TeamModel.findOne({
      _id: teamId,
      deletedAt: { $exists: false },
    })
      .select("franchiseId academyId")
      .lean();
    if (!team) {
      throw new BadRequestError("That team doesn't exist");
    }

    const playerFranchise = await FranchiseModel.findById(franchiseId).select("academyId").lean();
    if (!playerFranchise) {
      throw new BadRequestError("Franchise not found");
    }

    let teamAcademyId = team.academyId?.toString();
    if (!teamAcademyId && team.franchiseId) {
      const teamFranchise = await FranchiseModel.findById(team.franchiseId).select("academyId").lean();
      if (teamFranchise) {
        teamAcademyId = teamFranchise.academyId.toString();
      }
    }

    if (!teamAcademyId) {
      throw new BadRequestError("Team's academy context could not be resolved");
    }

    if (playerFranchise.academyId.toString() !== teamAcademyId) {
      throw new BadRequestError("That team is not part of this academy's ecosystem");
    }
  }

  async createStudent(
    dto: CreateStudentDto,
    createdBy: string,
  ): Promise<StudentEntity> {
    // 0. Enforce subscription/capacity before creating anything — fail
    // fast so we never create a guardian/student login account and then
    // have to roll it back because the academy can't add another player.
    const franchise = await FranchiseModel.findById(dto.franchiseId).select("academyId").lean();
    if (!franchise) throw new NotFoundError("Franchise");
    await this.academySubscriptionUseCases.assertCanAddStudent(franchise.academyId.toString());

    // 1. Create (or reuse) a guardian-role account for the guardian's email.
    // This is what the Guardian Portal logs into, and it's what every
    // guardian notification (schedule alerts, selection updates, fee
    // reminders, attendance/performance) is addressed to via
    // student.guardianIds.
    let guardianUser = await this.userRepo.findByEmail(dto.guardian.email);
    if (!guardianUser) {
      const tempPassword = Math.random().toString(36).slice(-8);
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const [guardianFirstName, ...guardianLastParts] = dto.guardian.name.trim().split(" ");
      guardianUser = await this.userRepo.create({
        email: dto.guardian.email,
        passwordHash,
        role: "guardian",
        firstName: guardianFirstName || dto.guardian.name,
        lastName: guardianLastParts.join(" ") || "-",
        phone: dto.guardian.phone,
        isActive: true,
        isEmailVerified: false,
        permissions: defaultPermissions["guardian" as UserRole],
        fcmTokens: [],
        franchiseId: dto.franchiseId,
      });
      // TODO: Send email with temp password
    }

    // 2. Create a separate student-role account for the player themself.
    // `dto.email` is usually the same as the guardian's email in youth
    // academies (players rarely have their own inbox) — in that case we
    // don't want to collide with the guardian account we just created, so
    // we derive a distinct, non-loginable placeholder address instead. An
    // admin can later give the player their own real login email via
    // profile edit once they're old enough to want one.
    const studentEmail =
      dto.email.trim().toLowerCase() === dto.guardian.email.trim().toLowerCase()
        ? `student.${new mongoose.Types.ObjectId().toHexString()}@accounts.internal`
        : dto.email;

    let studentUser = await this.userRepo.findByEmail(studentEmail);
    if (!studentUser) {
      const tempPassword = Math.random().toString(36).slice(-8);
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      studentUser = await this.userRepo.create({
        email: studentEmail,
        passwordHash,
        role: "student",
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.guardian.phone,
        isActive: true,
        isEmailVerified: false,
        permissions: defaultPermissions["student" as UserRole],
        fcmTokens: [],
        franchiseId: dto.franchiseId,
      });
      // TODO: Send email with temp password
    }

    // 3. Create student document, linked to both accounts
    if (dto.teamId) {
      await this.validateTeamAssignment(dto.franchiseId, dto.teamId);
    }
    const studentData: Partial<StudentEntity> = {
      userId: studentUser.id,
      franchiseId: dto.franchiseId,
      teamId: dto.teamId,
      coachId: dto.coachId,
      guardianIds: [guardianUser.id],
      guardian: dto.guardian,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: new Date(dto.dateOfBirth),
      ageGroup: dto.ageGroup,
      jerseyNumber: dto.jerseyNumber,
      jerseySize: dto.jerseySize,
      position: dto.position,
      photo: dto.photo,
      medicalInfo: dto.medicalInfo,
      enrollmentDate: new Date(),
      isActive: true,
      attendancePercentage: 0,
      overallRating: 0,
      selectionStatus: "pending",
      transferStatus: "not_listed",
    };
    return await this.studentRepo.create(studentData);
  }

  async getStudents(
    franchiseId: string,
    filters: any,
    page = 1,
    limit = 20,
    restrictToCoachId?: string,
  ): Promise<{ items: StudentEntity[]; total: number }> {
    const filter: any = { franchiseId, isActive: true };

    // A coach only ever sees students on a team assigned to them, or a
    // student explicitly assigned to them directly (e.g. trial players not
    // yet placed on a team). Derived fresh from Team.coachId every call so
    // a team reassignment can never leave a coach seeing a stale roster.
    let allowedTeamIds: string[] | null = null;
    if (restrictToCoachId) {
      const coachTeams = await TeamModel.find({
        franchiseId,
        coachId: restrictToCoachId,
        deletedAt: { $exists: false },
      })
        .select("_id")
        .lean();
      allowedTeamIds = coachTeams.map((t) => t._id.toString());
    }

    if (filters.teamId) {
      if (allowedTeamIds && !allowedTeamIds.includes(filters.teamId)) {
        return { items: [], total: 0 };
      }
      filter.teamId = filters.teamId;
    } else if (allowedTeamIds) {
      filter.$or = [{ teamId: { $in: allowedTeamIds } }, { coachId: restrictToCoachId }];
    }

    if (filters.ageGroup) filter.ageGroup = filters.ageGroup;
    if (filters.selectionStatus)
      filter.selectionStatus = filters.selectionStatus;
    if (filters.search) {
      const searchOr = [
        { firstName: { $regex: filters.search, $options: "i" } },
        { lastName: { $regex: filters.search, $options: "i" } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }
    return await this.studentRepo.findAll(filter, page, limit);
  }

  async getStudentById(id: string): Promise<StudentEntity> {
    const student = await this.studentRepo.findById(id);
    if (!student) throw new NotFoundError("Student");
    return student;
  }

  async updateStudentPhoto(id: string, photo: string): Promise<StudentEntity> {
    const student = await this.studentRepo.update(id, { photo });
    if (!student) throw new NotFoundError("Student");
    return student;
  }

  async updateStudent(
    id: string,
    dto: UpdateStudentDto,
  ): Promise<StudentEntity> {
    const { dateOfBirth, teamId, ...rest } = dto;
    const updateData: Partial<StudentEntity> = {
      ...rest,
    };
    if (dateOfBirth) {
      updateData.dateOfBirth = new Date(dateOfBirth);
    }
    if (teamId !== undefined) {
      if (teamId) {
        const existing = await this.studentRepo.findById(id);
        if (!existing) throw new NotFoundError("Student");
        await this.validateTeamAssignment(existing.franchiseId, teamId);
      }
      // null explicitly clears the assignment (unassign from team); a
      // string id sets/reassigns it. StudentEntity's teamId is typed as
      // string | undefined for normal reads, but the repository passes
      // this straight through to Mongoose's $set, where null is exactly
      // what removes the reference — hence the narrow cast here.
      (updateData as Record<string, unknown>).teamId = teamId;
    }
    const student = await this.studentRepo.update(id, updateData);
    if (!student) throw new NotFoundError("Student");
    return student;
  }

  async deleteStudent(id: string): Promise<void> {
    const success = await this.studentRepo.delete(id);
    if (!success) throw new NotFoundError("Student");
  }

  async updateStudentStatus(
    id: string,
    status: StudentEntity["status"],
  ): Promise<StudentEntity> {
    const student = await this.studentRepo.update(id, { status });
    if (!student) throw new NotFoundError("Student");
    return student;
  }

  // Moves a player from their current franchise to another franchise
  // within the SAME academy — distinct from the Transfer Wall marketplace
  // (TransferListing/TransferRequest), which is for cross-manager
  // negotiated transfers. This is a direct administrative reassignment,
  // restricted to Head Office (an academy-owner manager, or super_admin) —
  // see StudentController.transferFranchise for the role check.
  async transferStudentFranchise(
    studentId: string,
    dto: TransferStudentFranchiseDto,
    requester: { userId: string; academyId?: string; isSuperAdmin: boolean },
  ): Promise<StudentEntity> {
    const student = await this.studentRepo.findById(studentId);
    if (!student) throw new NotFoundError("Student");

    if (dto.toFranchiseId === student.franchiseId) {
      throw new BadRequestError("Player is already assigned to that franchise");
    }

    const [fromFranchise, toFranchise] = await Promise.all([
      FranchiseModel.findById(student.franchiseId).select("academyId").lean(),
      FranchiseModel.findById(dto.toFranchiseId)
        .select("academyId isActive")
        .lean(),
    ]);
    if (!fromFranchise) throw new NotFoundError("Current franchise");
    if (!toFranchise) throw new NotFoundError("Destination franchise");
    if (!toFranchise.isActive) {
      throw new BadRequestError("Cannot transfer a player into an inactive franchise");
    }
    if (fromFranchise.academyId.toString() !== toFranchise.academyId.toString()) {
      throw new BadRequestError(
        "Players can only be transferred between franchises of the same academy",
      );
    }
    if (
      !requester.isSuperAdmin &&
      requester.academyId &&
      requester.academyId !== fromFranchise.academyId.toString()
    ) {
      throw new ForbiddenError("You can only transfer players within your own academy");
    }

    // Team/coach assignments are franchise-scoped (see
    // validateTeamAssignment above) — moving academies without clearing
    // them would leave the player pointing at a team that belongs to the
    // franchise they just left.
    const franchiseUpdate: Record<string, unknown> = {
      franchiseId: dto.toFranchiseId,
      teamId: null,
      coachId: null,
    };
    const updated = await this.studentRepo.update(
      studentId,
      franchiseUpdate as Partial<StudentEntity>,
    );
    if (!updated) throw new NotFoundError("Student");

    await FranchiseTransferLogModel.create({
      studentId,
      academyId: fromFranchise.academyId,
      fromFranchiseId: student.franchiseId,
      toFranchiseId: dto.toFranchiseId,
      transferredBy: requester.userId,
      reason: dto.reason,
    });

    // Keep the player's own login account and every linked guardian
    // account in sync so a fresh login carries the correct franchise
    // scope going forward.
    const accountIds = [student.userId, ...student.guardianIds];
    await Promise.all(
      accountIds.map((accId) =>
        this.userRepo.update(accId, {
          franchiseId: dto.toFranchiseId,
        } as Partial<UserEntity>),
      ),
    );

    return updated;
  }

  async getFranchiseTransferHistory(studentId: string): Promise<
    Array<{
      id: string;
      fromFranchise: { id: string; name: string } | null;
      toFranchise: { id: string; name: string } | null;
      transferredBy: { id: string; name: string } | null;
      reason?: string;
      transferredAt: Date;
    }>
  > {
    const logs = await FranchiseTransferLogModel.find({ studentId })
      .sort({ createdAt: -1 })
      .populate("fromFranchiseId", "name")
      .populate("toFranchiseId", "name")
      .populate("transferredBy", "firstName lastName")
      .lean();

    return logs.map((log: any) => ({
      id: log._id.toString(),
      fromFranchise: log.fromFranchiseId
        ? { id: log.fromFranchiseId._id.toString(), name: log.fromFranchiseId.name }
        : null,
      toFranchise: log.toFranchiseId
        ? { id: log.toFranchiseId._id.toString(), name: log.toFranchiseId.name }
        : null,
      transferredBy: log.transferredBy
        ? {
            id: log.transferredBy._id.toString(),
            name: `${log.transferredBy.firstName} ${log.transferredBy.lastName}`,
          }
        : null,
      reason: log.reason,
      transferredAt: log.createdAt,
    }));
  }

  // NOTE: freeform per-student addPerformance()/markAttendance() methods
  // used to live here, letting attendance/performance be recorded for any
  // date with no link to a real scheduled session. That's been replaced —
  // both are now only recordable against a real Session via
  // ScheduleUseCases.markSessionAttendance() / logSessionPerformance(),
  // reached through POST /schedule/:id/attendance and
  // POST /schedule/:id/performance. See getPlayerCard() below for reading
  // a student's attendance/performance history.

  async addCoachRemark(
    studentId: string,
    dto: AddCoachRemarkDto,
    coachId: string,
  ): Promise<any> {
    const student = await this.studentRepo.findById(studentId);
    if (!student) throw new NotFoundError("Student");
    return await this.studentRepo.addRemark({
      studentId: new mongoose.Types.ObjectId(studentId),
      coachId: new mongoose.Types.ObjectId(coachId),
      text: dto.text,
      date: new Date(),
    });
  }

  async getPlayerCard(studentId: string): Promise<any> {
    const student = await this.getStudentById(studentId);
    const performances = await this.studentRepo.getPerformanceHistory(
      studentId,
      10,
    );
    const attendance = await this.studentRepo.getAttendanceHistory(
      studentId,
      30,
    );
    const remarks = await this.studentRepo.getRemarks(studentId);
    return { student, performances, attendance, remarks };
  }
}