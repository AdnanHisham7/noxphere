// src/application/use-cases/expense/ExpenseUseCases.ts
import mongoose from "mongoose";
import {
  ExpenseModel,
  ExpenseDocument,
  ExpenseType,
  PurchaseStatus,
  PaymentMethod,
} from "../../../infrastructure/database/models/Expense.model";
import {
  StockItemModel,
  StockItemDocument,
  StockStatus,
  StockLogAction,
} from "../../../infrastructure/database/models/StockItem.model";
import { IncomeModel } from "../../../infrastructure/database/models/Income.model";
import { FeeModel } from "../../../infrastructure/database/models/Fee.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { SalaryPaymentModel } from "../../../infrastructure/database/models/SalaryPayment.model";
import { BadRequestError, NotFoundError } from "../../../shared/errors/AppError";

export interface CreateExpenseInput {
  academyId: string;
  franchiseId?: string;
  type: ExpenseType;

  // Purchases
  itemName?: string;
  category: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  stockItemId?: string;
  verifyImmediately?: boolean;

  // Miscellaneous
  title?: string;

  // Common
  amount?: number;
  date?: string | Date;
  vendor?: string;
  vendorContact?: string;
  invoiceNumber?: string;
  paymentMethod?: PaymentMethod;
  receiptUrl?: string;
  notes?: string;
}

export interface UserContext {
  id: string;
  name: string;
}

export interface FeeInflowRecord {
  id: string;
  studentName: string;
  franchiseName?: string;
  installmentNumber: number;
  amount: number;
  paidAt: Date;
  paymentMethod?: string;
  transactionId?: string;
  feeType: string;
}

export class ExpenseUseCases {
  private async getQueryFranchiseIds(params: { franchiseId?: string; academyId?: string }): Promise<mongoose.Types.ObjectId[]> {
    if (params.franchiseId) {
      return [new mongoose.Types.ObjectId(params.franchiseId)];
    }
    if (params.academyId) {
      const franchises = await FranchiseModel.find({ academyId: params.academyId }).select("_id").lean();
      return franchises.map((f) => f._id);
    }
    return [];
  }

  // ─── EXPENSE MANAGEMENT ────────────────────────────────────────────────────────

  async createExpense(input: CreateExpenseInput, user: UserContext) {
    if (!input.academyId) throw new BadRequestError("academyId is required");
    if (!input.type) throw new BadRequestError("Expense type is required ('purchase' or 'miscellaneous')");

    let finalAmount = input.amount;

    if (input.type === "purchase") {
      if (!input.itemName?.trim()) throw new BadRequestError("Item name is required for purchase");
      if (!input.quantity || input.quantity <= 0) throw new BadRequestError("Quantity must be greater than 0");
      if (input.unitPrice === undefined || input.unitPrice < 0) throw new BadRequestError("Unit price must be non-negative");

      if (finalAmount === undefined || finalAmount === null) {
        finalAmount = input.quantity * input.unitPrice;
      }
    } else {
      if (!input.title?.trim()) throw new BadRequestError("Title/Description is required for miscellaneous expense");
      if (!finalAmount || finalAmount <= 0) throw new BadRequestError("Amount must be greater than 0");
    }

    const expense = new ExpenseModel({
      academyId: new mongoose.Types.ObjectId(input.academyId),
      franchiseId: input.franchiseId ? new mongoose.Types.ObjectId(input.franchiseId) : undefined,
      type: input.type,
      itemName: input.itemName?.trim(),
      category: input.category || (input.type === "purchase" ? "Equipment" : "Miscellaneous"),
      quantity: input.quantity,
      unit: input.unit || "units",
      unitPrice: input.unitPrice,
      stockItemId: input.stockItemId ? new mongoose.Types.ObjectId(input.stockItemId) : undefined,
      verificationStatus: input.type === "purchase" ? "pending" : undefined,
      title: input.title?.trim(),
      amount: finalAmount,
      date: input.date ? new Date(input.date) : new Date(),
      vendor: input.vendor?.trim(),
      vendorContact: input.vendorContact?.trim(),
      invoiceNumber: input.invoiceNumber?.trim(),
      paymentMethod: input.paymentMethod || "bank_transfer",
      receiptUrl: input.receiptUrl,
      notes: input.notes?.trim(),
      createdBy: new mongoose.Types.ObjectId(user.id),
      createdByName: user.name,
    });

    await expense.save();

    // If user requested immediate verification upon purchase creation
    if (input.type === "purchase" && input.verifyImmediately) {
      await this.verifyPurchase(expense._id.toString(), user);
      return (await ExpenseModel.findById(expense._id))!;
    }

    return expense;
  }

