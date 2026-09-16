// src/infrastructure/database/models/FranchiseTransferLog.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface FranchiseTransferLogDocument extends Document {
  studentId: mongoose.Types.ObjectId;
  academyId: mongoose.Types.ObjectId;
  fromFranchiseId: mongoose.Types.ObjectId;
  toFranchiseId: mongoose.Types.ObjectId;
  transferredBy: mongoose.Types.ObjectId;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FranchiseTransferLogSchema = new Schema<FranchiseTransferLogDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    academyId: {
      type: Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
    fromFranchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      required: true,
    },
    toFranchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      required: true,
    },
    transferredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: { type: String, trim: true, maxlength: 500 },
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

FranchiseTransferLogSchema.index({ studentId: 1, createdAt: -1 });

export const FranchiseTransferLogModel = mongoose.model<FranchiseTransferLogDocument>(
  "FranchiseTransferLog",
  FranchiseTransferLogSchema,
);