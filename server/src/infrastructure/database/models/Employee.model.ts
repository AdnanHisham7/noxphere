// src/infrastructure/database/models/Employee.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface EmployeeDocument extends Document {
  academyId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  // 'external' — e.g. a groundskeeper or physio who isn't managing the
  // software at all: an HR/payroll record only, no login, no
  // permissions, and doesn't count toward the staff-seat billing quota.
  // 'staff' — has a real login (a User with role 'employee'), an
  // assigned EmployeeRole granting specific permissions, and counts
  // toward provisionedStaffCapacity on AcademySubscription (see
  // EmployeeUseCases.assertCanAddStaff), billed at
  // staffRatePerStaffPerMonth alongside the per-student rate.
  employeeType: "external" | "staff";
  userId?: mongoose.Types.ObjectId;
  roleId?: mongoose.Types.ObjectId;
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
    employeeType: { type: String, enum: ["external", "staff"], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    roleId: { type: Schema.Types.ObjectId, ref: "EmployeeRole" },
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