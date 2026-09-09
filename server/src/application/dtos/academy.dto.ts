import { z } from 'zod';

// Manager creation sub‑schema
export const ManagerAccountSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().trim().min(7, "A valid phone number is required").max(20),
  password: z.string().min(8).max(100),
});

// Location sub‑schema
export const LocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  fieldNumber: z.string().optional(),
});

// Create Academy DTO (includes manager creation data)
export const CreateAcademySchema = z.object({
  name: z.string().min(1).max(100),
  academyCode: z.string().min(1).max(20).optional(), // will generate if omitted
  location: LocationSchema,
  ageGroups: z.array(z.string()).default([]),
  alertBeforeMinutes: z.number().min(0).default(60),
  notificationAlertAfterMinutes: z.number().min(0).default(15),
  absentAlertDays: z.number().int().min(1).max(30).default(5),
  dueDateAlertDays: z.number().int().min(0).max(30).default(3),
  skillParameters: z
    .array(z.string().trim().min(1, "Skill parameter name cannot be empty"))
    .length(6, "Exactly 6 skill parameters are required")
    .refine(
      (items) => new Set(items.map((s) => s.toLowerCase())).size === 6,
      "Skill parameter names must be unique"
    )
    .default([
      'Dribbling',
      'Passing',
      'Shooting',
      'Speed',
      'Tactical Awareness',
      'Attitude',
    ]),
  manager: ManagerAccountSchema,
});

// Update Academy DTO (partial, without manager)
export const UpdateAcademySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: LocationSchema.partial().optional(),
  ageGroups: z.array(z.string()).optional(),
  maxStudents: z.number().min(1).optional(),
  isActive: z.boolean().optional(),
  alertBeforeMinutes: z.number().min(0).optional(),
  notificationAlertAfterMinutes: z.number().min(0).optional(),
  absentAlertDays: z.number().int().min(1).max(30).optional(),
  dueDateAlertDays: z.number().int().min(0).max(30).optional(),
});

// Config update — this is the endpoint the manager's own Settings tab
// uses (PATCH /:id/config). super_admin can update every field here;
// a manager is restricted, field-by-field, inside
// AcademyUseCases.updateAcademyConfig to only what the settings tab
// actually exposes: their academy's name, location, age categories, the
// two guardian-alert day thresholds, and feeQrImageUrl. isActive,
// maxStudents, and the session-reminder minute fields stay
// super_admin-only. Skill parameters are configured at creation and immutable.
export const AcademyConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: LocationSchema.partial().optional(),
  maxStudents: z.number().min(1).optional(),
  subscriptionRateOverride: z.number().min(0).optional(),
  staffRateOverride: z.number().min(0).optional(),
  dataProtectionContactEmail: z.string().email().optional(),
  ageGroups: z.array(z.string()).optional(),
  alertBeforeMinutes: z.number().min(0).optional(),
  notificationAlertAfterMinutes: z.number().min(0).optional(),
  absentAlertDays: z.number().int().min(1).max(30).optional(),
  dueDateAlertDays: z.number().int().min(0).max(30).optional(),
  feeQrImageUrl: z.string().url().nullable().optional().or(z.literal("")).transform(v => (v === "" || v === null) ? null : v),
  isActive: z.boolean().optional(),
});

export type CreateAcademyDto = z.infer<typeof CreateAcademySchema>;
export type UpdateAcademyDto = z.infer<typeof UpdateAcademySchema>;
export type AcademyConfigDto = z.infer<typeof AcademyConfigSchema>;