// src/application/use-cases/users/UsersUseCases.ts
import bcrypt from "bcryptjs";
import { IUserRepository } from "../../../domain/repositories/IUserRepository";
import { UserEntity, UserRole, UserPermissions, defaultPermissions } from "../../../domain/entities/User.entity";
import { NotFoundError, ConflictError, BadRequestError } from "../../../shared/errors/AppError";
import { CreateUserDto, UpdateUserDto, ResetPasswordDto } from "../../dtos/users.dto";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";

export interface RequestingUser {
  sub: string;
  role: UserRole;
  franchiseId?: string;
}

function sanitize(user: UserEntity) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export class UsersUseCases {
  constructor(private readonly userRepo: IUserRepository) {}

  async listUsers(filters: {
    roles?: string;
    franchiseId?: string;
    academyId?: string;
    isActive?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const roles = filters.roles
      ? (filters.roles.split(",").filter(Boolean) as UserRole[])
      : undefined;

    // Academy-scoped listing (used to find coaches across every franchise
    // of an academy) also needs to catch any legacy coach that only ever
    // had a franchiseId set — resolve that academy's franchise ids so the
    // repository can match either shape.
    let franchiseIds: string[] | undefined;
    if (filters.academyId) {
      const franchises = await FranchiseModel.find({ academyId: filters.academyId }).select("_id").lean();
      franchiseIds = franchises.map((f) => f._id.toString());
    }

    const result = await this.userRepo.searchUsers(
      {
        roles,
        franchiseId: filters.franchiseId,
        academyId: filters.academyId,
        franchiseIds,
        isActive: filters.isActive === "true" ? true : filters.isActive === "false" ? false : undefined,
        search: filters.search,
      },
      { page: filters.page ?? 1, limit: filters.limit ?? 20 },
    );
    return { ...result, data: result.data.map(sanitize) };
  }

  async getUserById(id: string) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError("User");
    return sanitize(user);
  }

  async createUser(dto: CreateUserDto, requester?: RequestingUser) {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) throw new ConflictError("A user with this email already exists");

    // A coach belongs to an academy, not to a single franchise within it —
    // this is what lets them operate across every franchise of that
    // academy without ever being bound to one branch. A manager's own
    // academy is resolved automatically from their franchise; a
    // super_admin (who isn't tied to any single academy) must supply
    // academyId explicitly.
    let academyId: string | undefined;
    let franchiseId: string | undefined = dto.franchiseId;
    if (dto.role === "coach") {
      academyId = dto.academyId;
      if (!academyId && requester?.role === "manager") {
        if (!requester.franchiseId) {
          throw new BadRequestError("Your account isn't linked to a franchise, so a coach's academy can't be resolved");
        }
        const franchise = await FranchiseModel.findById(requester.franchiseId).select("academyId").lean();
        if (!franchise) throw new NotFoundError("Franchise");
        academyId = franchise.academyId.toString();
      }
      if (!academyId) {
        throw new BadRequestError("academyId is required to create a coach");
      }
      // Coaches are never scoped by franchiseId going forward — any value
      // sent for a coach is ignored so a stale/incorrect binding can never
      // be created.
      franchiseId = undefined;
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userRepo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      role: dto.role,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      isActive: true,
      isEmailVerified: false,
      permissions: defaultPermissions[dto.role],
      fcmTokens: [],
      franchiseId,
      academyId,
    });
    return sanitize(user);
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const { permissions: _permissionsPatch, ...rest } = dto;
    const updates: Partial<UserEntity> = { ...rest };
    if (dto.role) {
      updates.permissions = {
        ...defaultPermissions[dto.role],
        ...(dto.permissions ?? {}),
      } as UserPermissions;
    } else if (dto.permissions) {
      const existing = await this.userRepo.findById(id);
      if (!existing) throw new NotFoundError("User");
      updates.permissions = { ...existing.permissions, ...dto.permissions } as UserPermissions;
    }
    const user = await this.userRepo.update(id, updates);
    if (!user) throw new NotFoundError("User");
    return sanitize(user);
  }

  async toggleActive(id: string) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError("User");
    const updated = await this.userRepo.update(id, { isActive: !user.isActive });
    if (!updated) throw new NotFoundError("User");
    return sanitize(updated);
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError("User");
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const updated = await this.userRepo.update(id, { passwordHash } as Partial<UserEntity>);
    if (!updated) throw new NotFoundError("User");
    return sanitize(updated);
  }

  async deleteUser(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new BadRequestError("You cannot delete your own account");
    }
    const success = await this.userRepo.softDelete(id);
    if (!success) throw new NotFoundError("User");
  }
}
