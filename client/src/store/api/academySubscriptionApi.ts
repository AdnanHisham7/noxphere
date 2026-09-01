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
  }),
});

export const {
  useGetAcademySubscriptionStatusQuery,
  useCreateSubscriptionCheckoutMutation,
  useUpgradeSubscriptionCapacityMutation,
  useGetPlatformDefaultRateQuery,
  useSetPlatformDefaultRateMutation,
  useGetPlatformDefaultStaffRateQuery,
  useSetPlatformDefaultStaffRateMutation,
} = academySubscriptionApi;