  async verifyPurchase(expenseId: string, user: UserContext) {
    const expense = await ExpenseModel.findById(expenseId);
    if (!expense) throw new NotFoundError("Expense record not found");
    if (expense.type !== "purchase") throw new BadRequestError("Only purchase expenses can be verified into stock");
    if (expense.verificationStatus === "verified") {
      throw new BadRequestError("This purchase is already verified");
    }

    const qty = expense.quantity || 1;
    const unitPrice = expense.unitPrice || 0;

    // Look for existing stock item
    let stockItem: StockItemDocument | null = null;
    if (expense.stockItemId) {
      stockItem = await StockItemModel.findById(expense.stockItemId);
    }

    if (!stockItem) {
      // Find matching item by academy and name
      stockItem = await StockItemModel.findOne({
        academyId: expense.academyId,
        ...(expense.franchiseId ? { franchiseId: expense.franchiseId } : {}),
        name: { $regex: new RegExp(`^${expense.itemName?.trim()}$`, "i") },
      });
    }

    if (stockItem) {
      const prevQty = stockItem.quantity;
      stockItem.quantity += qty;
      stockItem.unitPrice = unitPrice > 0 ? unitPrice : stockItem.unitPrice;
      stockItem.lastRestockedAt = new Date();
      stockItem.lastPurchaseId = expense._id;
      stockItem.stockLogs.push({
        action: "purchase_restock",
        quantityChange: qty,
        previousQuantity: prevQty,
        newQuantity: stockItem.quantity,
        reason: `Purchase Verified: ${expense.invoiceNumber ? "Inv #" + expense.invoiceNumber : "P-" + expense._id.toString().slice(-6)}`,
        performedBy: new mongoose.Types.ObjectId(user.id),
        performedByName: user.name,
        date: new Date(),
        referenceId: expense._id.toString(),
      });
      await stockItem.save();
      expense.stockItemId = stockItem._id;
    } else {
      // Create new stock item automatically
      const newStock = new StockItemModel({
        academyId: expense.academyId,
        franchiseId: expense.franchiseId,
        name: expense.itemName?.trim() || "Item",
        category: expense.category || "Equipment",
        unit: expense.unit || "units",
        quantity: qty,
        minQuantityAlert: 5,
        unitPrice: unitPrice,
        lastRestockedAt: new Date(),
        lastPurchaseId: expense._id,
        notes: expense.notes,
        stockLogs: [
          {
            action: "purchase_restock",
            quantityChange: qty,
            previousQuantity: 0,
            newQuantity: qty,
            reason: `Initial Stock from Verified Purchase ${expense.invoiceNumber ? "Inv #" + expense.invoiceNumber : "P-" + expense._id.toString().slice(-6)}`,
            performedBy: new mongoose.Types.ObjectId(user.id),
            performedByName: user.name,
            date: new Date(),
            referenceId: expense._id.toString(),
          },
        ],
      });
      await newStock.save();
      expense.stockItemId = newStock._id;
    }

    expense.verificationStatus = "verified";
    expense.verifiedBy = new mongoose.Types.ObjectId(user.id);
    expense.verifiedByName = user.name;
    expense.verifiedAt = new Date();
    expense.rejectionReason = undefined;

    await expense.save();
    return expense;
  }

