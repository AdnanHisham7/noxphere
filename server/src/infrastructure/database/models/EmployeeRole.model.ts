// src/infrastructure/database/models/EmployeeRole.model.ts
import mongoose, { Schema, Document } from "mongoose";

// Reuses the exact same permission keys as UserPermissions (see
// User.entity.ts) rather than inventing a parallel vocabulary — every
// existing requirePermission(...)-gated route in the app already checks
// req.user.permissions[key] generically, so an employee granted, say,
// canManageFinance here gets real, enforced access to fee/finance
// endpoints with no other backend changes needed.
const PERMISSION_KEYS = [
  "canManageUsers",
  "canManageFranchises",
  "canManageSessions",
  "canManageFinance",
  "canViewReports",
  "canManageAttendance",
  "canManagePerformance",
  "canManageSelection",
  "canSendNotifications",
] as const;

export type EmployeePermissionKey = (typeof PERMISSION_KEYS)[number];

export interface EmployeeRoleDocument extends Document {
  academyId: mongoose.Types.ObjectId;
  name: string;
  permissions: EmployeePermissionKey[];
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeRoleSchema = new Schema<EmployeeRoleDocument>(
  {
    academyId: { type: Schema.Types.ObjectId, ref: "Academy", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    permissions: [{ type: String, enum: PERMISSION_KEYS }],
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

EmployeeRoleSchema.index({ academyId: 1, name: 1 }, { unique: true });

export const EmployeeRoleModel = mongoose.model<EmployeeRoleDocument>("EmployeeRole", EmployeeRoleSchema);
export { PERMISSION_KEYS };