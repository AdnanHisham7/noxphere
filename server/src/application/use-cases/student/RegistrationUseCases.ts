// src/application/use-cases/student/RegistrationUseCases.ts
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { RegistrationRequestModel } from "../../../infrastructure/database/models/RegistrationRequest.model";
import { RegistrationOtpModel } from "../../../infrastructure/database/models/RegistrationOtp.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { AcademySubscriptionUseCases } from "../subscription/AcademySubscriptionUseCases";
import { notificationService } from "../../../infrastructure/services/NotificationService";
import { defaultPermissions, UserRole } from "../../../domain/entities/User.entity";
import { config } from "../../../config/app.config";
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from "../../../shared/errors/AppError";
import { normalizePhone, getPhoneMatchVariants } from "../../../shared/utils/phone";

export interface SubmitRegistrationDto {
  academyId: string;
  franchiseId: string;
  existingStudentId?: string;
  studentDetails: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender?: string;
    ageGroup: string;
    position?: string;
    positions?: string[];
    jerseyNumber?: number;
    jerseySize?: string;
    photo?: string;
    medicalInfo?: {
      bloodGroup?: string;
      allergies?: string[];
      medicalConditions?: string[];
      emergencyContactName: string;
      emergencyContactPhone: string;
      medicalNotes?: string;
    };
  };
  guardianDetails: {
    name: string;
    phone: string;
    email: string;
    relation?: string;
  };
}

export interface ApproveRegistrationDto {
  franchiseId?: string;
  teamId?: string;
  coachId?: string;
  jerseyNumber?: number;
  jerseySize?: string;
  position?: string;
  positions?: string[];
  studentDetails?: Partial<SubmitRegistrationDto["studentDetails"]>;
  guardianDetails?: Partial<SubmitRegistrationDto["guardianDetails"]>;
}

export class RegistrationUseCases {
  constructor(private readonly academySubscriptionUseCases: AcademySubscriptionUseCases) {}

  async getAcademyPublicInfo(academyId: string) {
    if (!mongoose.Types.ObjectId.isValid(academyId)) {
      throw new NotFoundError("Academy not found");
    }
    const academy = await AcademyModel.findById(academyId).select("name location ageGroups").lean();
    if (!academy) throw new NotFoundError("Academy");

    const franchises = await FranchiseModel.find({ academyId, isActive: true })
      .select("name location ageGroups")
      .lean();

    return {
      academy: {
        id: (academy as any)._id.toString(),
        name: academy.name,
        location: academy.location,
        ageGroups: academy.ageGroups ?? [],
      },
      franchises: franchises.map((f: any) => ({
        id: f._id.toString(),
        name: f.name,
        location: f.location,
        ageGroups: f.ageGroups ?? [],
      })),
    };
  }

