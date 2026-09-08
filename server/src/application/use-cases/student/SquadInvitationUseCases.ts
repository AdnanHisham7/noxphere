// src/application/use-cases/student/SquadInvitationUseCases.ts
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { SquadInvitationModel } from '../../../infrastructure/database/models/SquadInvitation.model';
import { StudentModel } from '../../../infrastructure/database/models/Student.model';
import { AcademyModel } from '../../../infrastructure/database/models/Academy.model';
import { FranchiseModel } from '../../../infrastructure/database/models/Franchise.model';
import { TeamModel } from '../../../infrastructure/database/models/Team.model';
import { UserModel } from '../../../infrastructure/database/models/User.model';
import { UserNotificationModel } from '../../../infrastructure/database/models/UserNotification.model';
import { RegistrationOtpModel } from '../../../infrastructure/database/models/RegistrationOtp.model';
import { notificationService } from '../../../infrastructure/services/NotificationService';
import { defaultPermissions, UserRole } from '../../../domain/entities/User.entity';
import { config } from '../../../config/app.config';
import { AcademySubscriptionUseCases } from '../subscription/AcademySubscriptionUseCases';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
} from '../../../shared/errors/AppError';

export interface SendSquadInvitationDto {
  studentId: string;
  franchiseId: string;
  teamId?: string;
  jerseyNumber?: number;
  position?: string;
  notes?: string;
}

export interface RespondSquadInvitationDto {
  action: 'accept' | 'reject';
  rejectionReason?: string;
  guardianEmail?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianPassword?: string;
  otp?: string;
}

export class SquadInvitationUseCases {
  constructor(
    private readonly academySubscriptionUseCases: AcademySubscriptionUseCases
  ) {}

  /**
   * Send a squad recruitment invitation to a free agent student.
   * Academies cannot unilaterally enroll free agents; the player must accept.
   * Also verifies academy subscription student limits before allowing the invite.
   */
  async sendInvitation(
    invitedByUserId: string,
    academyId: string,
    dto: SendSquadInvitationDto
  ) {
    if (!dto.studentId || !dto.franchiseId) {
      throw new BadRequestError('studentId and franchiseId are required');
    }

    const student = await StudentModel.findById(dto.studentId);
    if (!student) throw new NotFoundError('Student');

    if (student.franchiseId) {
      throw new BadRequestError(
        'This player is already an enrolled student with an academy.'
      );
    }

    const franchise = await FranchiseModel.findById(dto.franchiseId).lean();
    if (!franchise) throw new NotFoundError('Franchise');

    if (franchise.academyId.toString() !== academyId) {
      throw new ForbiddenError(
        'You can only invite players to franchises belonging to your academy.'
      );
    }

    if (dto.teamId) {
      const team = await TeamModel.findById(dto.teamId).lean();
      if (!team || team.franchiseId?.toString() !== dto.franchiseId) {
        throw new BadRequestError('The specified team does not belong to this franchise.');
      }
    }

    // Verify academy subscription capacity before allowing invite (including pending invitations)
    await this.academySubscriptionUseCases.assertCanInviteStudent(academyId);

    // Prevent duplicate pending invitations for same student & academy
    const existingPending = await SquadInvitationModel.findOne({
      studentId: student._id,
      academyId: new mongoose.Types.ObjectId(academyId),
      status: 'pending',
    });

    if (existingPending) {
      throw new ConflictError(
        'A pending invitation has already been sent to this player by your academy.'
      );
    }

    const academy = await AcademyModel.findById(academyId).select('name logo');

    const invitation = await SquadInvitationModel.create({
      studentId: student._id,
      academyId: new mongoose.Types.ObjectId(academyId),
      franchiseId: new mongoose.Types.ObjectId(dto.franchiseId),
      teamId: dto.teamId ? new mongoose.Types.ObjectId(dto.teamId) : undefined,
      invitedBy: new mongoose.Types.ObjectId(invitedByUserId),
      jerseyNumber: dto.jerseyNumber,
      position: dto.position,
      notes: dto.notes,
      status: 'pending',
    });

    // Notify the student about the recruitment offer
    await UserNotificationModel.create({
      userId: student.userId,
      type: 'squad_invitation_received',
      title: 'Squad Recruitment Invitation! ⚽',
      body: `${academy?.name || 'An academy'} has invited you to join their squad! Check your dashboard to view and accept the offer.`,
      data: {
        invitationId: invitation.id,
        academyId,
        franchiseId: dto.franchiseId,
      },
    });

    return invitation;
  }

