// src/store/api/academySubscriptionApi.ts
import { baseApi } from "./baseApi";

export type SubscriptionStatus = "incomplete" | "active" | "past_due" | "canceled" | "unpaid" | null;
export type BillingInterval = "month" | "year";

export interface AcademySubscriptionStatus {
  hasSubscription: boolean;
  status: SubscriptionStatus;
  billingInterval: BillingInterval | null;
  provisionedCapacity: number;
  provisionedStaffCapacity: number;
  currentPeriodEnd: string | null;
  ratePerStudentPerDay: number;
  staffRatePerStaffPerMonth: number;
  currentDefaultRate: number;
  currentDefaultStaffRate: number;
  activeStudentCount: number;
  activeStaffCount: number;
  pendingInvitationCount?: number;
  remainingInviteSlots?: number;
  isActive: boolean;
}

export const academySubscriptionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAcademySubscriptionStatus: builder.query<AcademySubscriptionStatus, string>({
      query: (academyId) => `/academy-subscriptions/${academyId}/status`,
      transformResponse: (res: { data: AcademySubscriptionStatus }) => res.data,
      providesTags: ["Academy"],
    }),
    createSubscriptionCheckout: builder.mutation<
      { url: string },
      { academyId: string; capacity: number; staffCapacity: number; billingInterval: BillingInterval }
    >({
      query: ({ academyId, ...body }) => ({
        url: `/academy-subscriptions/${academyId}/checkout`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: { url: string } }) => res.data,
    }),
    upgradeSubscriptionCapacity: builder.mutation<
      { provisionedCapacity: number; provisionedStaffCapacity: number },
      { academyId: string; capacity: number; staffCapacity: number }
    >({
      query: ({ academyId, capacity, staffCapacity }) => ({
        url: `/academy-subscriptions/${academyId}/upgrade`,
        method: "POST",
        body: { capacity, staffCapacity },
      }),
      transformResponse: (res: { data: { provisionedCapacity: number; provisionedStaffCapacity: number } }) => res.data,
      invalidatesTags: ["Academy"],
    }),
    getPlatformDefaultRate: builder.query<number, void>({
      query: () => "/academy-subscriptions/platform-rate",
      transformResponse: (res: { data: { rate: number } }) => res.data.rate,
      providesTags: ["Academy"],
    }),
    setPlatformDefaultRate: builder.mutation<number, number>({
      query: (rate) => ({ url: "/academy-subscriptions/platform-rate", method: "PUT", body: { rate } }),
      transformResponse: (res: { data: { rate: number } }) => res.data.rate,
      invalidatesTags: ["Academy"],
    }),
    getPlatformDefaultStaffRate: builder.query<number, void>({
      query: () => "/academy-subscriptions/platform-staff-rate",
      transformResponse: (res: { data: { rate: number } }) => res.data.rate,
      providesTags: ["Academy"],
    }),
    setPlatformDefaultStaffRate: builder.mutation<number, number>({
      query: (rate) => ({ url: "/academy-subscriptions/platform-staff-rate", method: "PUT", body: { rate } }),
      transformResponse: (res: { data: { rate: number } }) => res.data.rate,
      invalidatesTags: ["Academy"],
    }),
    getAcademyBillingDetails: builder.query<AcademyBillingDetails, string>({
      query: (academyId) => `/academy-subscriptions/${academyId}/billing-details`,
      transformResponse: (res: { data: AcademyBillingDetails }) => res.data,
      providesTags: ["Academy"],
    }),
    verifySubscriptionSession: builder.mutation<
      { status: string; isActive: boolean },
      { sessionId: string; academyId?: string }
    >({
      query: (body) => ({
        url: "/academy-subscriptions/verify-session",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: { status: string; isActive: boolean } }) => res.data,
      invalidatesTags: ["Academy"],
    }),
  }),
});

export interface BillingAlert {
  type: "warning" | "danger" | "info";
  title: string;
  message: string;
}

export interface BillingTransaction {
  id: string;
  number: string | null;
  amountPaid: number;
  amountDue: number;
  status: string | null;
  created: string;
  invoicePdf: string | null;
  hostedInvoiceUrl: string | null;
}

export interface AcademyBillingDetails {
  hasSubscription: boolean;
  status: SubscriptionStatus;
  isActive: boolean;
  billingInterval: BillingInterval;
  currentPeriodEnd: string | null;
  daysRemainingInCycle: number;
  provisionedCapacity: number;
  activeStudentCount: number;
  studentUtilization: number;
  remainingStudentSlots: number;
  pendingInvitationCount?: number;
  remainingInviteSlots?: number;
  provisionedStaffCapacity: number;
  activeStaffCount: number;
  staffUtilization: number;
  remainingStaffSlots: number;
  ratePerStudentPerDay: number;
  staffRatePerStaffPerMonth: number;
  estimatedRenewalRupees: number;
  alerts: BillingAlert[];
  transactions: BillingTransaction[];
}

export const {
  useGetAcademySubscriptionStatusQuery,
  useGetAcademyBillingDetailsQuery,
  useCreateSubscriptionCheckoutMutation,
  useUpgradeSubscriptionCapacityMutation,
  useGetPlatformDefaultRateQuery,
  useSetPlatformDefaultRateMutation,
  useGetPlatformDefaultStaffRateQuery,
  useSetPlatformDefaultStaffRateMutation,
  useVerifySubscriptionSessionMutation,
} = academySubscriptionApi;