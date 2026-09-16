// src/infrastructure/database/models/RegistrationOtp.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface RegistrationOtpDocument extends Document {
  email: string;
  studentId: mongoose.Types.ObjectId;
  otp: string;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RegistrationOtpSchema = new Schema<RegistrationOtpDocument>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 600 }, // TTL index auto-deletes after 10 mins
    verified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

RegistrationOtpSchema.index({ email: 1, otp: 1 });

export const RegistrationOtpModel = mongoose.model<RegistrationOtpDocument>(
  "RegistrationOtp",
  RegistrationOtpSchema,
);
