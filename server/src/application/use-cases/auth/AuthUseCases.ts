// src/application/use-cases/auth/AuthUseCases.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { UserEntity, UserRole, defaultPermissions } from '../../../domain/entities/User.entity';
import { AppError, UnauthorizedError, ConflictError, NotFoundError, ForbiddenError } from '../../../shared/errors/AppError';
import { RegisterDto, LoginDto, RefreshTokenDto } from '../../dtos/auth.dto';
import { config } from '../../../config/app.config';
import { FranchiseModel } from '../../../infrastructure/database/models/Franchise.model';
import { StudentModel } from '../../../infrastructure/database/models/Student.model';
import { AcademyModel } from '../../../infrastructure/database/models/Academy.model';

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
    dto: { firstName?: string; lastName?: string; avatar?: string }
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
        if (dto.avatar) student.photo = dto.avatar;
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
}
