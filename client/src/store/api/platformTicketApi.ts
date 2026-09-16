// src/store/api/platformTicketApi.ts
import { baseApi } from "./baseApi";

export type TicketCategory =
  | "bug_technical"
  | "billing_subscription"
  | "feature_request"
  | "account_access"
  | "other";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface TicketMessage {
  id: string;
  senderId: string;
  senderRole: "manager" | "super_admin";
  senderName: string;
  message: string;
  createdAt: string;
}

export interface PlatformTicket {
  id: string;
  ticketNumber: string;
  academyId: string;
  academyName: string;
  raisedBy: string;
  raisedByName: string;
  raisedByEmail: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string;
  status: TicketStatus;
  messages: TicketMessage[];
  lastRepliedAt?: string;
  lastRepliedBy?: string;
  lastRepliedRole?: "manager" | "super_admin";
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlatformTicketPayload {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string;
}

export interface ReplyPlatformTicketPayload {
  ticketId: string;
  message: string;
  status?: TicketStatus;
}

export interface UpdatePlatformTicketStatusPayload {
  ticketId: string;
  status: TicketStatus;
}

export interface ListTicketsFilter {
  status?: string;
  priority?: string;
  category?: string;
  academyId?: string;
  search?: string;
}

export const platformTicketApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createPlatformTicket: builder.mutation<PlatformTicket, CreatePlatformTicketPayload>({
      query: (body) => ({
        url: "/platform-tickets",
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: PlatformTicket }) => res.data,
      invalidatesTags: ["PlatformTicket"],
    }),

    listMyPlatformTickets: builder.query<PlatformTicket[], { status?: string } | void>({
      query: (params) => ({
        url: "/platform-tickets/mine",
        params: params?.status ? { status: params.status } : {},
      }),
      transformResponse: (res: { data: PlatformTicket[] }) => res.data,
      providesTags: ["PlatformTicket"],
    }),

    listAllPlatformTickets: builder.query<PlatformTicket[], ListTicketsFilter | void>({
      query: (params) => ({
        url: "/platform-tickets",
        params: params || {},
      }),
      transformResponse: (res: { data: PlatformTicket[] }) => res.data,
      providesTags: ["PlatformTicket"],
    }),

    getPlatformTicket: builder.query<PlatformTicket, string>({
      query: (id) => `/platform-tickets/${id}`,
      transformResponse: (res: { data: PlatformTicket }) => res.data,
      providesTags: ["PlatformTicket"],
    }),

    replyPlatformTicket: builder.mutation<PlatformTicket, ReplyPlatformTicketPayload>({
      query: ({ ticketId, ...body }) => ({
        url: `/platform-tickets/${ticketId}/reply`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: PlatformTicket }) => res.data,
      invalidatesTags: ["PlatformTicket"],
    }),

    updatePlatformTicketStatus: builder.mutation<PlatformTicket, UpdatePlatformTicketStatusPayload>({
      query: ({ ticketId, ...body }) => ({
        url: `/platform-tickets/${ticketId}/status`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res: { data: PlatformTicket }) => res.data,
      invalidatesTags: ["PlatformTicket"],
    }),
  }),
});

export const {
  useCreatePlatformTicketMutation,
  useListMyPlatformTicketsQuery,
  useListAllPlatformTicketsQuery,
  useGetPlatformTicketQuery,
  useReplyPlatformTicketMutation,
  useUpdatePlatformTicketStatusMutation,
} = platformTicketApi;
