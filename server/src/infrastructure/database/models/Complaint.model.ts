// src/infrastructure/database/models/Complaint.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ComplaintForwardedCoach {
  coachId: mongoose.Types.ObjectId;
  coachName: string;
  forwardedAt: Date;
  notes?: string;
}

export interface ComplaintCoachResponse {
  coachId: mongoose.Types.ObjectId;
  coachName: string;
  response: string;
  respondedAt: Date;
}

export interface ComplaintDocument extends Document {
  academyId: mongoose.Types.ObjectId;
  raisedBy: mongoose.Types.ObjectId;
  raisedByRole: string;
  raisedByName: string;
  studentId?: mongoose.Types.ObjectId;
  studentName?: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  forwardedToCoaches?: ComplaintForwardedCoach[];
  forwardedBy?: mongoose.Types.ObjectId;
  forwardedByName?: string;
  forwardedAt?: Date;
  forwardedNotes?: string;
  response?: string;
  respondedAt?: Date;
  respondedBy?: mongoose.Types.ObjectId;
  respondedByName?: string;
  coachResponses?: ComplaintCoachResponse[];
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintSchema = new Schema<ComplaintDocument>(
  {
    academyId: { type: Schema.Types.ObjectId, ref: "Academy", required: true, index: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    raisedByRole: { type: String, required: true },
    raisedByName: { type: String, required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", index: true },
    studentName: { type: String, trim: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, maxlength: 3000 },
    status: { type: String, enum: ["open", "in_progress", "resolved"], default: "open", index: true },
    forwardedToCoaches: [
      {
        coachId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        coachName: { type: String, required: true },
        forwardedAt: { type: Date, default: Date.now },
        notes: { type: String, maxlength: 2000 },
      },
    ],
    forwardedBy: { type: Schema.Types.ObjectId, ref: "User" },
    forwardedByName: { type: String },
    forwardedAt: Date,
    forwardedNotes: { type: String, maxlength: 2000 },
    response: { type: String, maxlength: 3000 },
    respondedAt: Date,
    respondedBy: { type: Schema.Types.ObjectId, ref: "User" },
    respondedByName: { type: String },
    coachResponses: [
      {
        coachId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        coachName: { type: String, required: true },
        response: { type: String, required: true, maxlength: 3000 },
        respondedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

ComplaintSchema.index({ "forwardedToCoaches.coachId": 1 });

export const ComplaintModel = mongoose.model<ComplaintDocument>("Complaint", ComplaintSchema);