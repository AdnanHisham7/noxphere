// src/infrastructure/database/models/Student.model.ts
import mongoose, { Schema, Document } from "mongoose";
import { StudentEntity } from "../../../domain/entities/Student.entity";
import { normalizePhone } from "../../../shared/utils/phone";

export interface StudentDocument extends Document {
  userId: mongoose.Types.ObjectId;
  franchiseId?: mongoose.Types.ObjectId;
  teamId?: mongoose.Types.ObjectId;
  coachId?: mongoose.Types.ObjectId;
  guardianIds: mongoose.Types.ObjectId[];
  guardian: StudentEntity["guardian"];
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  ageGroup: string;
  jerseyNumber?: number;
  jerseySize?: string;
  position?: string;
  positions?: string[];
  photo?: string;
  medicalInfo: StudentEntity["medicalInfo"];
  enrollmentDate: Date;
  isActive: boolean;
  status: StudentEntity["status"];
  attendancePercentage: number;
  overallRating: number;
  selectionStatus: StudentEntity["selectionStatus"];
  selectionPhase?: string;
  selectionFeedback?: string;
  transferStatus: StudentEntity["transferStatus"];
  transferPrice?: number;
  transferListedAt?: Date;
  transferNote?: string;
  publicProfileToken: string;
  publicProfileEnabled: boolean;
  publicProfileSettings?: StudentEntity["publicProfileSettings"];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const MedicalInfoSchema = new Schema(
  {
    bloodGroup: String,
    allergies: [String],
    medicalConditions: [String],
    emergencyContactName: { type: String, default: "" },
    emergencyContactPhone: { type: String, default: "" },
    medicalCondition: String,
    medicalNotes: String,
    medicalReportUrl: String,
    medicalCertificateUrl: String,
    scanReportUrl: String,
    pdfAttachmentUrl: String,
    imageAttachmentUrl: String,
    docAttachmentUrl: String,
  },
  { _id: false },
);

const GuardianSchema = new Schema(
  {
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "", lowercase: true },
  },
  { _id: false },
);

const PublicProfileSettingsSchema = new Schema(
  {
    showPhoto: { type: Boolean, default: true },
    showPosition: { type: Boolean, default: true },
    showJerseyNumber: { type: Boolean, default: true },
    showAgeGroup: { type: Boolean, default: true },
    showRating: { type: Boolean, default: true },
    showTeam: { type: Boolean, default: true },
    bio: { type: String, default: "" },
    preferredFoot: { type: String, default: "" },
  },
  { _id: false },
);

const StudentSchema = new Schema<StudentDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    franchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      required: false,
      index: true,
    },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", index: true },
    coachId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    guardianIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    ageGroup: { type: String, required: true, index: true },
    jerseyNumber: Number,
    jerseySize: String,
    position: String,
    positions: [String],
    photo: String,
    medicalInfo: {
      type: MedicalInfoSchema,
      default: () => ({ emergencyContactName: "", emergencyContactPhone: "" }),
    },
    enrollmentDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true, index: true },
    // Manager-selectable lifecycle status for the player, independent of
    // `isActive` (soft-delete gate) and `selectionStatus` (the recruitment
    // pipeline, managed from the Selection board). Lets a manager mark a
    // player on_leave/graduated/dropped_out without removing them from the
    // roster or affecting recruitment-stage tracking.
    status: {
      type: String,
      enum: ["active", "inactive", "on_leave", "graduated", "dropped_out"],
      default: "active",
      index: true,
    },
    attendancePercentage: { type: Number, default: 0, min: 0, max: 100 },
    overallRating: { type: Number, default: 0, min: 0, max: 10 },
    selectionStatus: {
      type: String,
      enum: [
        "pending",
        "shortlisted",
        "on_hold",
        "selected",
        "not_selected",
        "released",
      ],
      default: "pending",
      index: true,
    },
    selectionPhase: String,
    selectionFeedback: String,
    transferStatus: {
      type: String,
      enum: ["not_listed", "listed", "sold"],
      default: "not_listed",
      index: true,
    },
    guardian: { type: GuardianSchema, default: () => ({ name: "", phone: "", email: "" }) },
    transferPrice: Number,
    transferListedAt: Date,
    transferNote: String,
    // Random lookup token for the public, no-auth player page (see
    // PublicPlayerUseCases) — deliberately not the Mongo _id, so public
    // player URLs can't be enumerated by guessing sequential/adjacent
    // ids across the whole platform.
    publicProfileToken: { type: String, unique: true, index: true },
    // Off by default. Only a guardian can turn this on (see
    // ConsentUseCases.setPublicProfileEnabled) — it's a distinct,
    // separately-consented purpose from base enrollment, since
    // publishing a minor's name/photo on the open internet is a
    // materially different exposure than the data processing needed to
    // just run the academy.
    publicProfileEnabled: { type: Boolean, default: false },
    publicProfileSettings: {
      type: PublicProfileSettingsSchema,
      default: () => ({}),
    },
    deletedAt: { type: Date, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret) {
        const { _id, __v, ...rest } = ret;

        rest.id = _id.toString();

        return rest;
      },
    },
  },
);

StudentSchema.pre(
  /^find/,
  function (this: mongoose.Query<unknown, StudentDocument>, next) {
    this.where({ deletedAt: { $exists: false } });
    next();
  },
);

StudentSchema.pre("save", function (next) {
  if (this.positions && this.positions.length > 0) {
    this.position = this.positions[0];
  }
  if (this.guardian?.phone) {
    this.guardian.phone = normalizePhone(this.guardian.phone);
  }
  next();
});

StudentSchema.index({ franchiseId: 1, ageGroup: 1, isActive: 1 });
StudentSchema.index({ franchiseId: 1, transferStatus: 1 });
StudentSchema.index({ firstName: "text", lastName: "text" });

export const StudentModel = mongoose.model<StudentDocument>(
  "Student",
  StudentSchema,
);