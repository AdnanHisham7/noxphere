// src/domain/repositories/IUserRepository.ts
import { UserEntity, UserRole } from "../entities/User.entity";

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByEmailWithPassword(email: string): Promise<UserEntity | null>;
  findByIdWithPassword(id: string): Promise<UserEntity | null>;
  findByRole(
    role: UserRole,
    campId?: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<UserEntity>>;
  create(
    user: Omit<UserEntity, "id" | "createdAt" | "updatedAt">,
  ): Promise<UserEntity>;
  update(id: string, updates: Partial<UserEntity>): Promise<UserEntity | null>;
  softDelete(id: string): Promise<boolean>;
  addFcmToken(userId: string, token: string): Promise<void>;
  removeFcmToken(userId: string, token: string): Promise<void>;
  bulkCreate(
    users: Omit<UserEntity, "id" | "createdAt" | "updatedAt">[],
  ): Promise<UserEntity[]>;
}
