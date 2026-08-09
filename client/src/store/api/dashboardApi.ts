// src/store/api/dashboardApi.ts
import { baseApi } from "./baseApi";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface FranchisePerformanceDetail {
  id: string;
  name: string;
  code: string;
  location?: string;
  totalPlayers: number;
  totalTeams: number;
  totalSessions: number;
  feesCollected: number;
  feesOutstanding: number;
  isActive: boolean;
}

export interface DashboardStats {
  totalStudents: number;
  pendingEnrollment: number;
  avgAttendance: number;
  avgRating: number;
  feesCollected: number;
  feesOutstanding: number;
  totalCoaches?: number;
  totalTeams?: number;
  totalSessions?: number;
  franchisePerformance?: FranchisePerformanceDetail[];
  totalAcademies?: number;
  totalFranchises?: number;
}

export interface AttendanceTrendPoint {
  date: string;
  day: string;
  rate: number;
}

export interface SkillRadarPoint {
  skill: string;
  avg: number;
}

export interface TeamHealth {
  name: string;
  attendance: number;
  performance: number;
  students: number;
  coach: string;
}

export interface TopPerformer {
  id: string;
  name: string;
  rating: number;
  team: string;
  position: string;
  avatar?: string;
}

export interface ActivityEvent {
  id: string;
  type: "attendance" | "performance" | "fee";
  message: string;
  time: string;
  icon: string;
}

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<DashboardStats, { franchiseId?: string; academyId?: string }>({
      query: (params) => ({ url: "/dashboard/stats", params }),
      transformResponse: (res: ApiResponse<DashboardStats>) => res.data,
      providesTags: ["Dashboard"],
    }),
    getAttendanceTrend: builder.query<AttendanceTrendPoint[], { franchiseId?: string; academyId?: string; days?: number }>({
      query: (params) => ({ url: "/dashboard/attendance-trend", params }),
      transformResponse: (res: ApiResponse<AttendanceTrendPoint[]>) => res.data,
      providesTags: ["Dashboard"],
    }),
    getSkillRadar: builder.query<SkillRadarPoint[], { franchiseId?: string; academyId?: string }>({
      query: (params) => ({ url: "/dashboard/skill-radar", params }),
      transformResponse: (res: ApiResponse<SkillRadarPoint[]>) => res.data,
      providesTags: ["Dashboard"],
    }),
    getTeamHealth: builder.query<TeamHealth[], { franchiseId?: string; academyId?: string }>({
      query: (params) => ({ url: "/dashboard/team-health", params }),
      transformResponse: (res: ApiResponse<TeamHealth[]>) => res.data,
      providesTags: ["Dashboard"],
    }),
    getTopPerformers: builder.query<TopPerformer[], { franchiseId?: string; academyId?: string; limit?: number }>({
      query: (params) => ({ url: "/dashboard/top-performers", params }),
      transformResponse: (res: ApiResponse<TopPerformer[]>) => res.data,
      providesTags: ["Dashboard"],
    }),
    getRecentActivity: builder.query<ActivityEvent[], { franchiseId?: string; academyId?: string; limit?: number }>({
      query: (params) => ({ url: "/dashboard/recent-activity", params }),
      transformResponse: (res: ApiResponse<ActivityEvent[]>) => res.data,
      providesTags: ["Dashboard"],
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useGetAttendanceTrendQuery,
  useGetSkillRadarQuery,
  useGetTeamHealthQuery,
  useGetTopPerformersQuery,
  useGetRecentActivityQuery,
} = dashboardApi;