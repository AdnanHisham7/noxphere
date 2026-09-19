// src/infrastructure/database/models/PasswordResetOtp.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface PasswordResetOtpDocument extends Document {
  email: string;
  otp: string;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PasswordResetOtpSchema = new Schema<PasswordResetOtpDocument>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 600 }, // 10 minutes TTL auto-cleanup
    verified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

PasswordResetOtpSchema.index({ email: 1, otp: 1 });

export const PasswordResetOtpModel = mongoose.model<PasswordResetOtpDocument>(
  "PasswordResetOtp",
  PasswordResetOtpSchema,
);
