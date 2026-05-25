// src/application/use-cases/academy/AcademyUseCases.ts
import { IAcademyRepository } from "../../../domain/repositories/IAcademyRepository";
import { IUserRepository } from "../../../domain/repositories/IUserRepository";
import {
  AcademyEntity,
  Location,
} from "../../../domain/entities/Academy.entity";
import { UserEntity, UserRole } from "../../../domain/entities/User.entity";
import {
  CreateAcademyDto,
  UpdateAcademyDto,
  AcademyConfigDto,
} from "../../dtos/academy.dto";
import {
  AppError,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "../../../shared/errors/AppError";
import bcrypt from "bcryptjs";

export class AcademyUseCases {
  constructor(
    private readonly academyRepository: IAcademyRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async createAcademy(dto: CreateAcademyDto): Promise<AcademyEntity> {
    // 1. Check code uniqueness
    if (dto.academyCode) {
      const existing = await this.academyRepository.findByCode(dto.academyCode);
      if (existing) throw new ConflictError("Academy code already exists");
    }

    // 2. Check manager email uniqueness
    const existingUser = await this.userRepository.findByEmail(
      dto.manager.email,
    );
    if (existingUser)
      throw new ConflictError("Manager email already registered");

    // 3. Generate academy code if not provided
    let academyCode = dto.academyCode;
    if (!academyCode) {
      academyCode = await this.generateUniqueCode(dto.name);
    }

    // 4. Create academy (without managerId)
    const academy = await this.academyRepository.create({
      name: dto.name,
      academyCode,
      location: dto.location,
      ageGroups: dto.ageGroups,
      maxStudents: dto.maxStudents,
      isActive: true,
      alertBeforeMinutes: dto.alertBeforeMinutes,
      notificationAlertAfterMinutes: dto.notificationAlertAfterMinutes,
      skillParameters: dto.skillParameters,
    });

    // 5. Create manager user with academyId
    const passwordHash = await bcrypt.hash(dto.manager.password, 12);
    try {
      await this.userRepository.create({
        email: dto.manager.email.toLowerCase(),
        passwordHash,
        role: "manager",
        firstName: dto.manager.firstName,
        lastName: dto.manager.lastName,
        phone: undefined,
        isActive: true,
        isEmailVerified: false,
        permissions: {
          canManageUsers: true,
          canManageCamps: false,
          canManageFinance: true,
          canViewReports: true,
          canManageAttendance: true,
          canManagePerformance: true,
          canManageSelection: true,
          canSendNotifications: true,
        },
        fcmTokens: [],
        academyId: academy.id, // link to academy
      });
    } catch (error) {
      // Rollback: delete academy if manager creation fails
      await this.academyRepository.softDelete(academy.id);
      throw new BadRequestError(
        "Failed to create manager user, academy rolled back",
      );
    }

    return academy;
  }

  async getAcademyById(id: string): Promise<AcademyEntity> {
    const academy = await this.academyRepository.findById(id);
    if (!academy) throw new NotFoundError("Academy");
    return academy;
  }

  async getAllAcademies(
    filters: { isActive?: boolean; search?: string },
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: AcademyEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.academyRepository.findAll(filters, { page, limit });
  }

  async updateAcademy(
    id: string,
    dto: UpdateAcademyDto,
  ): Promise<AcademyEntity> {
    const academy = await this.academyRepository.findById(id);
    if (!academy) throw new NotFoundError("Academy");

    // If location updates are partial, merge with existing

    let locationUpdate: Location | undefined;
    if (dto.location) {
      locationUpdate = {
        ...academy.location,
        ...dto.location,
      };
    }

    const updated = await this.academyRepository.update(id, {
      ...dto,
      location: locationUpdate,
    });
    if (!updated) throw new NotFoundError("Academy");
    return updated;
  }

  async updateAcademyConfig(
    id: string,
    dto: AcademyConfigDto,
  ): Promise<AcademyEntity> {
    const academy = await this.academyRepository.findById(id);
    if (!academy) throw new NotFoundError("Academy");

    const updated = await this.academyRepository.update(id, dto);
    if (!updated) throw new NotFoundError("Academy");
    return updated;
  }

  async toggleAcademyStatus(id: string): Promise<AcademyEntity> {
    const academy = await this.academyRepository.findById(id);
    if (!academy) throw new NotFoundError("Academy");

    const updated = await this.academyRepository.update(id, {
      isActive: !academy.isActive,
    });
    if (!updated) throw new NotFoundError("Academy");
    return updated;
  }

  async deleteAcademy(id: string): Promise<void> {
    const academy = await this.academyRepository.findById(id);
    if (!academy) throw new NotFoundError("Academy");

    const deleted = await this.academyRepository.softDelete(id);
    if (!deleted) throw new BadRequestError("Could not delete academy");
  }

  private async generateUniqueCode(baseName: string): Promise<string> {
    const prefix = baseName
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);
    let code = `${prefix}${random}`;
    let exists = await this.academyRepository.findByCode(code);
    let counter = 1;
    while (exists) {
      code = `${prefix}${random}${counter}`;
      exists = await this.academyRepository.findByCode(code);
      counter++;
    }
    return code;
  }
}
