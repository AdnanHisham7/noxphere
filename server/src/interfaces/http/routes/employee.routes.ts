// src/interfaces/http/routes/employee.routes.ts
import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.middleware";

export const employeeRouter = Router();

employeeRouter.get("/:academyId/roles", authenticate, requirePermission("canManageUsers"), (req, res, next) => {
  req.app.locals.controllers.employee.listRoles(req, res, next);
});
employeeRouter.post("/:academyId/roles", authenticate, requirePermission("canManageUsers"), (req, res, next) => {
  req.app.locals.controllers.employee.createRole(req, res, next);
});
employeeRouter.put("/:academyId/roles/:roleId", authenticate, requirePermission("canManageUsers"), (req, res, next) => {
  req.app.locals.controllers.employee.updateRole(req, res, next);
});
employeeRouter.delete("/:academyId/roles/:roleId", authenticate, requirePermission("canManageUsers"), (req, res, next) => {
  req.app.locals.controllers.employee.deleteRole(req, res, next);
});

employeeRouter.get("/:academyId", authenticate, requirePermission("canManageUsers"), (req, res, next) => {
  req.app.locals.controllers.employee.listEmployees(req, res, next);
});
employeeRouter.post("/:academyId", authenticate, requirePermission("canManageUsers"), (req, res, next) => {
  req.app.locals.controllers.employee.createEmployee(req, res, next);
});
employeeRouter.put("/:academyId/:employeeId", authenticate, requirePermission("canManageUsers"), (req, res, next) => {
  req.app.locals.controllers.employee.updateEmployee(req, res, next);
});
employeeRouter.patch("/:academyId/:employeeId/active", authenticate, requirePermission("canManageUsers"), (req, res, next) => {
  req.app.locals.controllers.employee.setActive(req, res, next);
});
employeeRouter.delete("/:academyId/:employeeId", authenticate, requirePermission("canManageUsers"), (req, res, next) => {
  req.app.locals.controllers.employee.deleteEmployee(req, res, next);
});

employeeRouter.get("/:academyId/salary/period", authenticate, requirePermission("canManageFinance"), (req, res, next) => {
  req.app.locals.controllers.employee.listSalaryForPeriod(req, res, next);
});
employeeRouter.patch("/:academyId/salary/:salaryPaymentId/paid", authenticate, requirePermission("canManageFinance"), (req, res, next) => {
  req.app.locals.controllers.employee.markSalaryPaid(req, res, next);
});
employeeRouter.get("/:academyId/:employeeId/salary-history", authenticate, requirePermission("canManageFinance"), (req, res, next) => {
  req.app.locals.controllers.employee.listSalaryHistory(req, res, next);
});