// src/store/api/nfcCardApi.ts
import { baseApi } from "./baseApi";

export type NfcRequesterRole = "student" | "manager";
export type NfcRequesterType = "independent_player" | "academy";
export type NfcCardType = "official" | "custom";
export type NfcRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paid"
  | "dispatched"
  | "delivered";

export interface NfcStudentItem {
  studentId: string;
  studentName: string;
  jerseyNumber?: number;
  photo?: string;
  franchiseName?: string;
  ageGroup?: string;
  publicProfileToken?: string;
}

export interface NfcShippingAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface NfcDispatchDetails {
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  dispatchedAt?: string;
}

export interface NfcCardRequest {
  id: string;
  requesterId: {
    _id?: string;
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
  requesterRole: NfcRequesterRole;
  requesterType: NfcRequesterType;
  academyId?: {
    _id?: string;
    id?: string;
    name: string;
    code?: string;
    logo?: string;
  };
  franchiseId?: string;
  cardType: NfcCardType;
  customDesignUrl?: string;
  customDesignFileName?: string;
  students: NfcStudentItem[];
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  shippingAddress: NfcShippingAddress;
  status: NfcRequestStatus;
  rejectionReason?: string;
  adminNotes?: string;
  dispatchDetails?: NfcDispatchDetails;
  deliveredAt?: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NfcPricing {
  cardPrice: number;
  customCardPrice: number;
}

export interface ListNfcRequestsResponse {
  requests: NfcCardRequest[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreatePlayerNfcRequestPayload {
  shippingAddress: NfcShippingAddress;
}

export interface CreateAcademyNfcRequestPayload {
  academyId?: string;
  studentIds: string[];
  cardType: NfcCardType;
  customDesignUrl?: string;
  customDesignFileName?: string;
  shippingAddress: NfcShippingAddress;
}

export interface UpdateNfcFulfillmentPayload {
  requestId: string;
  status: "paid" | "dispatched" | "delivered";
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

const normalizeRequest = (raw: any): NfcCardRequest => {
  if (!raw) return raw;
  return {
    ...raw,
    id: String(raw.id || raw._id || ""),
  };
};

export const nfcCardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNfcPricing: builder.query<NfcPricing, void>({
      query: () => "/nfc/pricing",
      transformResponse: (res: { data: NfcPricing }) => res.data,
      providesTags: ["PlatformSettings"],
    }),

    updateNfcPricing: builder.mutation<NfcPricing, NfcPricing>({
      query: (body) => ({
        url: "/nfc/pricing",
        method: "PUT",
        body,
      }),
      transformResponse: (res: { data: NfcPricing }) => res.data,
      invalidatesTags: ["PlatformSettings", "NfcRequest"],
    }),

    listNfcRequests: builder.query<
      ListNfcRequestsResponse,
      { status?: string; requesterType?: string; search?: string; page?: number; limit?: number } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.status && params.status !== "all") queryParams.set("status", params.status);
        if (params?.requesterType && params.requesterType !== "all")
          queryParams.set("requesterType", params.requesterType);
        if (params?.search) queryParams.set("search", params.search);
        if (params?.page) queryParams.set("page", String(params.page));
        if (params?.limit) queryParams.set("limit", String(params.limit));
        const qs = queryParams.toString();
        return `/nfc/requests${qs ? `?${qs}` : ""}`;
      },
      transformResponse: (res: { data: ListNfcRequestsResponse }) => {
        const raw = res?.data;
        return {
          ...raw,
          requests: (raw?.requests || []).map(normalizeRequest),
          total: raw?.total || 0,
          page: raw?.page || 1,
          totalPages: raw?.totalPages || 1,
        };
      },
      providesTags: ["NfcRequest"],
    }),

    getNfcRequestById: builder.query<NfcCardRequest, string>({
      query: (id) => `/nfc/requests/${id}`,
      transformResponse: (res: { data: any }) => normalizeRequest(res?.data),
      providesTags: ["NfcRequest"],
    }),

    createPlayerNfcRequest: builder.mutation<NfcCardRequest, CreatePlayerNfcRequestPayload>({
      query: (body) => ({
        url: "/nfc/requests/player",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: any }) => normalizeRequest(res?.data),
      invalidatesTags: ["NfcRequest"],
    }),

    createAcademyNfcRequest: builder.mutation<NfcCardRequest, CreateAcademyNfcRequestPayload>({
      query: (body) => ({
        url: "/nfc/requests/academy",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: any }) => normalizeRequest(res?.data),
      invalidatesTags: ["NfcRequest"],
    }),

    approveNfcRequest: builder.mutation<NfcCardRequest, { requestId: string; unitPrice?: number }>({
      query: ({ requestId, unitPrice }) => ({
        url: `/nfc/requests/${requestId}/approve`,
        method: "POST",
        body: { unitPrice },
      }),
      transformResponse: (res: { data: any }) => normalizeRequest(res?.data),
      invalidatesTags: ["NfcRequest"],
    }),

    rejectNfcRequest: builder.mutation<NfcCardRequest, { requestId: string; reason: string }>({
      query: ({ requestId, reason }) => ({
        url: `/nfc/requests/${requestId}/reject`,
        method: "POST",
        body: { reason },
      }),
      transformResponse: (res: { data: any }) => normalizeRequest(res?.data),
      invalidatesTags: ["NfcRequest"],
    }),

    updateNfcFulfillment: builder.mutation<NfcCardRequest, UpdateNfcFulfillmentPayload>({
      query: ({ requestId, ...body }) => ({
        url: `/nfc/requests/${requestId}/fulfillment`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: any }) => normalizeRequest(res?.data),
      invalidatesTags: ["NfcRequest"],
    }),

    createNfcCheckoutSession: builder.mutation<{ url: string }, string>({
      query: (requestId) => ({
        url: `/nfc/requests/${requestId}/checkout-session`,
        method: "POST",
      }),
      transformResponse: (res: { data: { url: string } }) => res.data,
    }),

    verifyNfcCheckoutSession: builder.mutation<
      { paid: boolean; request: NfcCardRequest },
      { sessionId: string } | string
    >({
      query: (arg) => {
        const sessionId = typeof arg === "string" ? arg : arg.sessionId;
        return {
          url: "/nfc/verify-session",
          method: "POST",
          body: { sessionId },
        };
      },
      transformResponse: (res: { data: { paid: boolean; request: any } }) => ({
        paid: res?.data?.paid,
        request: normalizeRequest(res?.data?.request),
      }),
      invalidatesTags: ["NfcRequest"],
    }),
  }),
});

export const {
  useGetNfcPricingQuery,
  useUpdateNfcPricingMutation,
  useListNfcRequestsQuery,
  useGetNfcRequestByIdQuery,
  useCreatePlayerNfcRequestMutation,
  useCreateAcademyNfcRequestMutation,
  useApproveNfcRequestMutation,
  useRejectNfcRequestMutation,
  useUpdateNfcFulfillmentMutation,
  useCreateNfcCheckoutSessionMutation,
  useVerifyNfcCheckoutSessionMutation,
} = nfcCardApi;