  async rejectPurchase(expenseId: string, reason: string, user: UserContext) {
    const expense = await ExpenseModel.findById(expenseId);
    if (!expense) throw new NotFoundError("Expense record not found");
    if (expense.type !== "purchase") throw new BadRequestError("Only purchase expenses can be rejected");
    if (expense.verificationStatus === "verified") {
      throw new BadRequestError("Cannot reject an already verified purchase. Please adjust stock or delete the record instead.");
    }

    expense.verificationStatus = "rejected";
    expense.rejectionReason = reason || "Rejected by reviewer";
    expense.verifiedBy = new mongoose.Types.ObjectId(user.id);
    expense.verifiedByName = user.name;
    expense.verifiedAt = new Date();

    await expense.save();
    return expense;
  }

  async listExpenses(filters: {
    academyId: string;
    franchiseId?: string;
    type?: string;
    verificationStatus?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    if (!filters.academyId) throw new BadRequestError("academyId is required");

    const query: any = { academyId: new mongoose.Types.ObjectId(filters.academyId) };

    if (filters.franchiseId && filters.franchiseId !== "all") {
      query.franchiseId = new mongoose.Types.ObjectId(filters.franchiseId);
    }

    if (filters.type && filters.type !== "all") {
      query.type = filters.type;
    }

    if (filters.verificationStatus && filters.verificationStatus !== "all") {
      query.verificationStatus = filters.verificationStatus;
    }

    if (filters.category && filters.category !== "all") {
      query.category = filters.category;
    }

    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) query.date.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (filters.search?.trim()) {
      const s = filters.search.trim();
      query.$or = [
        { itemName: { $regex: s, $options: "i" } },
        { title: { $regex: s, $options: "i" } },
        { vendor: { $regex: s, $options: "i" } },
        { invoiceNumber: { $regex: s, $options: "i" } },
        { category: { $regex: s, $options: "i" } },
      ];
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(filters.limit) || 50));
    const skip = (page - 1) * limit;

