// src/interfaces/http/controllers/ExpenseController.ts
import { Request, Response, NextFunction } from "express";
import { ExpenseUseCases } from "../../../application/use-cases/expense/ExpenseUseCases";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";
import { BadRequestError } from "../../../shared/errors/AppError";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";

export class ExpenseController {
  constructor(private useCases: ExpenseUseCases) {}

  private async getUserContext(req: Request) {
    const userId = req.user?.sub || "";
    let userName = "User";
    if (userId) {
      const u = await UserModel.findById(userId).select("firstName lastName").lean();
      if (u) userName = `${u.firstName} ${u.lastName}`.trim();
    }
    return { id: userId, name: userName };
  }

  private async resolveAcademyId(req: Request): Promise<string> {
    if (req.body?.academyId) return req.body.academyId;
    if (req.query?.academyId) return req.query.academyId as string;
    if (req.user?.academyId) return req.user.academyId;

    if (req.body?.franchiseId) {
      const f = await FranchiseModel.findById(req.body.franchiseId).select("academyId").lean();
      if (f?.academyId) return f.academyId.toString();
    }
    if (req.query?.franchiseId && req.query.franchiseId !== "all") {
      const f = await FranchiseModel.findById(req.query.franchiseId).select("academyId").lean();
      if (f?.academyId) return f.academyId.toString();
    }
    if (req.user?.franchiseId) {
      const f = await FranchiseModel.findById(req.user.franchiseId).select("academyId").lean();
      if (f?.academyId) return f.academyId.toString();
    }

    throw new BadRequestError("Unable to resolve academyId. Please provide academyId or franchiseId.");
  }

  createExpense = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = await this.resolveAcademyId(req);
      const user = await this.getUserContext(req);
      const expense = await this.useCases.createExpense({ ...req.body, academyId }, user);
      ResponseHandler.created(res, expense, "Expense created successfully");
    } catch (err) {
      next(err);
    }
  };

  listExpenses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = await this.resolveAcademyId(req);
      const result = await this.useCases.listExpenses({
        academyId,
        franchiseId: req.query.franchiseId as string,
        type: req.query.type as string,
        verificationStatus: req.query.verificationStatus as string,
        category: req.query.category as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        search: req.query.search as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 50,
      });
      ResponseHandler.success(res, result, "Expenses retrieved successfully");
    } catch (err) {
      next(err);
    }
  };

  getExpenseById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expense = await this.useCases.getExpenseById(req.params.id);
      ResponseHandler.success(res, expense, "Expense retrieved");
    } catch (err) {
      next(err);
    }
  };

  updateExpense = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.getUserContext(req);
      const expense = await this.useCases.updateExpense(req.params.id, req.body, user);
      ResponseHandler.success(res, expense, "Expense updated successfully");
    } catch (err) {
      next(err);
    }
  };

  deleteExpense = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.getUserContext(req);
      const result = await this.useCases.deleteExpense(req.params.id, user);
      ResponseHandler.success(res, result, "Expense deleted successfully");
    } catch (err) {
      next(err);
    }
  };

  verifyPurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.getUserContext(req);
      const expense = await this.useCases.verifyPurchase(req.params.id, user);
      ResponseHandler.success(res, expense, "Purchase verified and converted to stocks");
    } catch (err) {
      next(err);
    }
  };

  rejectPurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.getUserContext(req);
      const { reason } = req.body;
      const expense = await this.useCases.rejectPurchase(req.params.id, reason, user);
      ResponseHandler.success(res, expense, "Purchase rejected");
    } catch (err) {
      next(err);
    }
  };

  // ─── STOCKS ─────────────────────────────────────────────────────────────────

  listStocks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = await this.resolveAcademyId(req);
      const result = await this.useCases.listStocks({
        academyId,
        franchiseId: req.query.franchiseId as string,
        status: req.query.status as string,
        category: req.query.category as string,
        search: req.query.search as string,
      });
      ResponseHandler.success(res, result, "Stock items retrieved");
    } catch (err) {
      next(err);
    }
  };

  getStockById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await this.useCases.getStockById(req.params.id);
      ResponseHandler.success(res, item, "Stock item retrieved");
    } catch (err) {
      next(err);
    }
  };

  createStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = await this.resolveAcademyId(req);
      const user = await this.getUserContext(req);
      const item = await this.useCases.createStock({ ...req.body, academyId }, user);
      ResponseHandler.created(res, item, "Stock item created successfully");
    } catch (err) {
      next(err);
    }
  };

  updateStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await this.useCases.updateStock(req.params.id, req.body);
      ResponseHandler.success(res, item, "Stock item updated successfully");
    } catch (err) {
      next(err);
    }
  };

  issueStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.getUserContext(req);
      const item = await this.useCases.issueStock(req.params.id, req.body, user);
      ResponseHandler.success(res, item, "Stock issued successfully");
    } catch (err) {
      next(err);
    }
  };

  adjustStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.getUserContext(req);
      const item = await this.useCases.adjustStock(req.params.id, req.body, user);
      ResponseHandler.success(res, item, "Stock quantity adjusted successfully");
    } catch (err) {
      next(err);
    }
  };

  // ─── INCOMES ────────────────────────────────────────────────────────────────

  createIncome = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = await this.resolveAcademyId(req);
      const user = await this.getUserContext(req);
      const income = await this.useCases.createIncome({ ...req.body, academyId }, user);
      ResponseHandler.created(res, income, "Income recorded successfully");
    } catch (err) {
      next(err);
    }
  };

  listIncomes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = await this.resolveAcademyId(req);
      const incomes = await this.useCases.listIncomes({
        academyId,
        franchiseId: req.query.franchiseId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });
      ResponseHandler.success(res, incomes, "Income records retrieved");
    } catch (err) {
      next(err);
    }
  };

  deleteIncome = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.useCases.deleteIncome(req.params.id);
      ResponseHandler.success(res, result, "Income record deleted");
    } catch (err) {
      next(err);
    }
  };

  // ─── ANALYTICS & ADVANCED REPORTS ───────────────────────────────────────────

  getAnalyticsReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = await this.resolveAcademyId(req);
      const timeframe = (req.query.timeframe as any) || "month";
      const report = await this.useCases.getAnalyticsReport({
        academyId,
        franchiseId: req.query.franchiseId as string,
        timeframe,
        date: req.query.date as string,
        month: req.query.month as string,
        year: req.query.year as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });
      ResponseHandler.success(res, report, "Analytics report generated successfully");
    } catch (err) {
      next(err);
    }
  };
}
