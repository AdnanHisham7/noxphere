// src/application/use-cases/employee/EmployeeUseCases.ts
import bcrypt from "bcryptjs";
import { EmployeeModel } from "../../../infrastructure/database/models/Employee.model";
import { EmployeeRoleModel, EmployeePermissionKey } from "../../../infrastructure/database/models/EmployeeRole.model";
import { SalaryPaymentModel } from "../../../infrastructure/database/models/SalaryPayment.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { UserPermissions } from "../../../domain/entities/User.entity";
import { AcademySubscriptionUseCases } from "../subscription/AcademySubscriptionUseCases";
import { NotFoundError, BadRequestError, ConflictError } from "../../../shared/errors/AppError";

const ALL_PERMISSION_KEYS: (keyof UserPermissions)[] = [
  "canManageUsers",
  "canManageFranchises",
  "canManageSessions",
  "canManageFinance",
  "canViewReports",
  "canManageAttendance",
  "canManagePerformance",
  "canManageSelection",
  "canSendNotifications",
];

function permissionsFromKeys(keys: EmployeePermissionKey[]): UserPermissions {
  const perms = {} as UserPermissions;
  for (const key of ALL_PERMISSION_KEYS) {
    perms[key] = keys.includes(key);
  }
  return perms;
}

export interface CreateEmployeeDto {
  academyId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  employeeType: "external" | "staff";
  roleId?: string;
  salaryAmount: number;
  joinDate?: string;
  notes?: string;
}

export class EmployeeUseCases {
  constructor(private academySubscriptionUseCases: AcademySubscriptionUseCases) {}

  async createRole(academyId: string, name: string, permissions: EmployeePermissionKey[]) {
    const existing = await EmployeeRoleModel.findOne({ academyId, name });
    if (existing) throw new ConflictError("A role with this name already exists");
    return EmployeeRoleModel.create({ academyId, name, permissions });
  }

  async listRoles(academyId: string) {
    return EmployeeRoleModel.find({ academyId }).sort({ name: 1 });
  }

  async updateRole(roleId: string, name: string, permissions: EmployeePermissionKey[]) {
    const role = await EmployeeRoleModel.findByIdAndUpdate(roleId, { name, permissions }, { new: true });
    if (!role) throw new NotFoundError("Role");
    // Every staff member currently on this role needs their live
    // User.permissions refreshed — otherwise their JWT (issued at login)
    // keeps working off the old grant set until they happen to log in
    // again, which defeats the point of editing the role.
    const employees = await EmployeeModel.find({ roleId, employeeType: "staff", userId: { $exists: true } });
    const permissionSet = permissionsFromKeys(permissions);
    await Promise.all(
      employees.map((e) => UserModel.findByIdAndUpdate(e.userId, { permissions: permissionSet })),
    );
    return role;
  }

  async deleteRole(roleId: string) {
    const inUse = await EmployeeModel.countDocuments({ roleId });
    if (inUse > 0) {
      throw new BadRequestError("Reassign employees off this role before deleting it");
    }
    const deleted = await EmployeeRoleModel.findByIdAndDelete(roleId);
    if (!deleted) throw new NotFoundError("Role");
  }

  async createEmployee(dto: CreateEmployeeDto) {
    if (dto.employeeType === "staff") {
      // Staff employees count toward the billed staff-seat quota — same
      // "no active subscription / at capacity" gate as adding a player,
      // checked before creating any account so we never have to roll one
      // back.
      await this.academySubscriptionUseCases.assertCanAddStaff(dto.academyId);
      if (!dto.roleId) throw new BadRequestError("A staff employee needs a role assigned");
      if (!dto.email) throw new BadRequestError("A staff employee needs an email to log in with");
    }

    let userId: string | undefined;
    if (dto.employeeType === "staff") {
      const role = await EmployeeRoleModel.findById(dto.roleId);
      if (!role) throw new NotFoundError("Role");

      const existingUser = await UserModel.findOne({ email: dto.email });
      if (existingUser) throw new ConflictError("An account with this email already exists");

      const tempPassword = Math.random().toString(36).slice(-8);
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const user = await UserModel.create({
        email: dto.email,
        passwordHash,
        role: "employee",
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        isActive: true,
        isEmailVerified: false,
        permissions: permissionsFromKeys(role.permissions),
        fcmTokens: [],
        academyId: dto.academyId,
      });
      // TODO: send an email with the temp password — same gap as the
      // guardian/student account creation flow elsewhere in this app.
      userId = user._id.toString();
    }

    const employee = await EmployeeModel.create({
      academyId: dto.academyId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      employeeType: dto.employeeType,
      userId,
      roleId: dto.employeeType === "staff" ? dto.roleId : undefined,
      salaryAmount: dto.salaryAmount,
      joinDate: dto.joinDate ? new Date(dto.joinDate) : new Date(),
      notes: dto.notes,
    });
    return employee;
  }