  async sendOtp(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const user = await UserModel.findOne({ email: cleanEmail, role: "student" });
    if (!user) {
      throw new NotFoundError("Student account with this email not found. Please sign up as a student first or proceed without linking.");
    }

    const student = await StudentModel.findOne({ userId: user._id });
    if (!student) {
      throw new NotFoundError("No student profile linked to this account");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await RegistrationOtpModel.deleteMany({ email: cleanEmail });
    await RegistrationOtpModel.create({
      email: cleanEmail,
      studentId: student._id,
      otp,
      expiresAt,
      verified: false,
    });

    // In a production system this sends via email transporter; we also log in dev/test
    console.log(`[Registration OTP] Generated OTP for ${cleanEmail}: ${otp}`);

    // If notification service has email configured, it will deliver it
    await notificationService.send({
      userIds: [user._id.toString()],
      type: "announcement",
      title: "Your Noxphere Verification Code",
      body: `Your verification code to link your student profile is: ${otp}. Valid for 10 minutes.`,
      emailSubject: "Your Noxphere Verification Code",
      emailHtml: `<p>Your verification code to link your student profile is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
      channels: ["email", "push"],
    }).catch(() => undefined);

    return {
      success: true,
      message: "Verification code sent to email",
      student: {
        id: student._id.toString(),
        name: `${student.firstName} ${student.lastName}`,
        ageGroup: student.ageGroup,
        position: student.position,
      },
    };
  }

  async verifyOtp(email: string, otp: string) {
    const cleanEmail = email.trim().toLowerCase();
    const record = await RegistrationOtpModel.findOne({
      email: cleanEmail,
      otp: otp.trim(),
    });

    if (!record) {
      throw new BadRequestError("Invalid verification code");
    }

    if (new Date() > record.expiresAt) {
      throw new BadRequestError("Verification code has expired. Please request a new one.");
    }

    record.verified = true;
    await record.save();

    const student = await StudentModel.findById(record.studentId).lean();

    return {
      verified: true,
      studentId: record.studentId.toString(),
      student: student
        ? {
            id: (student as any)._id.toString(),
            firstName: student.firstName,
            lastName: student.lastName,
            dateOfBirth: student.dateOfBirth,
            position: student.position,
            ageGroup: student.ageGroup,
            guardian: student.guardian,
          }
        : null,
    };
  }

  async submitRequest(dto: SubmitRegistrationDto) {
    const [academy, franchise] = await Promise.all([
      AcademyModel.findById(dto.academyId).select("name").lean(),
      FranchiseModel.findById(dto.franchiseId).select("name academyId").lean(),
    ]);
    if (!academy) throw new NotFoundError("Academy");
    if (!franchise) throw new NotFoundError("Franchise");
    if (franchise.academyId.toString() !== dto.academyId) {
      throw new BadRequestError("Selected franchise does not belong to this academy");
    }

    let existingStudentId: mongoose.Types.ObjectId | undefined;
    if (dto.existingStudentId) {
      const student = await StudentModel.findById(dto.existingStudentId);
      if (!student) throw new NotFoundError("Existing student profile not found");
      existingStudentId = student._id as mongoose.Types.ObjectId;

      const pendingRequest = await RegistrationRequestModel.findOne({
        existingStudentId: student._id,
        academyId: new mongoose.Types.ObjectId(dto.academyId),
        status: "pending",
      });
      if (pendingRequest) {
        throw new ConflictError("A registration request for this student profile is already pending review.");
      }
    } else {
      const cleanGuardianEmail = dto.guardianDetails.email.trim().toLowerCase();
      const cleanGuardianPhone = normalizePhone(dto.guardianDetails.phone.trim());

      // Check if an account already exists with this guardian email or phone
      const existingUser = await UserModel.findOne({
        $or: [
          { email: cleanGuardianEmail },
          ...(cleanGuardianPhone ? [{ phone: { $in: getPhoneMatchVariants(cleanGuardianPhone) } }] : []),
        ],
      });

      if (existingUser) {
        if (existingUser.role !== "guardian") {
          throw new ConflictError(
            `An account with this ${existingUser.email === cleanGuardianEmail ? "email" : "phone number"} already exists with role ${existingUser.role}. Please use a different contact or contact your academy administrator.`,
          );
        }

        // The user is an existing guardian! Check if THIS player is already registered under this guardian
        const existingStudent = await StudentModel.findOne({
          $or: [
            { guardianIds: existingUser._id },
            { "guardian.email": cleanGuardianEmail },
            ...(cleanGuardianPhone ? [{ "guardian.phone": { $in: getPhoneMatchVariants(cleanGuardianPhone) } }] : []),
          ],
          firstName: new RegExp(`^${dto.studentDetails.firstName.trim()}$`, "i"),
          lastName: new RegExp(`^${dto.studentDetails.lastName.trim()}$`, "i"),
          deletedAt: { $exists: false },
        });
        if (existingStudent) {
          throw new ConflictError("A player with this name is already registered under your guardian account.");
        }

        // Check if a registration request for THIS player is already pending for this academy
        const pendingRequest = await RegistrationRequestModel.findOne({
          academyId: new mongoose.Types.ObjectId(dto.academyId),
          $or: [
            { "guardianDetails.email": cleanGuardianEmail },
            ...(cleanGuardianPhone ? [{ "guardianDetails.phone": { $in: getPhoneMatchVariants(cleanGuardianPhone) } }] : []),
          ],
          "studentDetails.firstName": new RegExp(`^${dto.studentDetails.firstName.trim()}$`, "i"),
          "studentDetails.lastName": new RegExp(`^${dto.studentDetails.lastName.trim()}$`, "i"),
          status: "pending",
        });
        if (pendingRequest) {
          throw new ConflictError("A registration request for this player is already pending review.");
        }
      } else {
        // Brand new guardian registration:
        // Check if an active student is already registered with this exact player name & guardian email/phone
        const existingStudent = await StudentModel.findOne({
          $or: [
            { "guardian.email": cleanGuardianEmail },
            ...(cleanGuardianPhone ? [{ "guardian.phone": { $in: getPhoneMatchVariants(cleanGuardianPhone) } }] : []),
          ],
          firstName: new RegExp(`^${dto.studentDetails.firstName.trim()}$`, "i"),
          lastName: new RegExp(`^${dto.studentDetails.lastName.trim()}$`, "i"),
          deletedAt: { $exists: false },
        });
        if (existingStudent) {
          throw new ConflictError("A player with this name and guardian contact is already registered.");
        }

        // Check if a registration request for this player is already pending
        const pendingRequest = await RegistrationRequestModel.findOne({
          academyId: new mongoose.Types.ObjectId(dto.academyId),
          $or: [
            { "guardianDetails.email": cleanGuardianEmail },
            ...(cleanGuardianPhone ? [{ "guardianDetails.phone": { $in: getPhoneMatchVariants(cleanGuardianPhone) } }] : []),
          ],
          "studentDetails.firstName": new RegExp(`^${dto.studentDetails.firstName.trim()}$`, "i"),
          "studentDetails.lastName": new RegExp(`^${dto.studentDetails.lastName.trim()}$`, "i"),
          status: "pending",
        });
        if (pendingRequest) {
          throw new ConflictError("A registration request for this player is already pending review.");
        }
      }
    }

    const request = await RegistrationRequestModel.create({
      academyId: new mongoose.Types.ObjectId(dto.academyId),
      franchiseId: new mongoose.Types.ObjectId(dto.franchiseId),
      existingStudentId,
      studentDetails: {
        firstName: dto.studentDetails.firstName.trim(),
        lastName: dto.studentDetails.lastName.trim(),
        dateOfBirth: new Date(dto.studentDetails.dateOfBirth),
        gender: dto.studentDetails.gender,
        ageGroup: dto.studentDetails.ageGroup,
        position: dto.studentDetails.position,
        positions: dto.studentDetails.positions,
        jerseyNumber: dto.studentDetails.jerseyNumber,
        jerseySize: dto.studentDetails.jerseySize,
        photo: dto.studentDetails.photo,
        medicalInfo: dto.studentDetails.medicalInfo,
      },
      guardianDetails: {
        name: dto.guardianDetails.name.trim(),
        phone: dto.guardianDetails.phone.trim(),
        email: dto.guardianDetails.email.trim().toLowerCase(),
        relation: dto.guardianDetails.relation,
      },
      status: "pending",
    });

    // Notify academy managers about the new registration request
    const managers = await UserModel.find({
      $or: [{ academyId: dto.academyId, role: "manager" }, { franchiseId: dto.franchiseId, role: "manager" }],
      isActive: true,
    })
      .select("_id")
      .lean();

    if (managers.length > 0) {
      const managerIds = managers.map((m) => m._id.toString());
      await notificationService.send({
        userIds: managerIds,
        type: "registration_received",
        title: "New Student Registration Request",
        body: `${dto.studentDetails.firstName} ${dto.studentDetails.lastName} has submitted a registration application for ${franchise.name}.`,
        franchiseId: dto.franchiseId,
        channels: ["push"],
      }).catch(() => undefined);
    }

    return {
      id: request._id.toString(),
      message: "Registration request submitted successfully. The academy manager will review your application.",
    };
  }

  async listRequests(academyId?: string, franchiseId?: string, status?: string) {
    let targetAcademyId = academyId;
    if (!targetAcademyId && franchiseId && mongoose.Types.ObjectId.isValid(franchiseId)) {
      const franchise = await FranchiseModel.findById(franchiseId).select("academyId").lean();
      if (franchise?.academyId) {
        targetAcademyId = franchise.academyId.toString();
      }
    }

    const filter: any = {};
    if (targetAcademyId && mongoose.Types.ObjectId.isValid(targetAcademyId)) {
      filter.academyId = new mongoose.Types.ObjectId(targetAcademyId);
    }
    if (franchiseId && franchiseId !== "all" && mongoose.Types.ObjectId.isValid(franchiseId)) {
      filter.franchiseId = new mongoose.Types.ObjectId(franchiseId);
    }
    if (status && status !== "all") {
      filter.status = status;
    }

    const requests = await RegistrationRequestModel.find(filter)
      .populate("franchiseId", "name")
      .populate("reviewedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();

    return requests.map((r: any) => ({
      id: r._id.toString(),
      academyId: r.academyId?.toString(),
      franchiseId: r.franchiseId?._id?.toString() || r.franchiseId?.toString(),
      franchiseName: r.franchiseId?.name || "Unassigned",
      existingStudentId: r.existingStudentId?.toString(),
      studentDetails: r.studentDetails,
      guardianDetails: r.guardianDetails,
      status: r.status,
      rejectionReason: r.rejectionReason,
      reviewedBy: r.reviewedBy ? `${r.reviewedBy.firstName} ${r.reviewedBy.lastName}` : undefined,
      reviewedAt: r.reviewedAt,
      enrolledStudentId: r.enrolledStudentId?.toString(),
      createdAt: r.createdAt,
    }));
  }

  async rejectRequest(requestId: string, reason: string, reviewedBy: string) {
    const request = await RegistrationRequestModel.findById(requestId);
    if (!request) throw new NotFoundError("Registration request");
    if (request.status !== "pending") {
      throw new BadRequestError(`Cannot reject a request that is already ${request.status}`);
    }

    request.status = "rejected";
    request.rejectionReason = reason;
    request.reviewedBy = new mongoose.Types.ObjectId(reviewedBy);
    request.reviewedAt = new Date();
    await request.save();

    // Notify applicant if an existing student account is tied
    if (request.existingStudentId) {
      const student = await StudentModel.findById(request.existingStudentId).select("userId").lean();
      if (student?.userId) {
        await notificationService.send({
          userIds: [student.userId.toString()],
          type: "registration_rejected",
          title: "Registration Request Update",
          body: `Your registration request was not approved.${reason ? ` Reason: ${reason}` : ""}`,
          channels: ["push"],
        }).catch(() => undefined);
      }
    }

    return { id: request._id.toString(), status: "rejected" };
  }

  async approveRequest(requestId: string, approvalDto: ApproveRegistrationDto, reviewedBy: string) {
    const request = await RegistrationRequestModel.findById(requestId);
    if (!request) throw new NotFoundError("Registration request");
    if (request.status !== "pending") {
      throw new BadRequestError(`Cannot approve a request that is already ${request.status}`);
    }

    const targetFranchiseId = approvalDto.franchiseId || request.franchiseId.toString();
    const franchise = await FranchiseModel.findById(targetFranchiseId).select("academyId name").lean();
    if (!franchise) throw new NotFoundError("Franchise");

    // Enforce subscription quota before approving student
    await this.academySubscriptionUseCases.assertCanAddStudent(franchise.academyId.toString());

    // Validate team if assigned
    if (approvalDto.teamId) {
      const team = await TeamModel.findById(approvalDto.teamId).select("franchiseId academyId").lean();
      if (!team) throw new BadRequestError("Selected team not found");
    }

    let enrolledStudentDoc: any;

    if (request.existingStudentId) {
      // ── Linking existing public student profile ──
      const existingStudent = await StudentModel.findById(request.existingStudentId);
      if (!existingStudent) throw new NotFoundError("Linked student profile not found");

      // Update student profile with academy and franchise assignments
      existingStudent.franchiseId = new mongoose.Types.ObjectId(targetFranchiseId);
      if (approvalDto.teamId) existingStudent.teamId = new mongoose.Types.ObjectId(approvalDto.teamId);
      if (approvalDto.coachId) existingStudent.coachId = new mongoose.Types.ObjectId(approvalDto.coachId);
      if (approvalDto.jerseyNumber !== undefined) existingStudent.jerseyNumber = approvalDto.jerseyNumber;
      if (approvalDto.jerseySize) existingStudent.jerseySize = approvalDto.jerseySize;
      if (approvalDto.position) existingStudent.position = approvalDto.position;
      if (approvalDto.positions) existingStudent.positions = approvalDto.positions;

      // Update editable student details if provided in approval
      if (approvalDto.studentDetails) {
        if (approvalDto.studentDetails.firstName) existingStudent.firstName = approvalDto.studentDetails.firstName.trim();
        if (approvalDto.studentDetails.lastName) existingStudent.lastName = approvalDto.studentDetails.lastName.trim();
        if (approvalDto.studentDetails.dateOfBirth) existingStudent.dateOfBirth = new Date(approvalDto.studentDetails.dateOfBirth);
        if (approvalDto.studentDetails.ageGroup) existingStudent.ageGroup = approvalDto.studentDetails.ageGroup;
        if (approvalDto.studentDetails.medicalInfo) existingStudent.medicalInfo = approvalDto.studentDetails.medicalInfo as any;
      }

      // Update guardian info
      const guardianEmail = (approvalDto.guardianDetails?.email || request.guardianDetails.email).trim().toLowerCase();
      const guardianName = (approvalDto.guardianDetails?.name || request.guardianDetails.name).trim();
      const guardianPhone = (approvalDto.guardianDetails?.phone || request.guardianDetails.phone).trim();

      existingStudent.guardian = {
        name: guardianName,
        phone: guardianPhone,
        email: guardianEmail,
      };
      existingStudent.enrollmentDate = new Date();
      existingStudent.isActive = true;
      existingStudent.status = "active";

      await existingStudent.save();
      enrolledStudentDoc = existingStudent;

      // Update user login credential email to guardian email as requested
      const user = await UserModel.findById(existingStudent.userId);
      if (user) {
        // Check if guardian email belongs to another existing user
        const existingWithEmail = await UserModel.findOne({
          email: guardianEmail,
          _id: { $ne: user._id },
        });

        if (!existingWithEmail) {
          user.email = guardianEmail;
        }
        user.phone = guardianPhone;
        user.franchiseId = targetFranchiseId;
        user.academyId = franchise.academyId.toString();
        await user.save();
      }
    } else {
      // ── Creating / resolving guardian account under this franchise ──
      const guardianEmail = (approvalDto.guardianDetails?.email || request.guardianDetails.email).trim().toLowerCase();
      const guardianName = (approvalDto.guardianDetails?.name || request.guardianDetails.name).trim();
      const guardianPhone = normalizePhone((approvalDto.guardianDetails?.phone || request.guardianDetails.phone).trim());

      // Check if user already exists with this email OR phone
      const existingUser = await UserModel.findOne({
        $or: [
          { email: guardianEmail },
          ...(guardianPhone ? [{ phone: { $in: getPhoneMatchVariants(guardianPhone) } }] : []),
        ],
      });

      let guardianUser: any;
      let isNewGuardianUser = false;
      let tempPassword = "";

      if (existingUser) {
        if (existingUser.role !== "guardian") {
          throw new ConflictError(
            `A user account with this ${existingUser.email === guardianEmail ? "email" : "phone number"} already exists with role: ${existingUser.role}. Cannot enroll player.`,
          );
        }

        // Existing guardian account — check if this player is already enrolled
        const studentFirstName = (approvalDto.studentDetails?.firstName || request.studentDetails.firstName).trim();
        const studentLastName = (approvalDto.studentDetails?.lastName || request.studentDetails.lastName).trim();
        const existingStudent = await StudentModel.findOne({
          guardianIds: existingUser._id,
          firstName: new RegExp(`^${studentFirstName}$`, "i"),
          lastName: new RegExp(`^${studentLastName}$`, "i"),
          deletedAt: { $exists: false },
        });
        if (existingStudent) {
          throw new ConflictError("A player with this name is already enrolled under this guardian.");
        }

        guardianUser = existingUser;
        isNewGuardianUser = false;
      } else {
        // If phone is supplied, ensure it's not taken by any other user
        if (guardianPhone) {
          const existingPhone = await UserModel.findOne({
            phone: { $in: getPhoneMatchVariants(guardianPhone) },
          });
          if (existingPhone) {
            throw new ConflictError("A user account with this phone number already exists.");
          }
        }

        const guardianParts = guardianName.split(" ");
        const gFirstName = guardianParts[0] || "Guardian";
        const gLastName = guardianParts.slice(1).join(" ") || "-";

        tempPassword = Math.random().toString(36).slice(-8) + "!1Aa";
        const passwordHash = await bcrypt.hash(tempPassword, 12);
        guardianUser = await UserModel.create({
          email: guardianEmail,
          passwordHash,
          role: "guardian",
          firstName: gFirstName,
          lastName: gLastName,
          phone: guardianPhone,
          isActive: true,
          isEmailVerified: true,
          permissions: defaultPermissions["guardian" as UserRole],
          fcmTokens: [],
          franchiseId: targetFranchiseId,
          academyId: franchise.academyId.toString(),
        });
        isNewGuardianUser = true;
      }

      try {
        enrolledStudentDoc = await StudentModel.create({
          userId: guardianUser._id,
          franchiseId: new mongoose.Types.ObjectId(targetFranchiseId),
          teamId: approvalDto.teamId ? new mongoose.Types.ObjectId(approvalDto.teamId) : undefined,
          coachId: approvalDto.coachId ? new mongoose.Types.ObjectId(approvalDto.coachId) : undefined,
          guardianIds: [guardianUser._id],
          guardian: {
            name: guardianName || `${guardianUser.firstName} ${guardianUser.lastName}`,
            phone: guardianPhone || guardianUser.phone,
            email: guardianEmail || guardianUser.email,
          },
          firstName: approvalDto.studentDetails?.firstName?.trim() || request.studentDetails.firstName,
          lastName: approvalDto.studentDetails?.lastName?.trim() || request.studentDetails.lastName,
          dateOfBirth: approvalDto.studentDetails?.dateOfBirth ? new Date(approvalDto.studentDetails.dateOfBirth) : request.studentDetails.dateOfBirth,
          ageGroup: approvalDto.studentDetails?.ageGroup || request.studentDetails.ageGroup,
          jerseyNumber: approvalDto.jerseyNumber ?? request.studentDetails.jerseyNumber,
          jerseySize: approvalDto.jerseySize || request.studentDetails.jerseySize,
          position: approvalDto.position || request.studentDetails.position,
          positions: approvalDto.positions || request.studentDetails.positions,
          photo: approvalDto.studentDetails?.photo || request.studentDetails.photo,
          medicalInfo: (approvalDto.studentDetails?.medicalInfo || request.studentDetails.medicalInfo || {
            emergencyContactName: guardianName,
            emergencyContactPhone: guardianPhone,
          }) as any,
          enrollmentDate: new Date(),
          isActive: true,
          status: "active",
          attendancePercentage: 0,
          overallRating: 0,
          selectionStatus: "selected",
          transferStatus: "not_listed",
          publicProfileToken: crypto.randomBytes(16).toString("hex"),
          publicProfileEnabled: true,
        });
      } catch (err) {
        if (isNewGuardianUser) {
          await UserModel.deleteOne({ _id: guardianUser._id }).catch(() => undefined);
        }
        throw err;
      }

      if (isNewGuardianUser && tempPassword) {
        try {
          await notificationService.sendAccountCredentialsEmail({
            to: guardianEmail,
            recipientName: guardianName,
            role: "guardian",
            password: tempPassword,
            loginUrl: `${config.clientUrl}/login`,
            studentName: `${enrolledStudentDoc.firstName} ${enrolledStudentDoc.lastName}`,
            academyName: franchise.name,
          });
        } catch (mailErr) {
          console.error("[approveRequest] Failed to send credentials email:", mailErr);
        }
      } else if (!isNewGuardianUser) {
        try {
          await notificationService.sendStudentLinkedEmail({
            to: guardianEmail,
            guardianName: guardianName || `${guardianUser.firstName} ${guardianUser.lastName}`,
            studentName: `${enrolledStudentDoc.firstName} ${enrolledStudentDoc.lastName}`,
            academyName: franchise.name,
            loginUrl: `${config.clientUrl}/login`,
          });
        } catch (mailErr) {
          console.error("[approveRequest] Failed to send student linked email:", mailErr);
        }
      }
    }

    request.status = "approved";
    request.enrolledStudentId = enrolledStudentDoc._id;
    request.reviewedBy = new mongoose.Types.ObjectId(reviewedBy);
    request.reviewedAt = new Date();
    await request.save();

    // ── Dispatch internal system alerts ──
    if (enrolledStudentDoc.userId) {
      await notificationService.send({
        userIds: [enrolledStudentDoc.userId.toString()],
        type: "registration_approved",
        title: "Welcome to the Academy!",
        body: `Your registration under ${franchise.name} has been approved. You are now officially enrolled.`,
        franchiseId: targetFranchiseId,
        channels: ["push"],
      }).catch(() => undefined);
    }

    await notificationService.send({
      userIds: [reviewedBy],
      type: "registration_approved",
      title: "Student Enrolled",
      body: `${enrolledStudentDoc.firstName} ${enrolledStudentDoc.lastName} has been successfully registered under ${franchise.name}.`,
      franchiseId: targetFranchiseId,
      channels: ["push"],
    }).catch(() => undefined);

    return {
      id: request._id.toString(),
      status: "approved",
      studentId: enrolledStudentDoc._id.toString(),
    };
  }
}
