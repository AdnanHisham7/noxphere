// src/infrastructure/database/models/SalaryPayment.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface SalaryPaymentDocument extends Document {
  employeeId: mongoose.Types.ObjectId;
  academyId: mongoose.Types.ObjectId;
  // "YYYY-MM" — one record per employee per calendar month.
  period: string;
  amount: number;
  status: "pending" | "paid";
  paidAt?: Date;
  paidBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalaryPaymentSchema = new Schema<SalaryPaymentDocument>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    academyId: { type: Schema.Types.ObjectId, ref: "Academy", required: true, index: true },
    period: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "paid"], default: "pending", index: true },
    paidAt: Date,
    paidBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, maxlength: 500 },
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

SalaryPaymentSchema.index({ employeeId: 1, period: 1 }, { unique: true });

export const SalaryPaymentModel = mongoose.model<SalaryPaymentDocument>("SalaryPayment", SalaryPaymentSchema);