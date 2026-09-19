// src/application/use-cases/auth/AuthUseCases.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { UserEntity, UserRole, defaultPermissions } from '../../../domain/entities/User.entity';
import { AppError, UnauthorizedError, ConflictError, NotFoundError, ForbiddenError, BadRequestError } from '../../../shared/errors/AppError';
import { RegisterDto, LoginDto, RefreshTokenDto, ResetForgotPasswordDto } from '../../dtos/auth.dto';
import { config } from '../../../config/app.config';
import { FranchiseModel } from '../../../infrastructure/database/models/Franchise.model';
import { StudentModel } from '../../../infrastructure/database/models/Student.model';
import { AcademyModel } from '../../../infrastructure/database/models/Academy.model';
import { UserModel } from '../../../infrastructure/database/models/User.model';
import { PasswordResetOtpModel } from '../../../infrastructure/database/models/PasswordResetOtp.model';
import { notificationService } from '../../../infrastructure/services/NotificationService';
import { normalizePhone, getPhoneMatchVariants } from '../../../shared/utils/phone';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  user: Omit<UserEntity, 'passwordHash'>;
  tokens: AuthTokens;
}

export class AuthUseCases {
  constructor(private readonly userRepository: IUserRepository) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      role: dto.role,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      permissions: defaultPermissions[dto.role as UserRole],
      isActive: true,
      isEmailVerified: false,
      fcmTokens: [],
      franchiseId: dto.franchiseId,
    });

    const tokens = this.generateTokens(user);
    return { user, tokens };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    console.log('Attempting login for email:', dto.email);
    const user = await this.userRepository.findByEmail(dto.email);
    console.log('User found during login:', user);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }
    
    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }
    
    // Need to explicitly select passwordHash since it's excluded by default
    const userWithPassword = await this.userRepository.findByEmailWithPassword(dto.email);
    if (!userWithPassword) throw new UnauthorizedError('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(dto.password, userWithPassword.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    
    if (dto.fcmToken) {
      await this.userRepository.addFcmToken(user.id, dto.fcmToken);
    }

    // Ensure academyId & franchiseId are populated for guardians and students
    if (!user.academyId && user.franchiseId) {
      try {
        const franchise = await FranchiseModel.findById(user.franchiseId).select('academyId').lean();
        if (franchise?.academyId) {
          user.academyId = franchise.academyId.toString();
          await this.userRepository.update(user.id, { academyId: user.academyId } as Partial<UserEntity>);
        }
      } catch {}
    } else if (!user.academyId && (user.role === 'guardian' || user.role === 'student')) {
      try {
        const student = await StudentModel.findOne({
          $or: [{ guardianIds: user.id }, { userId: user.id }],
          isActive: true,
        }).select('franchiseId').lean();
        if (student?.franchiseId) {
          const franchise = await FranchiseModel.findById(student.franchiseId).select('academyId').lean();
          if (franchise?.academyId) {
            user.academyId = franchise.academyId.toString();
            user.franchiseId = student.franchiseId.toString();
            await this.userRepository.update(user.id, {
              academyId: user.academyId,
              franchiseId: user.franchiseId,
            } as Partial<UserEntity>);
          }
        }
      } catch {}
    } else if (!user.academyId && user.role === 'manager') {
      try {
        const managedAcademy = await AcademyModel.findOne({ managerId: user.id }).select('_id').lean();
        if (managedAcademy) {
          user.academyId = managedAcademy._id.toString();
          await this.userRepository.update(user.id, { academyId: user.academyId } as Partial<UserEntity>);
        }
      } catch {}
    }
    
    const tokens = this.generateTokens(user);
    console.log('Tokens generated during login:', tokens);
    return { user, tokens };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<AuthTokens> {
    try {
      const payload = jwt.verify(dto.refreshToken, config.jwt.refreshSecret) as { sub: string };
      const user = await this.userRepository.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  async logout(userId: string, fcmToken?: string): Promise<void> {
    if (fcmToken) {
      await this.userRepository.removeFcmToken(userId, fcmToken);
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findByIdWithPassword(userId);
    if (!user) throw new NotFoundError('User');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedError('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepository.update(userId, { passwordHash } as Partial<UserEntity>);
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');

    let academyName: string | undefined;
    let franchiseName: string | undefined;
    let studentDetails: Record<string, any> | undefined;

    if (user.academyId) {
      const academy = await AcademyModel.findById(user.academyId).select('name').lean();
      if (academy) academyName = academy.name;
    } else if (user.role === 'manager') {
      const managedAcademy = await AcademyModel.findOne({ managerId: user.id }).select('name').lean();
      if (managedAcademy) {
        user.academyId = managedAcademy._id.toString();
        academyName = managedAcademy.name;
      }
    }
    if (user.franchiseId) {
      const franchise = await FranchiseModel.findById(user.franchiseId).select('name academyId').lean();
      if (franchise) {
        franchiseName = franchise.name;
        if (!academyName && franchise.academyId) {
          const academy = await AcademyModel.findById(franchise.academyId).select('name').lean();
          if (academy) academyName = academy.name;
        }
      }
    }

    if (user.role === 'student') {
      const student = await StudentModel.findOne({
        $or: [{ userId: user.id }, { _id: user.id }],
        deletedAt: { $exists: false },
      }).lean();

      if (student) {
        const isEnrolledInAcademy = !!student.franchiseId;
        if (student.franchiseId && !franchiseName) {
          const franchise = await FranchiseModel.findById(student.franchiseId).select('name academyId').lean();
          if (franchise) {
            franchiseName = franchise.name;
            if (!academyName && franchise.academyId) {
              const academy = await AcademyModel.findById(franchise.academyId).select('name').lean();
              if (academy) academyName = academy.name;
            }
          }
        }

        studentDetails = {
          studentId: student._id.toString(),
          isEnrolledInAcademy,
          jerseyNumber: student.jerseyNumber,
          position: student.position,
          positions: student.positions,
          ageGroup: student.ageGroup,
          dateOfBirth: student.dateOfBirth,
          photo: student.photo,
          guardian: student.guardian,
          emergencyContactName: student.medicalInfo?.emergencyContactName,
          emergencyContactPhone: student.medicalInfo?.emergencyContactPhone,
          publicProfileEnabled: student.publicProfileEnabled,
          publicProfileToken: student.publicProfileToken,
          attendancePercentage: student.attendancePercentage,
          overallRating: student.overallRating,
          franchiseId: student.franchiseId ? student.franchiseId.toString() : null,
        };
      }
    }

    const { passwordHash, ...safeUser } = user as any;
    return {
      ...safeUser,
      academyName,
      franchiseName,
      studentDetails,
    };
  }

  async updateProfile(
    userId: string,
    dto: { firstName?: string; lastName?: string; avatar?: string; photo?: string }
  ) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');

    if (user.role === 'student') {
      const student = await StudentModel.findOne({
        $or: [{ userId: user.id }, { _id: user.id }],
        deletedAt: { $exists: false },
      });

      if (student && student.franchiseId) {
        throw new ForbiddenError(
          'Profile editing is disabled for academy-enrolled students. Your academy administers all player records. Please contact your coach or manager to update any information.'
        );
      }

      if (student) {
        if (dto.firstName) student.firstName = dto.firstName.trim();
        if (dto.lastName) student.lastName = dto.lastName.trim();
        if (dto.photo !== undefined) student.photo = dto.photo;
        else if (dto.avatar) student.photo = dto.avatar;
        await student.save();
      }
    }

    const updates: Partial<UserEntity> = {};
    if (dto.firstName) updates.firstName = dto.firstName.trim();
    if (dto.lastName) updates.lastName = dto.lastName.trim();
    if (dto.avatar !== undefined) updates.avatar = dto.avatar;

    await this.userRepository.update(userId, updates);
    return this.getProfile(userId);
  }

  private generateTokens(user: UserEntity): AuthTokens {
    const payload = {
      sub: user.id,
      role: user.role,
      franchiseId: user.franchiseId,
      academyId: user.academyId,
      permissions: user.permissions,
    };

    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiresIn,
    });

    const refreshToken = jwt.sign({ sub: user.id }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  async checkAvailability(query: {
    email?: string;
    phone?: string;
    purpose?: 'student' | 'guardian';
  }): Promise<{ available: boolean; field?: 'email' | 'phone' | 'both'; message?: string }> {
    const rawEmail = (query.email || '').trim().toLowerCase();
    const rawPhone = (query.phone || '').trim();
    const cleanPhone = rawPhone ? normalizePhone(rawPhone) : '';
    const purpose = query.purpose || 'guardian';

    const [userByEmail, userByPhone] = await Promise.all([
      rawEmail ? UserModel.findOne({ email: rawEmail }) : null,
      cleanPhone
        ? UserModel.findOne({ phone: { $in: getPhoneMatchVariants(cleanPhone) } })
        : null,
    ]);

    if (purpose === 'student') {
      if (userByEmail && userByPhone && userByEmail._id.toString() !== userByPhone._id.toString()) {
        return {
          available: false,
          field: 'both',
          message: 'This email and phone number belong to two different registered accounts.',
        };
      }

      if (userByEmail) {
        if (userByEmail.role === 'student') {
          const hasStudentProfile = await StudentModel.findOne({ userId: userByEmail._id });
          if (hasStudentProfile) {
            return {
              available: false,
              field: 'email',
              message: 'An account with this email already exists. Please log in.',
            };
          }
        } else {
          return {
            available: false,
            field: 'email',
            message: `An account with this email already exists with role: ${userByEmail.role}. Please log in.`,
          };
        }
      }

      if (userByPhone) {
        if (userByPhone.role === 'student') {
          const hasStudentProfile = await StudentModel.findOne({ userId: userByPhone._id });
          if (hasStudentProfile) {
            return {
              available: false,
              field: 'phone',
              message: 'An account with this phone number already exists. Please log in.',
            };
          }
        } else {
          return {
            available: false,
            field: 'phone',
            message: `An account with this phone number already exists with role: ${userByPhone.role}. Please log in.`,
          };
        }
      }

      return { available: true };
    }

    // Default: guardian purpose
    if (userByEmail && userByPhone && userByEmail._id.toString() !== userByPhone._id.toString()) {
      return {
        available: false,
        field: 'both',
        message: 'This guardian email and phone number belong to two different registered accounts.',
      };
    }

    if (userByEmail && userByEmail.role !== 'guardian') {
      return {
        available: false,
        field: 'email',
        message: `An account with this email already exists with role: ${userByEmail.role}. Please use a different email.`,
      };
    }

    if (userByPhone && userByPhone.role !== 'guardian') {
      return {
        available: false,
        field: 'phone',
        message: `An account with this phone number already exists with role: ${userByPhone.role}. Please use a different phone number.`,
      };
    }

    if (userByPhone && !userByEmail && rawEmail && userByPhone.email.toLowerCase() !== rawEmail) {
      return {
        available: false,
        field: 'phone',
        message: 'An account with this phone number is already registered under a different email address.',
      };
    }

    return { available: true };
  }

  async sendForgotPasswordOtp(email: string): Promise<{ message: string }> {
    const cleanEmail = email.toLowerCase().trim();
    const user = await UserModel.findOne({ email: cleanEmail });
    if (!user) {
      throw new NotFoundError('No account found with this email address');
    }
    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Invalidate existing OTPs
    await PasswordResetOtpModel.deleteMany({ email: cleanEmail });

    // Store new OTP record with 10-minute expiry
    await PasswordResetOtpModel.create({
      email: cleanEmail,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified: false,
    });

    console.log(`[ForgotPassword] Generated password reset OTP for ${cleanEmail}: ${otp}`);

    await notificationService.sendPasswordResetOtpEmail({
      to: cleanEmail,
      recipientName: user.firstName,
      otp,
    });

    return { message: 'A 6-digit verification code has been sent to your email.' };
  }

  async verifyForgotPasswordOtp(email: string, otp: string): Promise<{ message: string }> {
    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.trim();

    const record = await PasswordResetOtpModel.findOne({ email: cleanEmail, otp: cleanOtp });
    if (!record) {
      throw new BadRequestError('Invalid or expired verification code.');
    }

    if (new Date() > record.expiresAt) {
      await PasswordResetOtpModel.deleteMany({ email: cleanEmail });
      throw new BadRequestError('Verification code has expired. Please request a new one.');
    }

    record.verified = true;
    await record.save();

    return { message: 'Code verified successfully.' };
  }

  async resetForgotPassword(dto: ResetForgotPasswordDto): Promise<{ message: string }> {
    const cleanEmail = dto.email.toLowerCase().trim();
    const cleanOtp = dto.otp.trim();

    const record = await PasswordResetOtpModel.findOne({ email: cleanEmail, otp: cleanOtp });
    if (!record) {
      throw new BadRequestError('Invalid or expired verification code.');
    }

    if (new Date() > record.expiresAt) {
      await PasswordResetOtpModel.deleteMany({ email: cleanEmail });
      throw new BadRequestError('Verification code has expired. Please request a new one.');
    }

    const user = await UserModel.findOne({ email: cleanEmail });
    if (!user) {
      throw new NotFoundError('User account not found.');
    }

    // Hash new password using bcrypt
    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);
    user.passwordHash = newPasswordHash;
    await user.save();

    // Invalidate OTPs for this email
    await PasswordResetOtpModel.deleteMany({ email: cleanEmail });

    console.log(`[ForgotPassword] Password reset successfully for ${cleanEmail}`);

    return { message: 'Password has been reset successfully. You can now sign in with your new password.' };
  }
}
