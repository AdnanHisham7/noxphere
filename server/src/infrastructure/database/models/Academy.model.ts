import mongoose, { Schema, Document } from "mongoose";
import {
  AcademyEntity,
  AcademyPitch,
  Location,
} from "../../../domain/entities/Academy.entity";

export interface AcademyDocument extends Document {
  name: string;
  academyCode: string;
  managerId: mongoose.Types.ObjectId;
  location: Location;
  pitches?: AcademyPitch[];
  ageGroups: string[];
  maxStudents: number;
  subscriptionRateOverride?: number;
  isActive: boolean;
  transferWallEnabled: boolean;
  alertBeforeMinutes: number;
  notificationAlertAfterMinutes: number;
  staffRateOverride?: number;
  dataProtectionContactEmail?: string;
  // Guardian alert thresholds — how many consecutive absent days before
  // an automated alert fires, and how many days before an installment's
  // due date the reminder goes out. Editable per-academy from the
  // manager's settings tab.
  absentAlertDays: number;
  dueDateAlertDays: number;
  // The payment QR code image sent as part of the installment-due-soon
  // WhatsApp alert (see NotificationService.sendFeeDueAlert). Uploaded by
  // the manager from the Fees page.
  feeQrImageUrl?: string;
  feePaymentMethod?: "qr" | "bank_transfer" | "both";
  bankDetails?: {
    beneficiaryName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    branchName?: string;
    upiId?: string;
    swiftCode?: string;
  };
  logo?: string;
  skillParameters: string[];
  currency: string;
  country: string;
  isTrial: boolean;
  trialDays?: number;
  trialStartsAt?: Date;
  trialEndsAt?: Date;
  trialCapacity?: number;
  trialStaffCapacity?: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<Location>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    fieldNumber: { type: String },
  },
  { _id: false },
);

const PitchSchema = new Schema<AcademyPitch>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    fieldNumber: { type: String, trim: true },
    surfaceType: { type: String, trim: true, default: "Artificial Turf" },
    address: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const AcademySchema = new Schema<AcademyDocument>(
  {
    name: { type: String, required: true, trim: true },
    academyCode: { type: String, unique: true, index: true },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    location: { type: LocationSchema, required: true },
    pitches: { type: [PitchSchema], default: [] },
    ageGroups: [{ type: String }],
    maxStudents: { type: Number, default: 100 },
    // Per-academy override of PlatformSettings.defaultRatePerStudentPerDay
    // for this academy's subscription — e.g. a negotiated rate. Set only
    // by super_admin; unset means "use the platform default".
    subscriptionRateOverride: { type: Number, min: 0 },
    staffRateOverride: { type: Number, min: 0 },
    dataProtectionContactEmail: { type: String, trim: true, lowercase: true },
    isActive: { type: Boolean, default: true, index: true },
    transferWallEnabled: { type: Boolean, default: true },
    alertBeforeMinutes: { type: Number, default: 60 },
    notificationAlertAfterMinutes: { type: Number, default: 15 },
    absentAlertDays: { type: Number, default: 5, min: 1 },
    dueDateAlertDays: { type: Number, default: 3, min: 0 },
    feeQrImageUrl: { type: String },
    feePaymentMethod: {
      type: String,
      enum: ["qr", "bank_transfer", "both"],
      default: "qr",
    },
    bankDetails: {
      beneficiaryName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      bankName: { type: String, trim: true },
      branchName: { type: String, trim: true },
      upiId: { type: String, trim: true },
      swiftCode: { type: String, trim: true },
    },
    logo: { type: String, trim: true },
    skillParameters: {
      type: [String],
      validate: {
        validator: function (v: string[]) {
          return !v || (Array.isArray(v) && v.length === 6);
        },
        message: "Academy must have exactly 6 skill parameters",
      },
      default: [
        "Dribbling",
        "Passing",
        "Shooting",
        "Speed",
        "Tactical Awareness",
        "Attitude",
      ],
    },
    currency: { type: String, default: "INR", uppercase: true, trim: true },
    country: { type: String, default: "IN", uppercase: true, trim: true },
    isTrial: { type: Boolean, default: false },
    trialDays: { type: Number, default: 14 },
    trialStartsAt: { type: Date },
    trialEndsAt: { type: Date },
    trialCapacity: { type: Number, default: 50 },
    trialStaffCapacity: { type: Number, default: 5 },
    deletedAt: { type: Date, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret) {
        const { _id, __v, ...rest } = ret;

        return {
          ...rest,
          id: _id.toString(),
        };
      },
    },
  },
);

// Soft delete filter
AcademySchema.pre(
  /^find/,
  function (this: mongoose.Query<any, AcademyDocument>, next) {
    this.where({ deletedAt: { $exists: false } });
    next();
  },
);

export const AcademyModel = mongoose.model<AcademyDocument>(
  "Academy",
  AcademySchema,
);