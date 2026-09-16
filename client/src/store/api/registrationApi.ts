// src/store/api/registrationApi.ts
import { baseApi } from './baseApi';

export interface AcademyPublicInfo {
  academy: {
    id: string;
    name: string;
    location?: string | { name?: string; address?: string };
    ageGroups?: string[];
  };
  franchises: Array<{
    id: string;
    name: string;
    location?: string | { name?: string; address?: string };
    ageGroups?: string[];
  }>;
}

export interface SendOtpPayload {
  phone: string;
  email: string;
  academyId: string;
}

export interface VerifyOtpPayload {
  phone: string;
  email: string;
  otp: string;
}

export interface SubmitRegistrationPayload {
  academyId: string;
  franchiseId: string;
  existingStudentId?: string;
  dpdpConsent: boolean;
  studentDetails: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender?: string;
    ageGroup: string;
    position?: string;
    positions?: string[];
    jerseyNumber?: number;
    jerseySize?: string;
    photo?: string;
    medicalInfo?: {
      bloodGroup?: string;
      allergies?: string[];
      medicalConditions?: string[];
      emergencyContactName: string;
      emergencyContactPhone: string;
      medicalNotes?: string;
    };
  };
  guardianDetails: {
    name: string;
    phone: string;
    email: string;
    relation?: string;
  };
}

export const registrationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAcademyPublicInfo: builder.query<AcademyPublicInfo, string>({
      query: (academyId) => `/registration/academy/${academyId}/public-info`,
      transformResponse: (res: { data: AcademyPublicInfo }) => res.data,
    }),
    sendRegistrationOtp: builder.mutation<{ message: string; otpExpiresInSeconds: number }, SendOtpPayload>({
      query: (body) => ({
        url: '/registration/otp/send',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: { message: string; otpExpiresInSeconds: number } }) => res.data,
    }),
    verifyRegistrationOtp: builder.mutation<{ verified: boolean; student?: any }, VerifyOtpPayload>({
      query: (body) => ({
        url: '/registration/otp/verify',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: { verified: boolean; student?: any } }) => res.data,
    }),
    submitRegistrationRequest: builder.mutation<
      { message: string; requestId: string },
      SubmitRegistrationPayload
    >({
      query: (body) => ({
        url: '/registration/apply',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: { message: string; requestId: string } }) => res.data,
      invalidatesTags: ['RegistrationRequest'],
    }),
  }),
});

export const {
  useGetAcademyPublicInfoQuery,
  useSendRegistrationOtpMutation,
  useVerifyRegistrationOtpMutation,
  useSubmitRegistrationRequestMutation,
} = registrationApi;
