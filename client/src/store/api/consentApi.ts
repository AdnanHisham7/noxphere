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
    togglePublicProfile: builder.mutation<void, { studentId: string; enabled: boolean }>({
      query: ({ studentId, enabled }) => ({
        url: `/consent/${studentId}/public-profile`,
        method: "POST",
        body: { enabled },
      }),
      invalidatesTags: ["Consent", "Student"],
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
  useTogglePublicProfileMutation,
  useGetFranchiseConsentStatusQuery,
} = consentApi;