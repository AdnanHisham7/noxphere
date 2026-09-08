import mongoose, { Schema, Document } from "mongoose";
import { normalizePhone } from "../../../shared/utils/phone";

export type RegistrationRequestStatus = "pending" | "approved" | "rejected";

export interface RegistrationRequestDocument extends Document {
  academyId: mongoose.Types.ObjectId;
  franchiseId: mongoose.Types.ObjectId;
  existingStudentId?: mongoose.Types.ObjectId;
  studentDetails: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    gender?: string;
    ageGroup: string;
    position?: string;
    positions?: string[];
    jerseyNumber?: number;
    jerseySize?: string;
    photo?: string;
    medicalInfo?: {
      bloodGroup?: string;
      allergies?: string[];
      medicalConditions?: string[];
      emergencyContactName: string;
      emergencyContactPhone: string;
      medicalNotes?: string;
    };
  };
  guardianDetails: {
    name: string;
    phone: string;
    email: string;
    relation?: string;
  };
  status: RegistrationRequestStatus;
  rejectionReason?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  enrolledStudentId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RegistrationRequestSchema = new Schema<RegistrationRequestDocument>(
  {
    academyId: {
      type: Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
    franchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      required: true,
      index: true,
    },
    existingStudentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      index: true,
    },
    studentDetails: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      dateOfBirth: { type: Date, required: true },
      gender: { type: String },
      ageGroup: { type: String, required: true },
      position: { type: String },
      positions: [{ type: String }],
      jerseyNumber: { type: Number },
      jerseySize: { type: String },
      photo: { type: String },
      medicalInfo: {
        bloodGroup: { type: String },
        allergies: [{ type: String }],
        medicalConditions: [{ type: String }],
        emergencyContactName: { type: String, default: "" },
        emergencyContactPhone: { type: String, default: "" },
        medicalNotes: { type: String },
      },
    },
    guardianDetails: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      relation: { type: String },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: { type: Date },
    enrolledStudentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

RegistrationRequestSchema.pre("save", function (next) {
  if (this.guardianDetails?.phone) {
    this.guardianDetails.phone = normalizePhone(this.guardianDetails.phone);
  }
  next();
});

RegistrationRequestSchema.index({ academyId: 1, status: 1, createdAt: -1 });
RegistrationRequestSchema.index({ franchiseId: 1, status: 1, createdAt: -1 });

export const RegistrationRequestModel = mongoose.model<RegistrationRequestDocument>(
  "RegistrationRequest",
  RegistrationRequestSchema,
);
