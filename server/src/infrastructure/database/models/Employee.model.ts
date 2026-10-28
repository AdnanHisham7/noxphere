// src/infrastructure/database/models/Employee.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface EmployeeDocument extends Document {
  academyId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  designation?: string;
  // 'external' — e.g. a groundskeeper, physio, or any record-only employee:
  // an HR/payroll record only, no login method, no permissions.
  // 'staff' — coach or operational manager with user login.
  employeeType: "external" | "staff";
  userId?: mongoose.Types.ObjectId;
  roleId?: mongoose.Types.ObjectId;
  franchiseId?: mongoose.Types.ObjectId;
  salaryAmount: number;
  joinDate: Date;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<EmployeeDocument>(
  {
    academyId: { type: Schema.Types.ObjectId, ref: "Academy", required: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: String,
    email: { type: String, trim: true, lowercase: true },
    designation: { type: String, trim: true },
    employeeType: { type: String, enum: ["external", "staff"], default: "external" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    roleId: { type: Schema.Types.ObjectId, ref: "EmployeeRole" },
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", index: true },
    salaryAmount: { type: Number, required: true, min: 0 },
    joinDate: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, maxlength: 1000 },
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

export const EmployeeModel = mongoose.model<EmployeeDocument>("Employee", EmployeeSchema);