    const [expenses, totalCount, aggregateStats] = await Promise.all([
      ExpenseModel.find(query)
        .populate("franchiseId", "name franchiseCode")
        .populate("stockItemId", "name quantity unit")
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ExpenseModel.countDocuments(query),
      ExpenseModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            purchasesAmount: {
              $sum: { $cond: [{ $eq: ["$type", "purchase"] }, "$amount", 0] },
            },
            verifiedPurchasesAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "purchase"] },
                      { $eq: ["$verificationStatus", "verified"] },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            miscAmount: {
              $sum: { $cond: [{ $eq: ["$type", "miscellaneous"] }, "$amount", 0] },
            },
            pendingPurchasesCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "purchase"] },
                      { $eq: ["$verificationStatus", "pending"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const stats = aggregateStats[0] || {
      totalAmount: 0,
      purchasesAmount: 0,
      verifiedPurchasesAmount: 0,
      miscAmount: 0,
      pendingPurchasesCount: 0,
    };

    return {
      expenses,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      stats,
    };
  }

  async getExpenseById(id: string) {
    const expense = await ExpenseModel.findById(id)
      .populate("franchiseId", "name franchiseCode")
      .populate("stockItemId")
      .lean();
    if (!expense) throw new NotFoundError("Expense record not found");
    return expense;
  }

  async updateExpense(id: string, updateData: Partial<CreateExpenseInput>, user: UserContext) {
    const expense = await ExpenseModel.findById(id);
    if (!expense) throw new NotFoundError("Expense record not found");

    if (expense.verificationStatus === "verified" && updateData.quantity && updateData.quantity !== expense.quantity) {
      throw new BadRequestError("Cannot directly change quantity of an already verified purchase. Please adjust stock count or delete and re-enter.");
    }

    if (updateData.title !== undefined) expense.title = updateData.title.trim();
    if (updateData.itemName !== undefined) expense.itemName = updateData.itemName.trim();
    if (updateData.category !== undefined) expense.category = updateData.category;
    if (updateData.unitPrice !== undefined) expense.unitPrice = updateData.unitPrice;
    if (updateData.amount !== undefined) expense.amount = updateData.amount;
    if (updateData.vendor !== undefined) expense.vendor = updateData.vendor.trim();
    if (updateData.vendorContact !== undefined) expense.vendorContact = updateData.vendorContact.trim();
    if (updateData.invoiceNumber !== undefined) expense.invoiceNumber = updateData.invoiceNumber.trim();
    if (updateData.paymentMethod !== undefined) expense.paymentMethod = updateData.paymentMethod;
    if (updateData.notes !== undefined) expense.notes = updateData.notes.trim();
    if (updateData.receiptUrl !== undefined) expense.receiptUrl = updateData.receiptUrl;
    if (updateData.date !== undefined) expense.date = new Date(updateData.date);

    await expense.save();
    return expense;
  }

  async deleteExpense(id: string, user: UserContext) {
    const expense = await ExpenseModel.findById(id);
    if (!expense) throw new NotFoundError("Expense record not found");

    // If verified purchase, adjust associated stock
    if (expense.type === "purchase" && expense.verificationStatus === "verified" && expense.stockItemId) {
      const stockItem = await StockItemModel.findById(expense.stockItemId);
      if (stockItem) {
        const qtyToDeduct = Math.min(stockItem.quantity, expense.quantity || 0);
        const prev = stockItem.quantity;
        stockItem.quantity = Math.max(0, stockItem.quantity - qtyToDeduct);
        stockItem.stockLogs.push({
          action: "audit_adjustment",
          quantityChange: -qtyToDeduct,
          previousQuantity: prev,
          newQuantity: stockItem.quantity,
          reason: `Reverted due to deletion of Purchase #${expense.invoiceNumber || expense._id.toString().slice(-6)}`,
          performedBy: new mongoose.Types.ObjectId(user.id),
          performedByName: user.name,
          date: new Date(),
        });
        await stockItem.save();
      }
    }

    await ExpenseModel.findByIdAndDelete(id);
    return { success: true, message: "Expense record deleted successfully" };
  }

  // ─── STOCK / INVENTORY MANAGEMENT ───────────────────────────────────────────

  async listStocks(filters: {
    academyId: string;
    franchiseId?: string;
    status?: string;
    category?: string;
    search?: string;
  }): Promise<{ items: any[]; summary: any }> {
    if (!filters.academyId) throw new BadRequestError("academyId is required");

    const query: any = { academyId: new mongoose.Types.ObjectId(filters.academyId) };

    if (filters.franchiseId && filters.franchiseId !== "all") {
      query.franchiseId = new mongoose.Types.ObjectId(filters.franchiseId);
    }

    if (filters.status && filters.status !== "all") {
      query.status = filters.status;
    }

    if (filters.category && filters.category !== "all") {
      query.category = filters.category;
    }

    if (filters.search?.trim()) {
      const s = filters.search.trim();
      query.$or = [
        { name: { $regex: s, $options: "i" } },
        { sku: { $regex: s, $options: "i" } },
        { location: { $regex: s, $options: "i" } },
      ];
    }

    const items = await StockItemModel.find(query)
      .populate("franchiseId", "name franchiseCode")
      .sort({ status: 1, quantity: 1, name: 1 })
      .lean();

    const formatted = items.map((item) => ({
      ...item,
      id: item._id.toString(),
      totalValue: (item.quantity || 0) * (item.unitPrice || 0),
    }));

    const summary = {
      totalItems: formatted.length,
      inStockCount: formatted.filter((i) => i.status === "in_stock").length,
      lowStockCount: formatted.filter((i) => i.status === "low_stock").length,
      outOfStockCount: formatted.filter((i) => i.status === "out_of_stock").length,
      totalInventoryValuation: formatted.reduce((sum, i) => sum + i.totalValue, 0),
    };

    return { items: formatted, summary };
  }

  async getStockById(id: string): Promise<any> {
    const stockItem = await StockItemModel.findById(id)
      .populate("franchiseId", "name franchiseCode")
      .populate("lastPurchaseId", "invoiceNumber date vendor amount unitPrice")
      .lean();
    if (!stockItem) throw new NotFoundError("Stock item not found");
    return {
      ...stockItem,
      id: stockItem._id.toString(),
      totalValue: (stockItem.quantity || 0) * (stockItem.unitPrice || 0),
    };
  }

  async createStock(
    data: {
      academyId: string;
      franchiseId?: string;
      name: string;
      sku?: string;
      category: string;
      unit: string;
      initialQuantity?: number;
      minQuantityAlert?: number;
      unitPrice?: number;
      location?: string;
      notes?: string;
    },
    user: UserContext
  ) {
    if (!data.academyId) throw new BadRequestError("academyId is required");
    if (!data.name?.trim()) throw new BadRequestError("Stock item name is required");

    const qty = Math.max(0, Number(data.initialQuantity) || 0);

    const stock = new StockItemModel({
      academyId: new mongoose.Types.ObjectId(data.academyId),
      franchiseId: data.franchiseId ? new mongoose.Types.ObjectId(data.franchiseId) : undefined,
      name: data.name.trim(),
      sku: data.sku?.trim(),
      category: data.category || "Equipment",
      unit: data.unit || "units",
      quantity: qty,
      minQuantityAlert: data.minQuantityAlert ?? 5,
      unitPrice: data.unitPrice ?? 0,
      location: data.location?.trim(),
      notes: data.notes?.trim(),
      lastRestockedAt: qty > 0 ? new Date() : undefined,
      stockLogs:
        qty > 0
          ? [
              {
                action: "initial",
                quantityChange: qty,
                previousQuantity: 0,
                newQuantity: qty,
                reason: "Initial inventory setup",
                performedBy: new mongoose.Types.ObjectId(user.id),
                performedByName: user.name,
                date: new Date(),
              },
            ]
          : [],
    });

    await stock.save();
    return stock;
  }

  async updateStock(
    id: string,
    data: {
      name?: string;
      sku?: string;
      category?: string;
      unit?: string;
      minQuantityAlert?: number;
      unitPrice?: number;
      location?: string;
      notes?: string;
    }
  ) {
    const stock = await StockItemModel.findById(id);
    if (!stock) throw new NotFoundError("Stock item not found");

    if (data.name !== undefined) stock.name = data.name.trim();
    if (data.sku !== undefined) stock.sku = data.sku.trim();
    if (data.category !== undefined) stock.category = data.category;
    if (data.unit !== undefined) stock.unit = data.unit;
    if (data.minQuantityAlert !== undefined) stock.minQuantityAlert = Math.max(0, data.minQuantityAlert);
    if (data.unitPrice !== undefined) stock.unitPrice = Math.max(0, data.unitPrice);
    if (data.location !== undefined) stock.location = data.location.trim();
    if (data.notes !== undefined) stock.notes = data.notes.trim();

    await stock.save();
    return stock;
  }

  async issueStock(
    id: string,
    data: {
      quantity: number;
      reason: string;
      recipient?: string;
      action?: "issued_out" | "used_training" | "damaged";
    },
    user: UserContext
  ) {
    const stock = await StockItemModel.findById(id);
    if (!stock) throw new NotFoundError("Stock item not found");

    const qty = Number(data.quantity);
    if (!qty || qty <= 0) throw new BadRequestError("Issue quantity must be greater than 0");
    if (qty > stock.quantity) {
      throw new BadRequestError(`Cannot issue ${qty} ${stock.unit}. Only ${stock.quantity} in stock.`);
    }

    const prevQty = stock.quantity;
    stock.quantity -= qty;
    stock.stockLogs.push({
      action: data.action || "issued_out",
      quantityChange: -qty,
      previousQuantity: prevQty,
      newQuantity: stock.quantity,
      reason: data.reason || "Issued / Dispatched from inventory",
      recipient: data.recipient?.trim(),
      performedBy: new mongoose.Types.ObjectId(user.id),
      performedByName: user.name,
      date: new Date(),
    });

    await stock.save();
    return stock;
  }

  async adjustStock(
    id: string,
    data: {
      newQuantity: number;
      reason: string;
    },
    user: UserContext
  ) {
    const stock = await StockItemModel.findById(id);
    if (!stock) throw new NotFoundError("Stock item not found");

    const newQty = Math.max(0, Number(data.newQuantity));
    const prevQty = stock.quantity;
    const diff = newQty - prevQty;

    stock.quantity = newQty;
    stock.stockLogs.push({
      action: "audit_adjustment",
      quantityChange: diff,
      previousQuantity: prevQty,
      newQuantity: newQty,
      reason: data.reason || "Manual audit adjustment",
      performedBy: new mongoose.Types.ObjectId(user.id),
      performedByName: user.name,
      date: new Date(),
    });

    await stock.save();
    return stock;
  }

  // ─── INCOME / INFLOW MANAGEMENT ─────────────────────────────────────────────

  async createIncome(
    data: {
      academyId: string;
      franchiseId?: string;
      source: string;
      category?: string;
      amount: number;
      date?: string | Date;
      paymentMethod?: string;
      payerName?: string;
      referenceNumber?: string;
      notes?: string;
    },
    user: UserContext
  ) {
    if (!data.academyId) throw new BadRequestError("academyId is required");
    if (!data.source?.trim()) throw new BadRequestError("Income source is required");
    if (!data.amount || data.amount <= 0) throw new BadRequestError("Amount must be greater than 0");

    const income = new IncomeModel({
      academyId: new mongoose.Types.ObjectId(data.academyId),
      franchiseId: data.franchiseId ? new mongoose.Types.ObjectId(data.franchiseId) : undefined,
      source: data.source.trim(),
      category: data.category || "Other Income",
      amount: data.amount,
      date: data.date ? new Date(data.date) : new Date(),
      paymentMethod: data.paymentMethod || "bank_transfer",
      payerName: data.payerName?.trim(),
      referenceNumber: data.referenceNumber?.trim(),
      notes: data.notes?.trim(),
      createdBy: new mongoose.Types.ObjectId(user.id),
      createdByName: user.name,
    });

    await income.save();
    return income;
  }

  async listIncomes(filters: {
    academyId: string;
    franchiseId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    if (!filters.academyId) throw new BadRequestError("academyId is required");

    const query: any = { academyId: new mongoose.Types.ObjectId(filters.academyId) };
    if (filters.franchiseId && filters.franchiseId !== "all") {
      query.franchiseId = new mongoose.Types.ObjectId(filters.franchiseId);
    }
    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) query.date.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const items = await IncomeModel.find(query)
      .populate("franchiseId", "name franchiseCode")
      .sort({ date: -1 })
      .lean();

    return items;
  }

  async deleteIncome(id: string) {
    await IncomeModel.findByIdAndDelete(id);
    return { success: true };
  }

  // ─── ADVANCED REPORTING & FINANCIAL ANALYTICS ────────────────────────────────

  async getAnalyticsReport(params: {
    academyId: string;
    franchiseId?: string;
    timeframe: "day" | "month" | "year" | "lifetime" | "custom";
    date?: string; // YYYY-MM-DD
    month?: string; // YYYY-MM
    year?: string; // YYYY
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    if (!params.academyId) throw new BadRequestError("academyId is required");

    let start = new Date(0);
    let end = new Date();

    const now = new Date();

    if (params.timeframe === "day") {
      const d = params.date ? new Date(params.date) : now;
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    } else if (params.timeframe === "month") {
      let y = now.getFullYear();
      let m = now.getMonth();
      if (params.month) {
        const parts = params.month.split("-");
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
      }
      start = new Date(y, m, 1, 0, 0, 0, 0);
      end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    } else if (params.timeframe === "year") {
      const y = params.year ? parseInt(params.year, 10) : now.getFullYear();
      start = new Date(y, 0, 1, 0, 0, 0, 0);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
    } else if (params.timeframe === "custom") {
      if (params.startDate) start = new Date(params.startDate);
      if (params.endDate) {
        const e = new Date(params.endDate);
        e.setHours(23, 59, 59, 999);
        end = e;
      }
    }

    const academyObjId = new mongoose.Types.ObjectId(params.academyId);
    const franchiseIds = await this.getQueryFranchiseIds({
      franchiseId: params.franchiseId !== "all" ? params.franchiseId : undefined,
      academyId: params.academyId,
    });

    const franchiseFilter =
      params.franchiseId && params.franchiseId !== "all"
        ? { franchiseId: new mongoose.Types.ObjectId(params.franchiseId) }
        : {};

    // 1. Fetch Expenses in Date Range
    const expensesQuery: any = {
      academyId: academyObjId,
      date: { $gte: start, $lte: end },
      ...franchiseFilter,
    };

    const [allExpenses, allIncomes, fees, stockItems, salaryPayments] = await Promise.all([
      ExpenseModel.find(expensesQuery)
        .populate("franchiseId", "name franchiseCode")
        .sort({ date: -1 })
        .lean(),
      IncomeModel.find({
        academyId: academyObjId,
        date: { $gte: start, $lte: end },
        ...franchiseFilter,
      })
        .populate("franchiseId", "name franchiseCode")
        .sort({ date: -1 })
        .lean(),
      FeeModel.find({
        franchiseId: { $in: franchiseIds },
        "installments.status": { $in: ["paid", "partial"] },
      })
        .populate("studentId", "firstName lastName photo")
        .populate("franchiseId", "name franchiseCode")
        .lean(),
      StockItemModel.find({
        academyId: academyObjId,
        ...franchiseFilter,
      }).lean(),
      SalaryPaymentModel.find({
        academyId: academyObjId,
        status: "paid",
        paidAt: { $gte: start, $lte: end },
      }).lean(),
    ]);

    // 2. Extract Individual Paid Fee Installments in Date Range
    const feeInflows: FeeInflowRecord[] = [];
    let feesInflowTotal = 0;

    fees.forEach((f) => {
      const student = f.studentId as any;
      const studentName = student ? `${student.firstName} ${student.lastName}` : "Student";
      const franchise = f.franchiseId as any;
      const franchiseName = franchise?.name;

      f.installments.forEach((inst) => {
        if (inst.paidAt && inst.paidAmount > 0) {
          const paidDate = new Date(inst.paidAt);
          if (paidDate >= start && paidDate <= end) {
            feesInflowTotal += inst.paidAmount;
            feeInflows.push({
              id: `${f._id}-${inst.installmentNumber}`,
              studentName,
              franchiseName,
              installmentNumber: inst.installmentNumber,
              amount: inst.paidAmount,
              paidAt: paidDate,
              paymentMethod: inst.paymentMethod || "Cash",
              transactionId: inst.transactionId,
              feeType: f.feeType,
            });
          }
        }
      });
    });

    // 3. Calculate Totals
    const otherInflowTotal = allIncomes.reduce((sum, inc) => sum + inc.amount, 0);
    const totalInflow = feesInflowTotal + otherInflowTotal;

    const verifiedPurchases = allExpenses.filter((e) => e.type === "purchase" && e.verificationStatus === "verified");
    const pendingPurchases = allExpenses.filter((e) => e.type === "purchase" && e.verificationStatus === "pending");
    const miscExpenses = allExpenses.filter((e) => e.type === "miscellaneous");

    const purchasesOutflow = verifiedPurchases.reduce((sum, e) => sum + e.amount, 0);
    const miscOutflow = miscExpenses.reduce((sum, e) => sum + e.amount, 0);
    const salariesOutflow = salaryPayments.reduce((sum, s) => sum + s.amount, 0);

    const totalOutflow = purchasesOutflow + miscOutflow + salariesOutflow;
    const netBalance = totalInflow - totalOutflow;
    const profitMargin = totalInflow > 0 ? Math.round(((totalInflow - totalOutflow) / totalInflow) * 100) : 0;

    // 4. Inventory Valuation
    const totalInventoryValue = stockItems.reduce((sum, s) => sum + (s.quantity || 0) * (s.unitPrice || 0), 0);
    const outOfStockCount = stockItems.filter((s) => s.status === "out_of_stock" || s.quantity <= 0).length;
    const lowStockCount = stockItems.filter((s) => s.status === "low_stock").length;

    // 5. Expense Breakdown by Category
    const categoryMap = new Map<string, { amount: number; count: number }>();
    allExpenses.forEach((e) => {
      // only count verified purchases + all misc expenses
      if (e.type === "purchase" && e.verificationStatus !== "verified") return;
      const cat = e.category || "Uncategorized";
      const curr = categoryMap.get(cat) || { amount: 0, count: 0 };
      categoryMap.set(cat, {
        amount: curr.amount + e.amount,
        count: curr.count + 1,
      });
    });

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, { amount, count }]) => ({
        category,
        amount,
        count,
        percentage: totalOutflow > 0 ? Math.round((amount / totalOutflow) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // 6. Time Series Data for Trend Charts
    const timeSeriesMap = new Map<string, { label: string; inflow: number; outflow: number; net: number }>();

    if (params.timeframe === "month") {
      // Day by day of month
      const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const key = `${day.toString().padStart(2, "0")}`;
        timeSeriesMap.set(key, { label: `${key}`, inflow: 0, outflow: 0, net: 0 });
      }

      feeInflows.forEach((item) => {
        const key = item.paidAt.getDate().toString().padStart(2, "0");
        if (timeSeriesMap.has(key)) {
          timeSeriesMap.get(key)!.inflow += item.amount;
        }
      });
      allIncomes.forEach((inc) => {
        const key = new Date(inc.date).getDate().toString().padStart(2, "0");
        if (timeSeriesMap.has(key)) {
          timeSeriesMap.get(key)!.inflow += inc.amount;
        }
      });
      allExpenses.forEach((exp) => {
        if (exp.type === "purchase" && exp.verificationStatus !== "verified") return;
        const key = new Date(exp.date).getDate().toString().padStart(2, "0");
        if (timeSeriesMap.has(key)) {
          timeSeriesMap.get(key)!.outflow += exp.amount;
        }
      });
    } else if (params.timeframe === "year" || params.timeframe === "lifetime") {
      // Month by month
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      monthNames.forEach((name, idx) => {
        const key = idx.toString();
        timeSeriesMap.set(key, { label: name, inflow: 0, outflow: 0, net: 0 });
      });

      feeInflows.forEach((item) => {
        const key = item.paidAt.getMonth().toString();
        if (timeSeriesMap.has(key)) {
          timeSeriesMap.get(key)!.inflow += item.amount;
        }
      });
      allIncomes.forEach((inc) => {
        const key = new Date(inc.date).getMonth().toString();
        if (timeSeriesMap.has(key)) {
          timeSeriesMap.get(key)!.inflow += inc.amount;
        }
      });
      allExpenses.forEach((exp) => {
        if (exp.type === "purchase" && exp.verificationStatus !== "verified") return;
        const key = new Date(exp.date).getMonth().toString();
        if (timeSeriesMap.has(key)) {
          timeSeriesMap.get(key)!.outflow += exp.amount;
        }
      });
    } else {
      // Day view or custom: simple bucket
      timeSeriesMap.set("period", {
        label: "Selected Period",
        inflow: totalInflow,
        outflow: totalOutflow,
        net: netBalance,
      });
    }

    const timeSeries = Array.from(timeSeriesMap.values()).map((t) => ({
      ...t,
      net: t.inflow - t.outflow,
    }));

    return {
      period: {
        timeframe: params.timeframe,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      summary: {
        totalInflow,
        feesInflow: feesInflowTotal,
        otherInflow: otherInflowTotal,
        totalOutflow,
        purchasesOutflow,
        miscOutflow,
        salariesOutflow,
        netBalance,
        profitMargin,
        totalInventoryValue,
        outOfStockCount,
        lowStockCount,
        pendingPurchasesCount: pendingPurchases.length,
        pendingPurchasesAmount: pendingPurchases.reduce((s, p) => s + p.amount, 0),
        totalPurchasesCount: verifiedPurchases.length + pendingPurchases.length,
        totalMiscCount: miscExpenses.length,
      },
      categoryBreakdown,
      timeSeries,
      purchasesVsMisc: {
        purchases: purchasesOutflow,
        misc: miscOutflow,
        purchasesPercent: totalOutflow > 0 ? Math.round((purchasesOutflow / totalOutflow) * 100) : 0,
        miscPercent: totalOutflow > 0 ? Math.round((miscOutflow / totalOutflow) * 100) : 0,
      },
      expenses: allExpenses,
      feeInflows: feeInflows.slice(0, 500),
      otherInflows: allIncomes,
      stockSummary: stockItems.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        sku: s.sku,
        category: s.category,
        quantity: s.quantity,
        unit: s.unit,
        unitPrice: s.unitPrice,
        totalValue: (s.quantity || 0) * (s.unitPrice || 0),
        status: s.status,
      })),
    };
  }
}