  /**
   * Send a 6-digit OTP to the guardian's email for verification during squad invitation acceptance.
   */
  async sendGuardianOtp(
    studentUserId: string,
    invitationId: string,
    guardianEmail: string
  ): Promise<{ success: boolean; isExistingGuardian: boolean; message: string }> {
    if (!invitationId || !mongoose.Types.ObjectId.isValid(invitationId)) {
      throw new BadRequestError('Invalid or missing squad invitation ID');
    }

    const cleanGuardianEmail = guardianEmail.trim().toLowerCase();
    if (!cleanGuardianEmail) {
      throw new BadRequestError('Guardian email is required');
    }

    const student = await StudentModel.findOne({
      $or: [{ userId: studentUserId }, { _id: studentUserId }],
      deletedAt: { $exists: false },
    });
    if (!student) throw new NotFoundError('Student');

    // Prevent student from entering their own student login email
    const studentUser = await UserModel.findById(student.userId);
    if (studentUser && studentUser.email.toLowerCase() === cleanGuardianEmail) {
      throw new BadRequestError(
        "Guardian email cannot be the same as your student login email. Please provide your parent or guardian's email address."
      );
    }

    const invitation = await SquadInvitationModel.findById(invitationId);
    if (!invitation || invitation.studentId.toString() !== student._id.toString()) {
      throw new NotFoundError('Invitation');
    }
    if (invitation.status !== 'pending') {
      throw new BadRequestError(`This invitation has already been ${invitation.status}.`);
    }

    const academy = await AcademyModel.findById(invitation.academyId).select('name');
    const academyName = academy ? academy.name : 'the Academy';

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: cleanGuardianEmail });
    if (existingUser && existingUser.role !== 'guardian') {
      throw new BadRequestError(
        `The email "${cleanGuardianEmail}" is already registered on Noxphere under a different role (${existingUser.role}). Please provide a guardian email.`
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await RegistrationOtpModel.deleteMany({ email: cleanGuardianEmail });
    await RegistrationOtpModel.create({
      email: cleanGuardianEmail,
      studentId: student._id,
      otp,
      expiresAt,
      verified: false,
    });

    console.log(`[SquadInvitation OTP] Generated guardian OTP for ${cleanGuardianEmail}: ${otp}`);

    await notificationService.sendGuardianVerificationOtpEmail({
      to: cleanGuardianEmail,
      recipientName: existingUser ? `${existingUser.firstName} ${existingUser.lastName}` : undefined,
      otp,
      studentName: `${student.firstName} ${student.lastName}`,
      academyName,
    });

    return {
      success: true,
      isExistingGuardian: !!existingUser,
      message: `Verification code sent to ${cleanGuardianEmail}`,
    };
  }

  /**
   * Get all invitations received by the logged-in student.
   */
  async getMyInvitations(studentUserId: string): Promise<any[]> {
    const student = await StudentModel.findOne({
      $or: [{ userId: studentUserId }, { _id: studentUserId }],
      deletedAt: { $exists: false },
    });
    if (!student) throw new NotFoundError('Student profile not found');

    const invitations = await SquadInvitationModel.find({
      studentId: student._id,
    })
      .populate('academyId', 'name academyCode logo')
      .populate('franchiseId', 'name location')
      .populate('teamId', 'name ageGroup')
      .populate('invitedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    return invitations.map((inv) => ({
      ...inv,
      id: inv._id.toString(),
    }));
  }

  /**
   * Respond to an invitation: accept or reject.
   * If accepted:
   * 1. Validate guardian details and verify OTP sent to guardian's email
   * 2. Check capacity quota again
   * 3. Link existing guardian OR create new guardian user account
   * 4. Enroll student into franchise & team
   * 5. Cancel all other pending invitations for this student
   * 6. Notify the academy manager and guardian
   */
  async respondToInvitation(
    studentUserId: string,
    invitationId: string,
    dto: RespondSquadInvitationDto
  ) {
    if (!invitationId || invitationId === 'undefined' || !mongoose.Types.ObjectId.isValid(invitationId)) {
      throw new BadRequestError('Invalid or missing squad invitation ID');
    }

    const { action, rejectionReason } = dto;
    const student = await StudentModel.findOne({
      $or: [{ userId: studentUserId }, { _id: studentUserId }],
      deletedAt: { $exists: false },
    });
    if (!student) throw new NotFoundError('Student');

    const invitation = await SquadInvitationModel.findById(invitationId);
    if (!invitation || invitation.studentId.toString() !== student._id.toString()) {
      throw new NotFoundError('Invitation');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestError(`This invitation has already been ${invitation.status}.`);
    }

    if (action === 'reject') {
      invitation.status = 'rejected';
      invitation.rejectionReason = rejectionReason;
      invitation.respondedAt = new Date();
      await invitation.save();

      // Notify the manager who invited
      await UserNotificationModel.create({
        userId: invitation.invitedBy,
        type: 'squad_invitation_rejected',
        title: 'Squad Invitation Declined',
        body: `${student.firstName} ${student.lastName} has declined your squad invitation.${
          rejectionReason ? ` Reason: "${rejectionReason}"` : ''
        }`,
        data: {
          invitationId: invitation.id,
          studentId: student._id.toString(),
        },
      });

      return { success: true, status: 'rejected' };
    }

    // ACTION: ACCEPT
    if (student.franchiseId) {
      throw new BadRequestError(
        'You are already enrolled with an academy. Please contact your current academy to request a transfer.'
      );
    }

    // Require guardian details and OTP
    if (!dto.guardianEmail || !dto.otp) {
      throw new BadRequestError('Guardian email and verification code (OTP) are required to complete enrollment.');
    }

    const cleanGuardianEmail = dto.guardianEmail.trim().toLowerCase();
    const studentUser = await UserModel.findById(student.userId);
    if (studentUser && studentUser.email.toLowerCase() === cleanGuardianEmail) {
      throw new BadRequestError(
        "Guardian email cannot be the same as your student login email. Please provide your parent or guardian's email address."
      );
    }

    // Verify OTP
    const otpRecord = await RegistrationOtpModel.findOne({
      email: cleanGuardianEmail,
      otp: dto.otp.trim(),
    });

    if (!otpRecord) {
      throw new BadRequestError('Invalid verification code for this guardian email.');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestError('Verification code has expired. Please request a new one.');
    }

    // Consume OTP
    await RegistrationOtpModel.deleteMany({ email: cleanGuardianEmail });

    // Verify subscription capacity of the academy
    await this.academySubscriptionUseCases.assertCanAddStudent(
      invitation.academyId.toString()
    );

    const academy = await AcademyModel.findById(invitation.academyId).select('name');
    const academyName = academy ? academy.name : 'the Academy';

    // Check if guardian user exists
    const existingGuardian = await UserModel.findOne({ email: cleanGuardianEmail });
    let guardianUserToLink: any = null;

    if (existingGuardian) {
      if (existingGuardian.role !== 'guardian') {
        throw new BadRequestError(
          `The email "${cleanGuardianEmail}" is registered under a different role (${existingGuardian.role}). Please provide a guardian email.`
        );
      }
      guardianUserToLink = existingGuardian;

      // Update guardian's franchise/academy context if not set
      if (!existingGuardian.franchiseId || !existingGuardian.academyId) {
        await UserModel.findByIdAndUpdate(existingGuardian._id, {
          franchiseId: invitation.franchiseId,
          academyId: invitation.academyId,
        });
      }

      // Update student guardian details
      student.guardian = {
        name: `${existingGuardian.firstName} ${existingGuardian.lastName}`.trim() || student.guardian?.name || 'Guardian',
        phone: existingGuardian.phone || dto.guardianPhone?.trim() || student.guardian?.phone || '',
        email: existingGuardian.email,
      };

      // Notify existing guardian that their child was enrolled
      await notificationService.sendStudentLinkedEmail({
        to: existingGuardian.email,
        guardianName: `${existingGuardian.firstName} ${existingGuardian.lastName}`.trim() || 'Guardian',
        studentName: `${student.firstName} ${student.lastName}`,
        academyName,
        loginUrl: `${config.clientUrl}/login`,
      });
    } else {
      // Create new Guardian Account
      if (!dto.guardianPassword || dto.guardianPassword.length < 6) {
        throw new BadRequestError('A password of at least 6 characters is required for the new guardian portal account.');
      }

      const guardianName = (dto.guardianName || '').trim() || `${student.lastName} Guardian`;
      const nameParts = guardianName.split(' ');
      const gFirstName = nameParts[0] || 'Guardian';
      const gLastName = nameParts.slice(1).join(' ') || '-';
      const gPhone = dto.guardianPhone ? dto.guardianPhone.trim() : '';

      const passwordHash = await bcrypt.hash(dto.guardianPassword, 12);
      const newGuardian = await UserModel.create({
        email: cleanGuardianEmail,
        passwordHash,
        role: 'guardian',
        firstName: gFirstName,
        lastName: gLastName,
        phone: gPhone,
        isActive: true,
        isEmailVerified: true,
        permissions: defaultPermissions['guardian' as UserRole],
        fcmTokens: [],
        franchiseId: invitation.franchiseId,
        academyId: invitation.academyId,
      });
      guardianUserToLink = newGuardian;

      student.guardian = {
        name: guardianName,
        phone: gPhone,
        email: cleanGuardianEmail,
      };

      // Send credentials email to the new guardian
      await notificationService.sendAccountCredentialsEmail({
        to: cleanGuardianEmail,
        recipientName: guardianName,
        role: 'guardian',
        password: dto.guardianPassword,
        loginUrl: `${config.clientUrl}/login`,
        studentName: `${student.firstName} ${student.lastName}`,
        academyName,
      });
    }

    // Attach guardian to student's guardianIds (and ensure student's own user ID is filtered out)
    const existingGuardianIds = (student.guardianIds || [])
      .map((g: any) => g.toString())
      .filter((id: string) => id !== student.userId.toString());

    if (!existingGuardianIds.includes(guardianUserToLink._id.toString())) {
      existingGuardianIds.push(guardianUserToLink._id.toString());
    }
    student.guardianIds = existingGuardianIds.map((id: string) => new mongoose.Types.ObjectId(id));

    // Enroll player into franchise & squad
    student.franchiseId = invitation.franchiseId;
    if (invitation.teamId) student.teamId = invitation.teamId;
    if (invitation.jerseyNumber) student.jerseyNumber = invitation.jerseyNumber;
    if (invitation.position) student.position = invitation.position;
    student.enrollmentDate = new Date();
    student.isActive = true;
    student.status = 'active';
    await student.save();

    // Update student User doc with new organization affiliation
    await UserModel.findByIdAndUpdate(student.userId, {
      franchiseId: invitation.franchiseId,
      academyId: invitation.academyId,
    });

    // Mark invitation as accepted
    invitation.status = 'accepted';
    invitation.respondedAt = new Date();
    await invitation.save();

    // Auto-cancel all other pending invitations from other academies
    await SquadInvitationModel.updateMany(
      {
        studentId: student._id,
        _id: { $ne: invitation._id },
        status: 'pending',
      },
      {
        $set: {
          status: 'cancelled',
          rejectionReason: 'Player accepted an invitation from another academy.',
        },
      }
    );

    // Notify the academy manager who invited the student
    await UserNotificationModel.create({
      userId: invitation.invitedBy,
      type: 'squad_invitation_accepted',
      title: 'Squad Invitation Accepted! 🎉',
      body: `${student.firstName} ${student.lastName} accepted your invitation and has been officially added to the squad!`,
      data: {
        invitationId: invitation.id,
        studentId: student._id.toString(),
      },
    });

    return {
      success: true,
      status: 'accepted',
      guardianLinked: true,
      isNewGuardian: !existingGuardian,
    };
  }

  /**
   * Get all invitations sent by this academy (manager view).
   */
  async getAcademyInvitations(academyId: string, status?: string): Promise<any[]> {
    const filter: any = { academyId: new mongoose.Types.ObjectId(academyId) };
    if (status) filter.status = status;

    const invitations = await SquadInvitationModel.find(filter)
      .populate('studentId', 'firstName lastName photo position ageGroup overallRating')
      .populate('franchiseId', 'name location')
      .populate('teamId', 'name ageGroup')
      .populate('invitedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    return invitations.map((inv) => ({
      ...inv,
      id: inv._id.toString(),
    }));
  }

  /**
   * Cancel an outgoing pending invitation.
   */
  async cancelInvitation(academyId: string, invitationId: string) {
    if (!invitationId || invitationId === 'undefined' || !mongoose.Types.ObjectId.isValid(invitationId)) {
      throw new BadRequestError('Invalid or missing squad invitation ID');
    }

    const invitation = await SquadInvitationModel.findOne({
      _id: invitationId,
      academyId: new mongoose.Types.ObjectId(academyId),
      status: 'pending',
    });
    if (!invitation) throw new NotFoundError('Pending invitation not found');

    invitation.status = 'cancelled';
    await invitation.save();

    return { success: true, status: 'cancelled' };
  }
}
