// src/store/api/financeApi.ts
import { baseApi } from "./baseApi";

export interface FinanceOverview {
  totalPlatformRevenue?: number;
  subscriptionRevenue: number;
  nfcRevenue?: number;
  activeSubscriptionsCount?: number;
  nfcOrdersCount?: number;
  nfcCardsCount?: number;

  // Academy-internal student fees
  academyFeesTotal?: number;
  academyFeesCollected?: number;
  academyFeesOutstanding?: number;
  academyFeesOverdueCount?: number;
  academyFeesOverdueAmount?: number;

  // Standard properties
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  studentFeeRevenue?: number;
  overdueCount: number;
  overdueAmount: number;
  collectionRate: number;
  totalInvoices: number;
}

export interface MonthlyRevenue {
  month: string;
  platformRevenue?: number;
  subscriptionRevenue?: number;
  nfcRevenue?: number;
  academyFees?: number;
  revenue: number;
  collected: number;
}

export interface AcademyRevenue {
  academyId: string;
  academyName: string;
  revenue: number;
  platformRevenue?: number;
  subscriptionRevenue?: number;
  nfcRevenue?: number;
  academyFeesCollected?: number;
  collected: number;
  outstanding: number;
  studentCount: number;
}

export interface OverdueInvoice {
  id: string;
  student: string;
  totalAmount: number;
  outstanding: number;
  overallStatus: string;
}

export interface Transaction {
  feeId: string;
  type?: "student_fee" | "academy_subscription" | "nfc_card_order";
  student: string;
  academyName?: string;
  billingInterval?: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  paidAt: string;
  method?: string;
  transactionId?: string;
}

export const financeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFinanceOverview: builder.query<FinanceOverview, { from?: string; to?: string; academyId?: string } | void>({
      query: (params) => ({ url: "/finance/overview", params: params ?? {} }),
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: ["Finance"],
    }),
    getRevenueByMonth: builder.query<MonthlyRevenue[], { academyId?: string; months?: number } | void>({
      query: (params) => ({ url: "/finance/revenue-by-month", params: params ?? {} }),
      transformResponse: (res: any) => (Array.isArray(res) ? res : res?.data ?? []),
      providesTags: ["Finance"],
    }),
    getRevenueByAcademy: builder.query<AcademyRevenue[], void>({
      query: () => "/finance/revenue-by-academy",
      transformResponse: (res: any) => (Array.isArray(res) ? res : res?.data ?? []),
      providesTags: ["Finance"],
    }),
    getOverdueInvoices: builder.query<
      { data: OverdueInvoice[]; total: number; page: number; limit: number; totalPages: number },
      { academyId?: string; page?: number; limit?: number } | void
    >({
      query: (params) => ({ url: "/finance/overdue", params: params ?? {} }),
      transformResponse: (res: any) => ({
        data: Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [],
        total: res?.meta?.total ?? res?.total ?? (Array.isArray(res?.data) ? res.data.length : 0),
        page: res?.meta?.page ?? res?.page ?? 1,
        limit: res?.meta?.limit ?? res?.limit ?? 20,
        totalPages: res?.meta?.totalPages ?? res?.totalPages ?? 1,
      }),
      providesTags: ["Finance"],
    }),
    getRecentTransactions: builder.query<Transaction[], { academyId?: string; limit?: number } | void>({
      query: (params) => ({ url: "/finance/transactions", params: params ?? {} }),
      transformResponse: (res: any) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []),
      providesTags: ["Finance"],
    }),
  }),
});

export const {
  useGetFinanceOverviewQuery,
  useGetRevenueByMonthQuery,
  useGetRevenueByAcademyQuery,
  useGetOverdueInvoicesQuery,
  useGetRecentTransactionsQuery,
} = financeApi;
