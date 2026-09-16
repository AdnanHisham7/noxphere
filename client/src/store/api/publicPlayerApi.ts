// src/store/api/publicPlayerApi.ts
import { baseApi } from "./baseApi";

export interface TacticalAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface PublicPlayerProfile {
  firstName: string;
  lastName: string;
  photo?: string;
  position?: string;
  jerseyNumber?: number;
  ageGroup?: string;
  overallRating?: number;
  teamName?: string;
  franchiseName?: string;
  academyName?: string;
  bio?: string;
  preferredFoot?: string;
  isFreeAgent: boolean;
  attributes?: TacticalAttributes | null;
  totalEvaluations?: number;
}

export const publicPlayerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPublicPlayerProfile: builder.query<PublicPlayerProfile, string>({
      query: (token) => `/public/players/${token}`,
      transformResponse: (res: { data: PublicPlayerProfile }) => res.data,
    }),
  }),
});

export const { useGetPublicPlayerProfileQuery } = publicPlayerApi;