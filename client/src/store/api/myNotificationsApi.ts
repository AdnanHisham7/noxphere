// src/store/api/myNotificationsApi.ts
import { baseApi } from "./baseApi";

export interface MyNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface MyNotificationListResult {
  items: MyNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const myNotificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyNotifications: builder.query<MyNotificationListResult, { page?: number; limit?: number } | void>({
      query: (params) => ({ url: "/notifications/me", params: params ?? {} }),
      transformResponse: (res: { data: MyNotificationListResult }) => res.data,
      providesTags: ["Notification"],
    }),
    markMyNotificationRead: builder.mutation<MyNotification, string>({
      query: (id) => ({ url: `/notifications/me/${id}/read`, method: "PATCH" }),
      transformResponse: (res: { data: MyNotification }) => res.data,
      invalidatesTags: ["Notification"],
    }),
    markAllMyNotificationsRead: builder.mutation<{ updated: number }, void>({
      query: () => ({ url: "/notifications/me/read-all", method: "PATCH" }),
      transformResponse: (res: { data: { updated: number } }) => res.data,
      invalidatesTags: ["Notification"],
    }),
  }),
});

export const {
  useGetMyNotificationsQuery,
  useMarkMyNotificationReadMutation,
  useMarkAllMyNotificationsReadMutation,
} = myNotificationsApi;