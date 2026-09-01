// src/store/api/consentApi.ts
import { baseApi } from "./baseApi";

export interface ConsentNotice {
  version: string;
  dataCategories: string[];
  purposes: string[];
}

export interface GuardianConsentStatus {
  studentId: string;
  studentName: string;
  hasActiveConsent: boolean;
  noticeVersion: string | null;
  grantedAt: string | null;
  withdrawnAt: string | null;
}

export const consentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getConsentNotice: builder.query<ConsentNotice, void>({
      query: () => "/consent/notice",
      transformResponse: (res: { data: ConsentNotice }) => res.data,
    }),
    getMyConsentStatus: builder.query<GuardianConsentStatus[], void>({
      query: () => "/consent/me",
      transformResponse: (res: { data: GuardianConsentStatus[] }) => res.data,
      providesTags: ["Consent"],
    }),
    grantConsent: builder.mutation<void, string>({
      query: (studentId) => ({ url: `/consent/${studentId}/grant`, method: "POST" }),
      invalidatesTags: ["Consent"],
    }),
    withdrawConsent: builder.mutation<void, { studentId: string; reason?: string }>({
      query: ({ studentId, reason }) => ({
        url: `/consent/${studentId}/withdraw`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: ["Consent"],
    }),
    getFranchiseConsentStatus: builder.query<Record<string, boolean>, string>({
      query: (franchiseId) => ({ url: "/consent/franchise-status", params: { franchiseId } }),
      transformResponse: (res: { data: Record<string, boolean> }) => res.data,
      providesTags: ["Consent"],
    }),
  }),
});

export const {
  useGetConsentNoticeQuery,
  useGetMyConsentStatusQuery,
  useGrantConsentMutation,
  useWithdrawConsentMutation,
  useGetFranchiseConsentStatusQuery,
} = consentApi;