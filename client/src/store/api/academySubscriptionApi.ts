// src/store/api/academySubscriptionApi.ts
import { baseApi } from "./baseApi";

export type SubscriptionStatus = "incomplete" | "active" | "past_due" | "canceled" | "unpaid" | null;
export type BillingInterval = "month" | "year";

export interface AcademySubscriptionStatus {
  hasSubscription: boolean;
  status: SubscriptionStatus;
  billingInterval: BillingInterval | null;
  provisionedCapacity: number;
  currentPeriodEnd: string | null;
  ratePerStudentPerDay: number;
  currentDefaultRate: number;
  activeStudentCount: number;
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
      { academyId: string; capacity: number; billingInterval: BillingInterval }
    >({
      query: ({ academyId, ...body }) => ({
        url: `/academy-subscriptions/${academyId}/checkout`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: { url: string } }) => res.data,
    }),
    upgradeSubscriptionCapacity: builder.mutation<
      { provisionedCapacity: number },
      { academyId: string; capacity: number }
    >({
      query: ({ academyId, capacity }) => ({
        url: `/academy-subscriptions/${academyId}/upgrade`,
        method: "POST",
        body: { capacity },
      }),
      transformResponse: (res: { data: { provisionedCapacity: number } }) => res.data,
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
  }),
});

export const {
  useGetAcademySubscriptionStatusQuery,
  useCreateSubscriptionCheckoutMutation,
  useUpgradeSubscriptionCapacityMutation,
  useGetPlatformDefaultRateQuery,
  useSetPlatformDefaultRateMutation,
} = academySubscriptionApi;