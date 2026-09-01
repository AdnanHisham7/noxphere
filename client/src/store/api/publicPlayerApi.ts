// src/store/api/publicPlayerApi.ts
import { baseApi } from "./baseApi";

export interface PublicPlayerProfile {
  firstName: string;
  lastName: string;
  photo?: string;
  position?: string;
  jerseyNumber?: number;
  ageGroup: string;
  overallRating: number;
  teamName?: string;
  franchiseName: string;
  academyName: string;
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