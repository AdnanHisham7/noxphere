import mongoose, { Schema, Document } from "mongoose";
import {
  AcademyEntity,
  Location,
} from "../../../domain/entities/Academy.entity";

export interface AcademyDocument extends Document {
  name: string;
  academyCode: string;
  managerId: mongoose.Types.ObjectId;
  location: Location;
  ageGroups: string[];
  maxStudents: number;
  isActive: boolean;
  transferWallEnabled: boolean;
  alertBeforeMinutes: number;
  notificationAlertAfterMinutes: number;
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
  skillParameters: string[];
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
    ageGroups: [{ type: String }],
    maxStudents: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true, index: true },
    transferWallEnabled: { type: Boolean, default: true },
    alertBeforeMinutes: { type: Number, default: 60 },
    notificationAlertAfterMinutes: { type: Number, default: 15 },
    absentAlertDays: { type: Number, default: 5, min: 1 },
    dueDateAlertDays: { type: Number, default: 3, min: 0 },
    feeQrImageUrl: { type: String },
    skillParameters: {
      type: [String],
      default: [
        "Dribbling",
        "Passing",
        "Shooting",
        "Speed",
        "Tactical Awareness",
        "Attitude",
      ],
    },
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