// src/interfaces/http/routes/expense.routes.ts
import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.middleware";

export const expenseRouter = Router();

// Gated for users with canManageFinance permission (manager, super_admin, employee with role)
expenseRouter.use(authenticate, requirePermission("canManageFinance"));

// Expenses (Purchases & Miscellaneous)
expenseRouter.post("/", (req, res, next) => {
  req.app.locals.controllers.expense.createExpense(req, res, next);
});

expenseRouter.get("/", (req, res, next) => {
  req.app.locals.controllers.expense.listExpenses(req, res, next);
});

expenseRouter.get("/analytics/report", (req, res, next) => {
  req.app.locals.controllers.expense.getAnalyticsReport(req, res, next);
});

expenseRouter.get("/stocks", (req, res, next) => {
  req.app.locals.controllers.expense.listStocks(req, res, next);
});

expenseRouter.post("/stocks", (req, res, next) => {
  req.app.locals.controllers.expense.createStock(req, res, next);
});

expenseRouter.get("/stocks/:id", (req, res, next) => {
  req.app.locals.controllers.expense.getStockById(req, res, next);
});

expenseRouter.put("/stocks/:id", (req, res, next) => {
  req.app.locals.controllers.expense.updateStock(req, res, next);
});

expenseRouter.post("/stocks/:id/issue", (req, res, next) => {
  req.app.locals.controllers.expense.issueStock(req, res, next);
});

expenseRouter.patch("/stocks/:id/adjust", (req, res, next) => {
  req.app.locals.controllers.expense.adjustStock(req, res, next);
});

// Income
expenseRouter.post("/incomes", (req, res, next) => {
  req.app.locals.controllers.expense.createIncome(req, res, next);
});

expenseRouter.get("/incomes", (req, res, next) => {
  req.app.locals.controllers.expense.listIncomes(req, res, next);
});

expenseRouter.delete("/incomes/:id", (req, res, next) => {
  req.app.locals.controllers.expense.deleteIncome(req, res, next);
});

// Expense details and actions
expenseRouter.get("/:id", (req, res, next) => {
  req.app.locals.controllers.expense.getExpenseById(req, res, next);
});

expenseRouter.put("/:id", (req, res, next) => {
  req.app.locals.controllers.expense.updateExpense(req, res, next);
});

expenseRouter.delete("/:id", (req, res, next) => {
  req.app.locals.controllers.expense.deleteExpense(req, res, next);
});

expenseRouter.post("/:id/verify", (req, res, next) => {
  req.app.locals.controllers.expense.verifyPurchase(req, res, next);
});

expenseRouter.post("/:id/reject", (req, res, next) => {
  req.app.locals.controllers.expense.rejectPurchase(req, res, next);
});
