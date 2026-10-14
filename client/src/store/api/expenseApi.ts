// src/store/api/expenseApi.ts
import { baseApi } from "./baseApi";

export interface ExpenseItem {
  id: string;
  _id?: string;
  academyId: string;
  franchiseId?: { _id: string; name: string; franchiseCode: string };
  type: "purchase" | "miscellaneous";
  itemName?: string;
  category: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  stockItemId?: { _id: string; name: string; quantity: number; unit: string };
  verificationStatus?: "pending" | "verified" | "rejected";
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  title?: string;
  miscStatus?: "paid" | "pending";
  amount: number;
  date: string;
  vendor?: string;
  vendorContact?: string;
  invoiceNumber?: string;
  paymentMethod: "cash" | "bank_transfer" | "upi" | "card" | "cheque" | "other";
  receiptUrl?: string;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface StockLog {
  _id?: string;
  action: "purchase_restock" | "issued_out" | "used_training" | "damaged" | "audit_adjustment" | "initial";
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  recipient?: string;
  performedByName: string;
  date: string;
  referenceId?: string;
}

export interface StockItem {
  id: string;
  _id?: string;
  academyId: string;
  franchiseId?: { _id: string; name: string; franchiseCode: string };
  name: string;
  sku?: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantityAlert: number;
  unitPrice: number;
  totalValue: number;
  location?: string;
  status: "in_stock" | "low_stock" | "out_of_stock";
  lastRestockedAt?: string;
  notes?: string;
  stockLogs?: StockLog[];
  createdAt: string;
  updatedAt: string;
}

export interface IncomeRecord {
  id: string;
  _id?: string;
  academyId: string;
  franchiseId?: { _id: string; name: string; franchiseCode: string };
  source: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  payerName?: string;
  referenceNumber?: string;
  notes?: string;
  createdByName: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalInflow: number;
  feesInflow: number;
  otherInflow: number;
  totalOutflow: number;
  purchasesOutflow: number;
  miscOutflow: number;
  salariesOutflow: number;
  netBalance: number;
  profitMargin: number;
  totalInventoryValue: number;
  outOfStockCount: number;
  lowStockCount: number;
  pendingPurchasesCount: number;
  pendingPurchasesAmount: number;
  totalPurchasesCount: number;
  totalMiscCount: number;
}

export interface AnalyticsReport {
  period: {
    timeframe: "day" | "month" | "year" | "lifetime" | "custom";
    startDate: string;
    endDate: string;
  };
  summary: AnalyticsSummary;
  categoryBreakdown: {
    category: string;
    amount: number;
    count: number;
    percentage: number;
  }[];
  timeSeries: {
    label: string;
    inflow: number;
    outflow: number;
    net: number;
  }[];
  purchasesVsMisc: {
    purchases: number;
    misc: number;
    purchasesPercent: number;
    miscPercent: number;
  };
  expenses: ExpenseItem[];
  feeInflows: {
    id: string;
    studentName: string;
    franchiseName?: string;
    installmentNumber: number;
    amount: number;
    paidAt: string;
    paymentMethod?: string;
    transactionId?: string;
    feeType: string;
  }[];
  otherInflows: IncomeRecord[];
  stockSummary: {
    id: string;
    name: string;
    sku?: string;
    category: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalValue: number;
    status: "in_stock" | "low_stock" | "out_of_stock";
  }[];
}

export interface ListExpensesResponse {
  expenses: ExpenseItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  stats: {
    totalAmount: number;
    purchasesAmount: number;
    verifiedPurchasesAmount: number;
    miscAmount: number;
    pendingPurchasesCount: number;
  };
}

export interface ListStocksResponse {
  items: StockItem[];
  summary: {
    totalItems: number;
    inStockCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalInventoryValuation: number;
  };
}

export const expenseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── EXPENSES ─────────────────────────────────────────────────────────────
    listExpenses: builder.query<
      ListExpensesResponse,
      {
        academyId?: string;
        franchiseId?: string;
        type?: string;
        verificationStatus?: string;
        category?: string;
        startDate?: string;
        endDate?: string;
        search?: string;
        page?: number;
        limit?: number;
      }
    >({
      query: (params) => ({
        url: "/expenses",
        params,
      }),
      transformResponse: (res: { data: ListExpensesResponse }) => res.data,
      providesTags: ["Expense"],
    }),

    getExpenseById: builder.query<ExpenseItem, string>({
      query: (id) => `/expenses/${id}`,
      transformResponse: (res: { data: ExpenseItem }) => res.data,
      providesTags: (_res, _err, id) => [{ type: "Expense", id }],
    }),

    createExpense: builder.mutation<
      ExpenseItem,
      {
        academyId?: string;
        franchiseId?: string;
        type: "purchase" | "miscellaneous";
        itemName?: string;
        category: string;
        quantity?: number;
        unit?: string;
        unitPrice?: number;
        stockItemId?: string;
        verifyImmediately?: boolean;
        title?: string;
        amount?: number;
        date?: string;
        vendor?: string;
        vendorContact?: string;
        invoiceNumber?: string;
        paymentMethod?: string;
        notes?: string;
        receiptUrl?: string;
      }
    >({
      query: (body) => ({
        url: "/expenses",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: ExpenseItem }) => res.data,
      invalidatesTags: ["Expense", "StockItem", "Dashboard"],
    }),

