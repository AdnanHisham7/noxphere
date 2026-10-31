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

// Pitch / Venue sub‑schema
export const PitchSchemaDto = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  fieldNumber: z.string().optional(),
  surfaceType: z.string().optional(),
  address: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isActive: z.boolean().optional(),
});

export const SessionTypeDto = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  submetrics: z.array(z.string().min(1)).min(1),
});

// Create Academy DTO (includes manager creation data)
export const CreateAcademySchema = z.object({
  name: z.string().min(1).max(100),
  academyCode: z.string().min(1).max(20).optional(), // will generate if omitted
  location: LocationSchema,
  pitches: z.array(PitchSchemaDto).optional(),
  ageGroups: z.array(z.string()).default([]),
  alertBeforeMinutes: z.number().min(0).default(60),
  notificationAlertAfterMinutes: z.number().min(0).default(15),
  absentAlertDays: z.number().int().min(1).max(30).default(5),
  dueDateAlertDays: z.number().int().min(0).max(30).default(3),
  logo: z.string().optional(),
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
  currency: z.string().trim().toUpperCase().default('INR'),
  country: z.string().trim().toUpperCase().default('IN'),
  isTrial: z.boolean().default(false),
  trialDays: z.number().int().min(1).max(365).default(14),
  trialCapacity: z.number().int().min(1).default(50),
  trialStaffCapacity: z.number().int().min(0).default(5),
  subscriptionPlan: z
    .object({
      mode: z.enum(["trial", "paid_manual", "none"]).default("trial"),
      studentCapacity: z.number().int().min(1).default(50),
      staffCapacity: z.number().int().min(0).default(5),
      billingInterval: z.enum(["month", "quarter", "half_year", "year"]).default("month"),
      durationDays: z.number().int().min(1).max(3650).optional(),
      paymentMethod: z.enum(["cash", "bank_transfer", "cheque", "other", "waived"]).default("bank_transfer"),
      amountPaid: z.number().min(0).optional(),
      referenceNote: z.string().optional(),
    })
    .optional(),
  sessionTypes: z.array(SessionTypeDto).max(6, "An academy can have a maximum of 6 session types").optional(),
  manager: ManagerAccountSchema,
});

export const BankDetailsSchema = z.object({
  beneficiaryName: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  ifscCode: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  branchName: z.string().trim().optional(),
  upiId: z.string().trim().optional(),
  swiftCode: z.string().trim().optional(),
});

// Update Academy DTO (partial, without manager)
export const UpdateAcademySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: LocationSchema.partial().optional(),
  pitches: z.array(PitchSchemaDto).optional(),
  ageGroups: z.array(z.string()).optional(),
  maxStudents: z.number().min(1).optional(),
  isActive: z.boolean().optional(),
  currency: z.string().trim().toUpperCase().optional(),
  country: z.string().trim().toUpperCase().optional(),
  isTrial: z.boolean().optional(),
  trialDays: z.number().int().min(1).max(365).optional(),
  trialCapacity: z.number().int().min(1).optional(),
  trialStaffCapacity: z.number().int().min(0).optional(),
  alertBeforeMinutes: z.number().min(0).optional(),
  notificationAlertAfterMinutes: z.number().min(0).optional(),
  absentAlertDays: z.number().int().min(1).max(30).optional(),
  dueDateAlertDays: z.number().int().min(0).max(30).optional(),
  feeQrImageUrl: z.string().url().nullable().optional().or(z.literal("")).transform(v => (v === "" || v === null) ? null : v),
  feePaymentMethod: z.enum(["qr", "bank_transfer", "both"]).optional(),
  bankDetails: BankDetailsSchema.optional().nullable(),
  logo: z.string().optional(),
  sessionTypes: z.array(SessionTypeDto).max(6, "An academy can have a maximum of 6 session types").optional(),
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
  pitches: z.array(PitchSchemaDto).optional(),
  maxStudents: z.number().min(1).optional(),
  subscriptionRateOverride: z.number().min(0).optional(),
  staffRateOverride: z.number().min(0).optional(),
  currency: z.string().trim().toUpperCase().optional(),
  country: z.string().trim().toUpperCase().optional(),
  isTrial: z.boolean().optional(),
  trialDays: z.number().int().min(1).max(365).optional(),
  trialCapacity: z.number().int().min(1).optional(),
  trialStaffCapacity: z.number().int().min(0).optional(),
  dataProtectionContactEmail: z.string().email().optional(),
  ageGroups: z.array(z.string()).optional(),
  alertBeforeMinutes: z.number().min(0).optional(),
  notificationAlertAfterMinutes: z.number().min(0).optional(),
  absentAlertDays: z.number().int().min(1).max(30).optional(),
  dueDateAlertDays: z.number().int().min(0).max(30).optional(),
  feeQrImageUrl: z.string().url().nullable().optional().or(z.literal("")).transform(v => (v === "" || v === null) ? null : v),
  feePaymentMethod: z.enum(["qr", "bank_transfer", "both"]).optional(),
  bankDetails: BankDetailsSchema.optional().nullable(),
  logo: z.string().nullable().optional().or(z.literal("")).transform(v => (v === "" || v === null) ? null : v),
  sessionTypes: z.array(SessionTypeDto).max(6, "An academy can have a maximum of 6 session types").optional(),
  isActive: z.boolean().optional(),
});

export const UpdateTrialSchema = z.object({
  isTrial: z.boolean().optional(),
  trialDays: z.number().int().min(1).max(365).optional(),
  extendDays: z.number().int().min(1).max(365).optional(),
  trialCapacity: z.number().int().min(1).optional(),
  trialStaffCapacity: z.number().int().min(0).optional(),
  endTrial: z.boolean().optional(),
});

export type CreateAcademyDto = z.infer<typeof CreateAcademySchema>;
export type UpdateAcademyDto = z.infer<typeof UpdateAcademySchema>;
export type AcademyConfigDto = z.infer<typeof AcademyConfigSchema>;
export type UpdateTrialDto = z.infer<typeof UpdateTrialSchema>;