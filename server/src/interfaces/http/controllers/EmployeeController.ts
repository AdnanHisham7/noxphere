// src/interfaces/http/controllers/EmployeeController.ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { EmployeeUseCases } from "../../../application/use-cases/employee/EmployeeUseCases";
import { PERMISSION_KEYS } from "../../../infrastructure/database/models/EmployeeRole.model";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";
import { ForbiddenError, BadRequestError } from "../../../shared/errors/AppError";

const RoleSchema = z.object({
  name: z.string().min(1).max(60),
  permissions: z.array(z.enum(PERMISSION_KEYS)),
});

const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  employeeType: z.enum(["external", "staff"]),
  roleId: z.string().optional(),
  salaryAmount: z.number().min(0),
  joinDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const UpdateEmployeeSchema = CreateEmployeeSchema.partial().omit({ employeeType: true, email: true });

const ActiveSchema = z.object({ isActive: z.boolean() });
const MarkPaidSchema = z.object({ notes: z.string().max(500).optional() });
const PeriodQuerySchema = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/) });

// Only a manager of this specific academy (or super_admin) can touch its
// employee roster, roles, or salaries — mirrors the same pattern used
// throughout the app (FranchiseController, AcademySubscriptionController).
function assertAcademyAccess(req: Request, academyId: string): void {
  if (req.user!.role === "super_admin") return;
  if (req.user!.role === "manager" && req.user!.academyId === academyId) return;
  throw new ForbiddenError("You can only manage your own academy's employees");
}

export class EmployeeController {
  constructor(private useCases: EmployeeUseCases) {}

  createRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const dto = RoleSchema.parse(req.body);
      const role = await this.useCases.createRole(academyId, dto.name, dto.permissions);
      ResponseHandler.created(res, role, "Role created");
    } catch (err) {
      next(err);
    }
  };

  listRoles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const roles = await this.useCases.listRoles(academyId);
      ResponseHandler.success(res, roles, "Roles retrieved");
    } catch (err) {
      next(err);
    }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertAcademyAccess(req, req.params.academyId);
      const dto = RoleSchema.parse(req.body);
      const role = await this.useCases.updateRole(req.params.roleId, dto.name, dto.permissions);
      ResponseHandler.success(res, role, "Role updated");
    } catch (err) {
      next(err);
    }
  };

  deleteRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertAcademyAccess(req, req.params.academyId);
      await this.useCases.deleteRole(req.params.roleId);
      ResponseHandler.success(res, null, "Role removed");
    } catch (err) {
      next(err);
    }
  };

  createEmployee = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const dto = CreateEmployeeSchema.parse(req.body);
      const employee = await this.useCases.createEmployee({ ...dto, academyId });
      ResponseHandler.created(res, employee, "Employee added");
    } catch (err) {
      next(err);
    }
  };

  listEmployees = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const employees = await this.useCases.listEmployees(academyId);
      ResponseHandler.success(res, employees, "Employees retrieved");
    } catch (err) {
      next(err);
    }
  };

  updateEmployee = async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertAcademyAccess(req, req.params.academyId);
      const dto = UpdateEmployeeSchema.parse(req.body);
      const employee = await this.useCases.updateEmployee(req.params.employeeId, dto);
      ResponseHandler.success(res, employee, "Employee updated");
    } catch (err) {
      next(err);
    }
  };

  setActive = async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertAcademyAccess(req, req.params.academyId);
      const dto = ActiveSchema.parse(req.body);
      const employee = await this.useCases.setEmployeeActive(req.params.employeeId, dto.isActive);
      ResponseHandler.success(res, employee, dto.isActive ? "Employee activated" : "Employee deactivated");
    } catch (err) {
      next(err);
    }
  };

  deleteEmployee = async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertAcademyAccess(req, req.params.academyId);
      await this.useCases.deleteEmployee(req.params.employeeId);
      ResponseHandler.success(res, null, "Employee removed");
    } catch (err) {
      next(err);
    }
  };

  listSalaryForPeriod = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const { period } = PeriodQuerySchema.parse(req.query);
      const records = await this.useCases.listSalaryForAcademyPeriod(academyId, period);
      ResponseHandler.success(res, records, "Salary records retrieved");
    } catch (err) {
      next(err);
    }
  };

  markSalaryPaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertAcademyAccess(req, req.params.academyId);
      const dto = MarkPaidSchema.parse(req.body);
      const payment = await this.useCases.markSalaryPaid(req.params.salaryPaymentId, req.user!.sub, dto.notes);
      ResponseHandler.success(res, payment, "Marked as paid");
    } catch (err) {
      next(err);
    }
  };

  listSalaryHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertAcademyAccess(req, req.params.academyId);
      const history = await this.useCases.listSalaryHistory(req.params.employeeId);
      ResponseHandler.success(res, history, "Salary history retrieved");
    } catch (err) {
      next(err);
    }
  };
}