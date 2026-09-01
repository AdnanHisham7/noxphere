// src/infrastructure/database/models/Complaint.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ComplaintDocument extends Document {
  academyId: mongoose.Types.ObjectId;
  raisedBy: mongoose.Types.ObjectId;
  raisedByRole: string;
  raisedByName: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  response?: string;
  respondedAt?: Date;
  respondedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintSchema = new Schema<ComplaintDocument>(
  {
    academyId: { type: Schema.Types.ObjectId, ref: "Academy", required: true, index: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    raisedByRole: { type: String, required: true },
    raisedByName: { type: String, required: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, maxlength: 3000 },
    status: { type: String, enum: ["open", "in_progress", "resolved"], default: "open", index: true },
    response: { type: String, maxlength: 3000 },
    respondedAt: Date,
    respondedBy: { type: Schema.Types.ObjectId, ref: "User" },
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

export const ComplaintModel = mongoose.model<ComplaintDocument>("Complaint", ComplaintSchema);