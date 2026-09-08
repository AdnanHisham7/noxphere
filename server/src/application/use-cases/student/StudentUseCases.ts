import { IStudentRepository } from "../../../domain/repositories/IStudentRepository";
import { IUserRepository } from "../../../domain/repositories/IUserRepository";
import crypto from "crypto";
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
  RegisterPublicStudentDto,
  ClaimStudentDto,
} from "../../dtos/student.dto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { config } from "../../../config/app.config";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { CoachRemarkModel } from "../../../infrastructure/database/models/CoachRemark.model";
import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { FranchiseTransferLogModel } from "../../../infrastructure/database/models/FranchiseTransferLog.model";
import { AcademySubscriptionUseCases } from "../subscription/AcademySubscriptionUseCases";
import { FeeModel } from "../../../infrastructure/database/models/Fee.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { notificationService } from "../../../infrastructure/services/NotificationService";
import { normalizePhone, getPhoneMatchVariants } from "../../../shared/utils/phone";

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

    if (dto.teamId) {
      await this.validateTeamAssignment(dto.franchiseId, dto.teamId);
    }

    let academyName = "Your Academy";
    try {
      const academy = await AcademyModel.findById(franchise.academyId).select("name").lean();
      if (academy?.name) academyName = academy.name;
    } catch {}

    const loginEmail = (dto.guardian?.email || dto.email).trim().toLowerCase();
    const cleanPhone = normalizePhone(dto.guardian?.phone || "");

    // Check if an account already exists with this email OR phone
    const existingUser = await UserModel.findOne({
      $or: [
        { email: loginEmail },
        ...(cleanPhone ? [{ phone: { $in: getPhoneMatchVariants(cleanPhone) } }] : []),
      ],
    });

    let guardianUser: any;
    let isNewGuardian = false;
    let tempPassword = "";
    const guardianParts = (dto.guardian?.name || "").trim().split(" ");
    const guardianFirstName = guardianParts[0] || dto.firstName;
    const guardianLastName = guardianParts.slice(1).join(" ") || "Guardian";

    if (existingUser) {
      if (existingUser.role !== "guardian") {
        throw new ConflictError(
          `An account with this ${existingUser.email === loginEmail ? "email" : "phone number"} already exists with role: ${existingUser.role}.`,
        );
      }

      // Check if this student is already registered under this guardian
      const duplicateStudent = await StudentModel.findOne({
        guardianIds: existingUser._id,
        firstName: new RegExp(`^${dto.firstName.trim()}$`, "i"),
        lastName: new RegExp(`^${dto.lastName.trim()}$`, "i"),
        deletedAt: { $exists: false },
      });
      if (duplicateStudent) {
        throw new ConflictError(`Player ${dto.firstName} ${dto.lastName} is already registered under this guardian.`);
      }

      guardianUser = existingUser;
      isNewGuardian = false;
    } else {
      // If neither email nor phone matched an existing user, verify phone isn't used by any other user account
      if (cleanPhone) {
        const phoneTaken = await UserModel.findOne({
          phone: { $in: getPhoneMatchVariants(cleanPhone) },
        });
        if (phoneTaken) {
          throw new ConflictError("An account with this phone number already exists.");
        }
      }

      // Check if an active student is already registered with this guardian email
      const existingStudent = await StudentModel.findOne({
        "guardian.email": loginEmail,
        deletedAt: { $exists: false },
      });
      if (existingStudent) {
        throw new ConflictError("A player with this email is already registered.");
      }

      tempPassword = Math.random().toString(36).slice(-8) + "!1Aa";
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const createdUser = await this.userRepo.create({
        email: loginEmail,
        passwordHash,
        role: "guardian",
        firstName: guardianFirstName,
        lastName: guardianLastName,
        phone: cleanPhone || dto.guardian?.phone || "",
        isActive: true,
        isEmailVerified: true,
        permissions: defaultPermissions["guardian" as UserRole],
        fcmTokens: [],
        franchiseId: dto.franchiseId,
        academyId: franchise.academyId.toString(),
      });
      guardianUser = createdUser;
      isNewGuardian = true;
    }

    const studentData: Partial<StudentEntity> = {
      userId: guardianUser._id ? guardianUser._id.toString() : guardianUser.id,
      franchiseId: dto.franchiseId,
      teamId: dto.teamId,
      coachId: dto.coachId,
      guardianIds: [guardianUser._id ? guardianUser._id.toString() : guardianUser.id],
      guardian: {
        name: dto.guardian?.name || `${guardianUser.firstName} ${guardianUser.lastName}`,
        email: guardianUser.email || loginEmail,
        phone: cleanPhone || guardianUser.phone || dto.guardian?.phone || "",
      },
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: new Date(dto.dateOfBirth),
      ageGroup: dto.ageGroup,
      jerseyNumber: dto.jerseyNumber,
      jerseySize: dto.jerseySize,
      position: dto.position,
      positions: dto.positions,
      photo: dto.photo,
      medicalInfo: dto.medicalInfo,
      enrollmentDate: new Date(),
      isActive: true,
      attendancePercentage: 0,
      overallRating: 0,
      selectionStatus: "pending",
      transferStatus: "not_listed",
      publicProfileToken: crypto.randomBytes(16).toString("hex"),
      publicProfileEnabled: true,
    };

    let createdStudent: StudentEntity;
    try {
      createdStudent = await this.studentRepo.create(studentData);
    } catch (err) {
      if (isNewGuardian) {
        const uid = guardianUser._id || guardianUser.id;
        await UserModel.deleteOne({ _id: uid }).catch(() => undefined);
      }
      throw err;
    }

    // Send notification email
    if (isNewGuardian && tempPassword) {
      try {
        await notificationService.sendAccountCredentialsEmail({
          to: loginEmail,
          recipientName: dto.guardian?.name || `${guardianFirstName} ${guardianLastName}`,
          role: "guardian",
          password: tempPassword,
          loginUrl: `${config.clientUrl}/login`,
          studentName: `${dto.firstName} ${dto.lastName}`,
          academyName,
        });
      } catch (mailErr) {
        console.error("[createStudent] Failed to send credentials email:", mailErr);
      }
    } else if (!isNewGuardian) {
      try {
        await notificationService.sendStudentLinkedEmail({
          to: loginEmail,
          guardianName: dto.guardian?.name || `${guardianUser.firstName} ${guardianUser.lastName}`,
          studentName: `${dto.firstName} ${dto.lastName}`,
          academyName,
          loginUrl: `${config.clientUrl}/login`,
        });
      } catch (mailErr) {
        console.error("[createStudent] Failed to send student linked email:", mailErr);
      }
    }

    return createdStudent;
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
        if (!existing.franchiseId) {
          throw new BadRequestError("Student must belong to a franchise before being assigned to a team");
        }
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

  // Backs the printable per-student report (performance, attendance,
  // fees) reachable from the player's page — pulls a longer history than
  // getPlayerCard (which is tuned for the at-a-glance ID-card view) since
  // a report is meant to be a fuller record, not a summary.
  //
  // Unlike getPlayerCard (loosely authenticate-only — see its route
  // comment), this returns full fee/payment history and coach remarks,
  // so it gets its own real authorization check rather than inheriting
  // that same looseness: manager/coach of the student's own
  // academy/franchise, the student's own guardian, an employee with
  // canViewReports, or super_admin.
  async getStudentReport(
    studentId: string,
    requester: { userId: string; role: string; academyId?: string; franchiseId?: string; permissions?: Record<string, boolean> },
  ): Promise<any> {
    const student = await this.getStudentById(studentId);
    const franchise = await FranchiseModel.findById(student.franchiseId).select("academyId").lean();
    const studentAcademyId = franchise?.academyId?.toString();

    const isSuperAdmin = requester.role === "super_admin";
    const isSameAcademyStaff =
      (requester.role === "manager" || requester.role === "coach") &&
      (requester.academyId === studentAcademyId || requester.franchiseId === student.franchiseId);
    const isOwnGuardian = requester.role === "guardian" && student.guardianIds.includes(requester.userId);
    const isPermittedEmployee =
      requester.role === "employee" && requester.academyId === studentAcademyId && !!requester.permissions?.canViewReports;

    if (!isSuperAdmin && !isSameAcademyStaff && !isOwnGuardian && !isPermittedEmployee) {
      throw new ForbiddenError("You don't have access to this player's report");
    }

    const [performances, attendance, remarks, fees] = await Promise.all([
      this.studentRepo.getPerformanceHistory(studentId, 100),
      this.studentRepo.getAttendanceHistory(studentId, 180),
      this.studentRepo.getRemarks(studentId),
      FeeModel.find({ studentId }).sort({ createdAt: -1 }).lean(),
    ]);

    const totalSessions = attendance.length;
    const presentCount = attendance.filter((a: any) => a.status === "present" || a.status === "late").length;
    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

    const feesSummary = fees.reduce(
      (acc, fee: any) => {
        acc.totalBilled += fee.finalAmount;
        acc.totalPaid += fee.installments.reduce((s: number, i: any) => s + i.paidAmount, 0);
        return acc;
      },
      { totalBilled: 0, totalPaid: 0 },
    );

    return {
      student,
      performances,
      attendance,
      remarks,
      fees,
      summary: {
        attendanceRate,
        totalSessions,
        totalBilled: feesSummary.totalBilled,
        totalPaid: feesSummary.totalPaid,
        totalOutstanding: feesSummary.totalBilled - feesSummary.totalPaid,
        generatedAt: new Date(),
      },
    };
  }

  // ─── Free Public Student Registration (Standalone) ──────────────────────────
  async registerPublicStudent(dto: RegisterPublicStudentDto): Promise<{
    user: any;
    tokens: { accessToken: string; refreshToken: string; expiresIn: number };
    token: string;
    student: any;
  }> {
    const cleanEmail = (dto.email || dto.guardianEmail)!.trim().toLowerCase();
    const rawPhone = (dto.phone || dto.guardianPhone || "").trim();
    const cleanPhone = rawPhone ? normalizePhone(rawPhone) : "";
    const existing = await this.userRepo.findByEmail(cleanEmail);
    if (existing) {
      const existingStudent = await StudentModel.findOne({
        userId: existing.id || (existing as any)._id,
      });
      if (!existingStudent) {
        // Orphaned user from previous failed registration attempt - delete so user can re-register cleanly
        await UserModel.deleteOne({ _id: existing.id || (existing as any)._id });
      } else {
        throw new ConflictError("An account with this email already exists. Please log in.");
      }
    }
    if (cleanPhone) {
      const existingPhone = await UserModel.findOne({
        phone: { $in: getPhoneMatchVariants(cleanPhone) },
      });
      if (existingPhone) {
        const existingStudent = await StudentModel.findOne({
          userId: existingPhone.id || (existingPhone as any)._id,
        });
        if (!existingStudent) {
          await UserModel.deleteOne({ _id: existingPhone.id || (existingPhone as any)._id });
        } else {
          throw new ConflictError("An account with this phone number already exists. Please log in.");
        }
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userRepo.create({
      email: cleanEmail,
      passwordHash,
      role: "student",
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      phone: cleanPhone || undefined,
      isActive: true,
      isEmailVerified: true,
      permissions: defaultPermissions["student" as UserRole],
      fcmTokens: [],
    });

    const birthDate = new Date(dto.dateOfBirth);
    const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const ageGroup = dto.ageGroup || `U-${Math.max(6, Math.min(25, age + 1))}`;

    let student;
    try {
      student = await StudentModel.create({
        userId: user.id,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        dateOfBirth: birthDate,
        ageGroup,
        position: dto.position || "Forward",
        guardian: dto.guardian || {
          name: dto.guardianName || `${dto.firstName} ${dto.lastName}`,
          phone: cleanPhone || "",
          email: "",
        },
        guardianIds: [],
        medicalInfo: {
          emergencyContactName: dto.guardianName || `${dto.firstName} ${dto.lastName}`,
          emergencyContactPhone: cleanPhone || "",
        },
        enrollmentDate: new Date(),
        isActive: true,
        status: "active",
        attendancePercentage: 0,
        overallRating: 0,
        selectionStatus: "pending",
        transferStatus: "not_listed",
        publicProfileToken: crypto.randomBytes(16).toString("hex"),
        publicProfileEnabled: true,
      });
    } catch (err) {
      await UserModel.deleteOne({ _id: user.id }).catch(() => undefined);
      throw err;
    }

    const tokens = {
      accessToken: jwt.sign(
        { sub: user.id, role: user.role, permissions: user.permissions },
        config.jwt.accessSecret,
        { expiresIn: config.jwt.accessExpiresIn }
      ),
      refreshToken: jwt.sign(
        { sub: user.id },
        config.jwt.refreshSecret,
        { expiresIn: config.jwt.refreshExpiresIn }
      ),
      expiresIn: 15 * 60,
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token: tokens.accessToken,
      tokens,
      student,
    };
  }

  // ─── Unattached Public Students List (For Academy Managers) ─────────────────
  async getUnattachedStudents(query?: string, ageGroup?: string, page = 1, limit = 50) {
    const conditions: any[] = [
      { $or: [{ franchiseId: { $exists: false } }, { franchiseId: null }] },
      { isActive: true },
    ];

    if (ageGroup) {
      conditions.push({ ageGroup });
    }

    if (query && query.trim()) {
      const clean = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const terms = clean.split(/\s+/).filter(Boolean);
      const termFilters = terms.map((term) => ({
        $or: [
          { firstName: { $regex: term, $options: "i" } },
          { lastName: { $regex: term, $options: "i" } },
          { position: { $regex: term, $options: "i" } },
        ],
      }));
      conditions.push({ $and: termFilters });
    }

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      StudentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      StudentModel.countDocuments(filter),
    ]);

    const mapped = items.map((s: any) => ({
      id: s._id.toString(),
      userId: s.userId?.toString(),
      firstName: s.firstName,
      lastName: s.lastName,
      dateOfBirth: s.dateOfBirth,
      ageGroup: s.ageGroup,
      position: s.position,
      photo: s.photo,
      overallRating: s.overallRating,
      guardian: s.guardian,
      publicProfileToken: s.publicProfileToken,
      createdAt: s.createdAt,
    }));

    return {
      students: mapped,
      items: mapped,
      total,
      page,
      pages: Math.ceil(total / limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Claim Unattached Student into Franchise ────────────────────────────────
  async claimUnattachedStudent(
    studentId: string,
    dto: ClaimStudentDto,
    managerAcademyId: string,
  ): Promise<StudentEntity> {
    const student = await StudentModel.findById(studentId);
    if (!student) throw new NotFoundError("Student");

    if (student.franchiseId) {
      throw new BadRequestError("This student is already registered with an academy franchise");
    }

    const franchise = await FranchiseModel.findById(dto.franchiseId).select("academyId name").lean();
    if (!franchise) throw new NotFoundError("Franchise");

    if (franchise.academyId.toString() !== managerAcademyId) {
      throw new ForbiddenError("You can only add students into franchises belonging to your academy");
    }

    // Check subscription quota
    await this.academySubscriptionUseCases.assertCanAddStudent(managerAcademyId);

    if (dto.teamId) {
      await this.validateTeamAssignment(dto.franchiseId, dto.teamId);
    }

    student.franchiseId = new mongoose.Types.ObjectId(dto.franchiseId);
    if (dto.teamId) student.teamId = new mongoose.Types.ObjectId(dto.teamId);
    if (dto.coachId) student.coachId = new mongoose.Types.ObjectId(dto.coachId);
    if (dto.jerseyNumber !== undefined) student.jerseyNumber = dto.jerseyNumber;
    if (dto.jerseySize) student.jerseySize = dto.jerseySize;
    if (dto.position) student.position = dto.position;
    student.enrollmentDate = new Date();
    await student.save();

    // Update student user record with franchise and academy context
    await UserModel.findByIdAndUpdate(student.userId, {
      franchiseId: new mongoose.Types.ObjectId(dto.franchiseId),
      academyId: new mongoose.Types.ObjectId(managerAcademyId),
    });

    // Also update any linked guardian users
    if (student.guardianIds && student.guardianIds.length > 0) {
      await UserModel.updateMany(
        { _id: { $in: student.guardianIds } },
        {
          $set: {
            franchiseId: new mongoose.Types.ObjectId(dto.franchiseId),
            academyId: new mongoose.Types.ObjectId(managerAcademyId),
          },
        },
      ).exec().catch(() => undefined);
    }

    // Send internal system alert to student
    await notificationService.send({
      userIds: [student.userId.toString()],
      type: "announcement",
      title: "Enrolled in Academy",
      body: `You have been added to ${franchise.name}! You can now see training sessions, attendance, and coach feedback in your portal.`,
      franchiseId: dto.franchiseId,
      channels: ["push"],
    }).catch(() => undefined);

    const updated = await this.studentRepo.findById(studentId);
    return updated!;
  }
}