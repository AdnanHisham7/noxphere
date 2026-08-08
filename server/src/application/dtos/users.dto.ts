// src/application/dtos/users.dto.ts
import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["super_admin", "manager", "coach", "student", "guardian"]),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().trim().min(7, "A valid phone number is required").max(20),
  franchiseId: z.string().optional(),
  // Only meaningful for role "coach", and only required from the client
  // when a super_admin is creating the account — a manager's own academy
  // is resolved automatically server-side. See UsersUseCases.createUser.
  academyId: z.string().optional(),
});

export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(["super_admin", "manager", "coach", "student", "guardian"]).optional(),
  franchiseId: z.string().optional(),
  academyId: z.string().optional(),
  permissions: z
    .object({
      canManageUsers: z.boolean().optional(),
      canManageFranchises: z.boolean().optional(),
      canManageSessions: z.boolean().optional(),
      canManageFinance: z.boolean().optional(),
      canViewReports: z.boolean().optional(),
      canManageAttendance: z.boolean().optional(),
      canManagePerformance: z.boolean().optional(),
      canManageSelection: z.boolean().optional(),
      canSendNotifications: z.boolean().optional(),
    })
    .partial()
    .optional(),
  weeklyAvailability: z
    .array(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
      })
    )
    .optional(),
  customUnavailableDates: z.array(z.string()).optional(),
});

export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;