    updateExpense: builder.mutation<ExpenseItem, { id: string; body: Partial<ExpenseItem> }>({
      query: ({ id, body }) => ({
        url: `/expenses/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: { data: ExpenseItem }) => res.data,
      invalidatesTags: ["Expense", "StockItem"],
    }),

    deleteExpense: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/expenses/${id}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: { success: boolean; message: string } }) => res.data,
      invalidatesTags: ["Expense", "StockItem", "Dashboard"],
    }),

    verifyPurchase: builder.mutation<ExpenseItem, string>({
      query: (id) => ({
        url: `/expenses/${id}/verify`,
        method: "POST",
      }),
      transformResponse: (res: { data: ExpenseItem }) => res.data,
      invalidatesTags: ["Expense", "StockItem", "Dashboard"],
    }),

    rejectPurchase: builder.mutation<ExpenseItem, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/expenses/${id}/reject`,
        method: "POST",
        body: { reason },
      }),
      transformResponse: (res: { data: ExpenseItem }) => res.data,
      invalidatesTags: ["Expense"],
    }),

    // ─── STOCKS ───────────────────────────────────────────────────────────────
    listStocks: builder.query<
      ListStocksResponse,
      {
        academyId?: string;
        franchiseId?: string;
        status?: string;
        category?: string;
        search?: string;
      }
    >({
      query: (params) => ({
        url: "/expenses/stocks",
        params,
      }),
      transformResponse: (res: { data: ListStocksResponse }) => res.data,
      providesTags: ["StockItem"],
    }),

    getStockById: builder.query<StockItem, string>({
      query: (id) => `/expenses/stocks/${id}`,
      transformResponse: (res: { data: StockItem }) => res.data,
      providesTags: (_res, _err, id) => [{ type: "StockItem", id }],
    }),

    createStock: builder.mutation<
      StockItem,
      {
        academyId?: string;
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
      }
    >({
      query: (body) => ({
        url: "/expenses/stocks",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: StockItem }) => res.data,
      invalidatesTags: ["StockItem"],
    }),

    updateStock: builder.mutation<
      StockItem,
      {
        id: string;
        body: {
          name?: string;
          sku?: string;
          category?: string;
          unit?: string;
          minQuantityAlert?: number;
          unitPrice?: number;
          location?: string;
          notes?: string;
        };
      }
    >({
      query: ({ id, body }) => ({
        url: `/expenses/stocks/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: { data: StockItem }) => res.data,
      invalidatesTags: ["StockItem"],
    }),

    issueStock: builder.mutation<
      StockItem,
      {
        id: string;
        quantity: number;
        reason: string;
        recipient?: string;
        action?: "issued_out" | "used_training" | "damaged";
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/expenses/stocks/${id}/issue`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: StockItem }) => res.data,
      invalidatesTags: ["StockItem"],
    }),

    adjustStock: builder.mutation<
      StockItem,
      {
        id: string;
        newQuantity: number;
        reason: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/expenses/stocks/${id}/adjust`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: StockItem }) => res.data,
      invalidatesTags: ["StockItem"],
    }),

    // ─── INCOMES ──────────────────────────────────────────────────────────────
    listIncomes: builder.query<
      IncomeRecord[],
      {
        academyId?: string;
        franchiseId?: string;
        startDate?: string;
        endDate?: string;
      }
    >({
      query: (params) => ({
        url: "/expenses/incomes",
        params,
      }),
      transformResponse: (res: { data: IncomeRecord[] }) => res.data,
      providesTags: ["Income"],
    }),

    createIncome: builder.mutation<
      IncomeRecord,
      {
        academyId?: string;
        franchiseId?: string;
        source: string;
        category?: string;
        amount: number;
        date?: string;
        paymentMethod?: string;
        payerName?: string;
        referenceNumber?: string;
        notes?: string;
      }
    >({
      query: (body) => ({
        url: "/expenses/incomes",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: IncomeRecord }) => res.data,
      invalidatesTags: ["Income", "Dashboard"],
    }),

    deleteIncome: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/expenses/incomes/${id}`,
        method: "DELETE",
      }),
      transformResponse: (res: { data: { success: boolean } }) => res.data,
      invalidatesTags: ["Income", "Dashboard"],
    }),

    // ─── ADVANCED REPORT & ANALYTICS ──────────────────────────────────────────
    getAnalyticsReport: builder.query<
      AnalyticsReport,
      {
        academyId?: string;
        franchiseId?: string;
        timeframe: "day" | "month" | "year" | "lifetime" | "custom";
        date?: string;
        month?: string;
        year?: string;
        startDate?: string;
        endDate?: string;
      }
    >({
      query: (params) => ({
        url: "/expenses/analytics/report",
        params,
      }),
      transformResponse: (res: { data: AnalyticsReport }) => res.data,
      providesTags: ["Expense", "StockItem", "Income", "Fee"],
    }),
  }),
});

export const {
  useListExpensesQuery,
  useGetExpenseByIdQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useVerifyPurchaseMutation,
  useRejectPurchaseMutation,
  useListStocksQuery,
  useGetStockByIdQuery,
  useCreateStockMutation,
  useUpdateStockMutation,
  useIssueStockMutation,
  useAdjustStockMutation,
  useListIncomesQuery,
  useCreateIncomeMutation,
  useDeleteIncomeMutation,
  useGetAnalyticsReportQuery,
} = expenseApi;
