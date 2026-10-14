// src/infrastructure/database/models/Income.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IncomeDocument extends Document {
  academyId: mongoose.Types.ObjectId;
  franchiseId?: mongoose.Types.ObjectId;
  source: string;
  category: string;
  amount: number;
  date: Date;
  paymentMethod: string;
  payerName?: string;
  referenceNumber?: string;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const IncomeSchema = new Schema<IncomeDocument>(
  {
    academyId: { type: Schema.Types.ObjectId, ref: "Academy", required: true, index: true },
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", index: true },
    source: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      default: "Other Income",
      trim: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now, index: true },
    paymentMethod: {
      type: String,
      default: "bank_transfer",
    },
    payerName: { type: String, trim: true },
    referenceNumber: { type: String, trim: true },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
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
  }
);

IncomeSchema.index({ academyId: 1, date: -1 });
IncomeSchema.index({ franchiseId: 1, date: -1 });

export const IncomeModel = mongoose.model<IncomeDocument>("Income", IncomeSchema);