  async listEmployees(academyId: string) {
    return EmployeeModel.find({ academyId })
      .populate("roleId", "name permissions")
      .sort({ createdAt: -1 });
  }

  async updateEmployee(
    employeeId: string,
    dto: Partial<Pick<CreateEmployeeDto, "firstName" | "lastName" | "phone" | "salaryAmount" | "notes" | "roleId">>,
  ) {
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) throw new NotFoundError("Employee");

    if (dto.roleId && employee.employeeType === "staff" && employee.userId) {
      const role = await EmployeeRoleModel.findById(dto.roleId);
      if (!role) throw new NotFoundError("Role");
      await UserModel.findByIdAndUpdate(employee.userId, { permissions: permissionsFromKeys(role.permissions) });
      employee.roleId = role._id as any;
    }
    if (dto.firstName !== undefined) employee.firstName = dto.firstName;
    if (dto.lastName !== undefined) employee.lastName = dto.lastName;
    if (dto.phone !== undefined) employee.phone = dto.phone;
    if (dto.salaryAmount !== undefined) employee.salaryAmount = dto.salaryAmount;
    if (dto.notes !== undefined) employee.notes = dto.notes;
    await employee.save();

    if ((dto.firstName || dto.lastName || dto.phone) && employee.userId) {
      await UserModel.findByIdAndUpdate(employee.userId, {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.phone && { phone: dto.phone }),
      });
    }
    return employee;
  }

  async setEmployeeActive(employeeId: string, isActive: boolean) {
    const employee = await EmployeeModel.findByIdAndUpdate(employeeId, { isActive }, { new: true });
    if (!employee) throw new NotFoundError("Employee");
    // Deactivating a staff employee revokes their login too — otherwise
    // a still-valid JWT would keep working after they've been marked
    // inactive here.
    if (employee.employeeType === "staff" && employee.userId) {
      await UserModel.findByIdAndUpdate(employee.userId, { isActive });
    }
    return employee;
  }

  async deleteEmployee(employeeId: string) {
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) throw new NotFoundError("Employee");
    if (employee.employeeType === "staff" && employee.userId) {
      await UserModel.findByIdAndUpdate(employee.userId, { isActive: false });
    }
    await EmployeeModel.findByIdAndDelete(employeeId);
  }

  // ─── Salary ────────────────────────────────────────────────────────────

  async logSalaryForPeriod(employeeId: string, period: string) {
    const employee = await EmployeeModel.findById(employeeId).lean();
    if (!employee) throw new NotFoundError("Employee");
    return SalaryPaymentModel.findOneAndUpdate(
      { employeeId, period },
      {
        $setOnInsert: {
          employeeId,
          academyId: employee.academyId,
          period,
          amount: employee.salaryAmount,
          status: "pending",
        },
      },
      { upsert: true, new: true },
    );
  }

  async markSalaryPaid(salaryPaymentId: string, paidBy: string, notes?: string) {
    const payment = await SalaryPaymentModel.findByIdAndUpdate(
      salaryPaymentId,
      { status: "paid", paidAt: new Date(), paidBy, notes },
      { new: true },
    );
    if (!payment) throw new NotFoundError("Salary payment record");
    return payment;
  }

  async listSalaryHistory(employeeId: string) {
    return SalaryPaymentModel.find({ employeeId }).sort({ period: -1 });
  }

  async listSalaryForAcademyPeriod(academyId: string, period: string) {
    // Ensures every active employee has a row for this period before
    // returning the list, so the manager sees the whole roster even for
    // a period no one has touched yet, not just the ones already logged.
    const employees = await EmployeeModel.find({ academyId, isActive: true }).lean();
    await Promise.all(employees.map((e) => this.logSalaryForPeriod(e._id.toString(), period)));
    return SalaryPaymentModel.find({ academyId, period })
      .populate("employeeId", "firstName lastName employeeType")
      .sort({ createdAt: 1 });
  }
}