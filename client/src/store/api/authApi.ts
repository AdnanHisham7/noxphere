// src/store/api/authApi.ts
import { baseApi } from "./baseApi";

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<any, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    register: builder.mutation<any, any>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    refreshToken: builder.mutation<any, { refreshToken: string }>({
      query: (body) => ({ url: '/auth/refresh', method: 'POST', body }),
    }),
    logout: builder.mutation<void, { fcmToken?: string }>({
      query: (body) => ({ url: '/auth/logout', method: 'POST', body }),
    }),
    getMe: builder.query<any, void>({
      query: () => '/auth/me',
      transformResponse: (res: { data: any }) => res.data,
      providesTags: ['User'],
    }),
    updateProfile: builder.mutation<any, { firstName?: string; lastName?: string; avatar?: string; photo?: string }>({
      query: (body) => ({ url: '/auth/profile', method: 'PATCH', body }),
      transformResponse: (res: { data: any }) => res.data,
      invalidatesTags: ['User'],
    }),
    changePassword: builder.mutation<void, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: '/auth/change-password', method: 'POST', body }),
    }),
    checkAvailability: builder.query<{ available: boolean; field?: 'email' | 'phone' | 'both'; message?: string }, { email?: string; phone?: string; purpose?: 'student' | 'guardian' }>({
      query: (params) => ({
        url: '/auth/check-availability',
        method: 'GET',
        params,
      }),
      transformResponse: (res: { data: any }) => res.data,
    }),
    sendForgotPasswordOtp: builder.mutation<{ message: string }, { email: string }>({
      query: (body) => ({
        url: '/auth/forgot-password/send-otp',
        method: 'POST',
        body,
      }),
    }),
    verifyForgotPasswordOtp: builder.mutation<{ message: string }, { email: string; otp: string }>({
      query: (body) => ({
        url: '/auth/forgot-password/verify-otp',
        method: 'POST',
        body,
      }),
    }),
    resetForgotPassword: builder.mutation<{ message: string }, { email: string; otp: string; newPassword: string }>({
      query: (body) => ({
        url: '/auth/forgot-password/reset',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useGetMeQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useCheckAvailabilityQuery,
  useLazyCheckAvailabilityQuery,
  useSendForgotPasswordOtpMutation,
  useVerifyForgotPasswordOtpMutation,
  useResetForgotPasswordMutation,
} = authApi;





