// src/infrastructure/database/models/PlatformSettings.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface PlatformSettingsDocument extends Document {
  // Singleton row — always looked up with no filter (see
  // PlatformSettingsModel.findOne()), so this collection only ever holds
  // one document.
  defaultRatePerStudentPerDay: number;
  defaultStaffRatePerStaffPerMonth: number;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<PlatformSettingsDocument>(
  {
    defaultRatePerStudentPerDay: { type: Number, required: true, default: 1, min: 0 },
    defaultStaffRatePerStaffPerMonth: { type: Number, required: true, default: 10, min: 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const PlatformSettingsModel = mongoose.model<PlatformSettingsDocument>(
  "PlatformSettings",
  PlatformSettingsSchema,
);