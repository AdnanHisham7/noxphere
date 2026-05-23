// src/store/api/baseApi.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "@/store";

// const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
const BASE_URL = "http://localhost:5000/api/v1";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: [
    "User",
    "Academy",
    "Camp",
    "Student",
    "Team",
    "Attendance",
    "Performance",
    "Fee",
    "Transfer",
    "Notification",
    "Selection",
  ],
  endpoints: () => ({}),
});
