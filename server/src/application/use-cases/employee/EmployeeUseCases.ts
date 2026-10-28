// src/application/use-cases/employee/EmployeeUseCases.ts
import bcrypt from "bcryptjs";
import { EmployeeModel } from "../../../infrastructure/database/models/Employee.model";
import { EmployeeRoleModel, EmployeePermissionKey } from "../../../infrastructure/database/models/EmployeeRole.model";
import { SalaryPaymentModel } from "../../../infrastructure/database/models/SalaryPayment.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { UserPermissions } from "../../../domain/entities/User.entity";
import { AcademySubscriptionUseCases } from "../subscription/AcademySubscriptionUseCases";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { NotFoundError, BadRequestError, ConflictError } from "../../../shared/errors/AppError";
import { normalizePhone, getPhoneMatchVariants } from "../../../shared/utils/phone";

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
  designation?: string;
  employeeType?: "external" | "staff";
  roleId?: string;
  franchiseId?: string | null;
  salaryAmount: number;
  joinDate?: string;
  notes?: string;
}

function getPeriodsBetween(startPeriod: string, endPeriod: string): string[] {
  const periods: string[] = [];
  const [startYear, startMonth] = startPeriod.split("-").map(Number);
  const [endYear, endMonth] = endPeriod.split("-").map(Number);

  let curYear = startYear;
  let curMonth = startMonth;

  while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
    periods.push(`${curYear}-${String(curMonth).padStart(2, "0")}`);
    curMonth++;
    if (curMonth > 12) {
      curMonth = 1;
      curYear++;
    }
  }
  return periods;
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
    const employeeType = dto.employeeType || "external";
    if (employeeType === "staff") {
      await this.academySubscriptionUseCases.assertCanAddStaff(dto.academyId);
      if (!dto.roleId) throw new BadRequestError("A staff employee needs a role assigned");
      if (!dto.email) throw new BadRequestError("A staff employee needs an email to log in with");
    }

    const cleanPhone = dto.phone ? normalizePhone(dto.phone) : undefined;
    if (cleanPhone && employeeType === "staff") {
      const existingUserPhone = await UserModel.findOne({
        phone: { $in: getPhoneMatchVariants(cleanPhone) },
      });
      if (existingUserPhone) throw new ConflictError("An account with this phone number already exists");
    }

    let userId: string | undefined;
    if (employeeType === "staff") {
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
        phone: cleanPhone || "",
        isActive: true,
        isEmailVerified: false,
        permissions: permissionsFromKeys(role.permissions),
        fcmTokens: [],
        academyId: dto.academyId,
      });
      userId = user._id.toString();
    }

    const employee = await EmployeeModel.create({
      academyId: dto.academyId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: cleanPhone || dto.phone,
      email: dto.email,
      designation: dto.designation || (employeeType === "staff" ? "Staff" : "Employee"),
      employeeType,
      userId,
      roleId: employeeType === "staff" ? dto.roleId : undefined,
      salaryAmount: dto.salaryAmount,
      joinDate: dto.joinDate ? new Date(dto.joinDate) : new Date(),
      notes: dto.notes,
    });
    return employee;
  }

  async syncAcademyCoaches(academyId: string) {
    try {
      const franchises = await FranchiseModel.find({ academyId }).select("_id").lean();
      const franchiseIds = franchises.map((f) => f._id.toString());

      const coaches = await UserModel.find({
        role: "coach",
        $or: [{ academyId }, { franchiseId: { $in: franchiseIds } }],
      }).lean();

      if (!coaches.length) return;

      let coachRole = await EmployeeRoleModel.findOne({ academyId, name: "Coach" });
      if (!coachRole) {
        coachRole = await EmployeeRoleModel.create({
          academyId,
          name: "Coach",
          permissions: ["canManageSessions", "canManageAttendance", "canManagePerformance", "canManageSelection"],
        });
      }

      for (const coach of coaches) {
        const existing = await EmployeeModel.findOne({
          academyId,
          $or: [{ userId: coach._id }, { email: coach.email }],
        });

        if (!existing) {
          await EmployeeModel.create({
            academyId,
            firstName: coach.firstName,
            lastName: coach.lastName,
            phone: coach.phone,
            email: coach.email,
            designation: "Coach",
            employeeType: "staff",
            userId: coach._id,
            roleId: coachRole._id,
            salaryAmount: 0,
            joinDate: coach.createdAt || new Date(),
            isActive: coach.isActive ?? true,
          });
        } else {
          let needsSave = false;
          if (!existing.userId) {
            existing.userId = coach._id as any;
            needsSave = true;
          }
          if (!existing.roleId) {
            existing.roleId = coachRole._id as any;
            needsSave = true;
          }
          if (!existing.designation) {
            existing.designation = "Coach";
            needsSave = true;
          }
          if (existing.isActive !== coach.isActive) {
            existing.isActive = coach.isActive;
            needsSave = true;
          }
          if (needsSave) {
            await existing.save();
          }
        }
      }
    } catch (err) {
      console.error("Failed to sync coaches to employees for academy:", academyId, err);
    }
  }

  async syncAcademyOperationalManagers(academyId: string) {
    try {
      const franchises = await FranchiseModel.find({ academyId }).select("_id").lean();
      const franchiseIds = franchises.map((f) => f._id.toString());

      const opManagers = await UserModel.find({
        role: "operational_manager",
        $or: [{ academyId }, { franchiseId: { $in: franchiseIds } }],
      }).lean();

      for (const opm of opManagers) {
        const existing = await EmployeeModel.findOne({
          academyId,
          $or: [{ userId: opm._id }, { email: opm.email }],
        });

        if (!existing) {
          await EmployeeModel.create({
            academyId,
            firstName: opm.firstName,
            lastName: opm.lastName,
            phone: opm.phone,
            email: opm.email,
            designation: "Operational Manager",
            employeeType: "staff",
            userId: opm._id,
            franchiseId: opm.franchiseId,
            salaryAmount: (opm as any).salaryAmount ?? 0,
            joinDate: opm.createdAt || new Date(),
            isActive: opm.isActive ?? true,
          });
        } else {
          let needsSave = false;
          if (!existing.userId) {
            existing.userId = opm._id as any;
            needsSave = true;
          }
          if (existing.designation !== "Operational Manager") {
            existing.designation = "Operational Manager";
            needsSave = true;
          }
          if (existing.isActive !== opm.isActive) {
            existing.isActive = opm.isActive;
            needsSave = true;
          }
          if (opm.franchiseId && (!existing.franchiseId || existing.franchiseId.toString() !== opm.franchiseId.toString())) {
            existing.franchiseId = opm.franchiseId as any;
            needsSave = true;
          }
          if (needsSave) {
            await existing.save();
          }
        }
      }
    } catch (err) {
      console.error("Failed to sync operational managers to employees for academy:", academyId, err);
    }
  }

  async listEmployees(academyId: string) {
    await this.syncAcademyCoaches(academyId);
    await this.syncAcademyOperationalManagers(academyId);
    return EmployeeModel.find({ academyId })
      .populate("roleId", "name permissions")
      .populate("franchiseId", "name franchiseCode")
      .populate("userId", "role franchiseId email")
      .sort({ createdAt: -1 });
  }

  async updateEmployee(
    employeeId: string,
    dto: Partial<Pick<CreateEmployeeDto, "firstName" | "lastName" | "phone" | "email" | "designation" | "salaryAmount" | "notes" | "roleId" | "franchiseId">>,
  ) {
    const employee = await EmployeeModel.findById(employeeId);
    if (!employee) throw new NotFoundError("Employee");

    if (dto.roleId && employee.employeeType === "staff" && employee.userId) {
      const role = await EmployeeRoleModel.findById(dto.roleId);
      if (!role) throw new NotFoundError("Role");
      await UserModel.findByIdAndUpdate(employee.userId, { permissions: permissionsFromKeys(role.permissions) });
      employee.roleId = role._id as any;
    }
    if (dto.franchiseId !== undefined) {
      if (dto.franchiseId) {
        employee.franchiseId = dto.franchiseId as any;
        if (employee.userId) {
          await UserModel.findByIdAndUpdate(employee.userId, { franchiseId: dto.franchiseId });
        }
      } else {
        employee.franchiseId = undefined as any;
        if (employee.userId) {
          await UserModel.findByIdAndUpdate(employee.userId, { $unset: { franchiseId: 1 } });
        }
      }
    }
    if (dto.firstName !== undefined) employee.firstName = dto.firstName;
    if (dto.lastName !== undefined) employee.lastName = dto.lastName;
    if (dto.phone !== undefined) employee.phone = dto.phone;
    if (dto.email !== undefined) employee.email = dto.email;
    if (dto.designation !== undefined) employee.designation = dto.designation;
    if (dto.salaryAmount !== undefined) {
      employee.salaryAmount = dto.salaryAmount;
      // When an employee's salary is updated, update all pending (yet to be paid) salary records to the new amount
      await SalaryPaymentModel.updateMany(
        { employeeId: employee._id, status: "pending" },
        { amount: dto.salaryAmount },
      );
    }
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
    const existing = await SalaryPaymentModel.findOne({ employeeId, period });
    if (!existing) {
      return SalaryPaymentModel.create({
        employeeId,
        academyId: employee.academyId,
        period,
        amount: employee.salaryAmount,
        status: "pending",
      });
    }
    // If record is still pending and amount differs from current employee salary, keep it in sync
    if (existing.status === "pending" && existing.amount !== employee.salaryAmount) {
      existing.amount = employee.salaryAmount;
      await existing.save();
    }
    return existing;
  }

  async markSalaryPaid(salaryPaymentId: string, paidBy: string, notes?: string, amount?: number) {
    const updateData: any = { status: "paid", paidAt: new Date(), paidBy, notes };
    if (typeof amount === "number" && !isNaN(amount)) {
      updateData.amount = amount;
    }
    const payment = await SalaryPaymentModel.findByIdAndUpdate(
      salaryPaymentId,
      updateData,
      { new: true },
    );
    if (!payment) throw new NotFoundError("Salary payment record");
    return payment;
  }

  async listSalaryHistory(employeeId: string) {
    const employee = await EmployeeModel.findById(employeeId).lean();
    if (!employee) throw new NotFoundError("Employee");

    const dNow = new Date();
    const currentPeriod = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, "0")}`;
    const joinDate = employee.joinDate || (employee as any).createdAt || new Date();
    const jDate = new Date(joinDate);
    const startPeriod = `${jDate.getFullYear()}-${String(jDate.getMonth() + 1).padStart(2, "0")}`;

    // Ensure all past months up to current period are logged from employee creation/join date
    const periods = getPeriodsBetween(startPeriod, currentPeriod);
    await Promise.all(periods.map((p) => this.logSalaryForPeriod(employeeId, p)));

    // Return history: include past periods from startPeriod up to currentPeriod, PLUS any future periods that have been paid
    return SalaryPaymentModel.find({
      employeeId,
      $or: [
        { period: { $gte: startPeriod, $lte: currentPeriod } },
        { status: "paid" },
      ],
    })
      .populate("paidBy", "firstName lastName email")
      .sort({ period: -1 });
  }

  async listSalaryForAcademyPeriod(academyId: string, period: string) {
    // Ensures every coach and operational manager in the academy has an employee profile
    await this.syncAcademyCoaches(academyId);
    await this.syncAcademyOperationalManagers(academyId);

    // Ensures every active employee has a row for this period before
    // returning the list, so the manager sees the whole roster even for
    // a period no one has touched yet, not just the ones already logged.
    const employees = await EmployeeModel.find({ academyId, isActive: true }).lean();
    await Promise.all(employees.map((e) => this.logSalaryForPeriod(e._id.toString(), period)));
    return SalaryPaymentModel.find({ academyId, period })
      .populate({
        path: "employeeId",
        select: "firstName lastName designation employeeType roleId phone email",
        populate: { path: "roleId", select: "name" },
      })
      .sort({ createdAt: 1 });
  }
}