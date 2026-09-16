// src/store/api/squadInvitationApi.ts
import { baseApi } from './baseApi';

export interface SquadInvitation {
  id: string;
  studentId: {
    id: string;
    _id: string;
    firstName: string;
    lastName: string;
    photo?: string;
    position?: string;
    ageGroup?: string;
    overallRating?: number;
  };
  academyId: {
    id: string;
    _id: string;
    name: string;
    academyCode?: string;
    logo?: string;
  };
  franchiseId: {
    id: string;
    _id: string;
    name: string;
    location?: string;
  };
  teamId?: {
    id: string;
    _id: string;
    name: string;
    ageGroup?: string;
  };
  invitedBy: {
    id: string;
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  jerseyNumber?: number;
  position?: string;
  notes?: string;
  rejectionReason?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendSquadInvitationPayload {
  studentId: string;
  franchiseId: string;
  teamId?: string;
  jerseyNumber?: number;
  position?: string;
  notes?: string;
}

export interface RespondSquadInvitationPayload {
  id: string;
  action: 'accept' | 'reject';
  rejectionReason?: string;
  guardianEmail?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianPassword?: string;
  otp?: string;
}

export const squadInvitationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    sendSquadInvitation: builder.mutation<SquadInvitation, SendSquadInvitationPayload>({
      query: (body) => ({
        url: '/squad-invitations',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Student'],
    }),

    getMySquadInvitations: builder.query<SquadInvitation[], void>({
      query: () => '/squad-invitations/my',
      transformResponse: (res: { data: any[] }) =>
        (res.data || []).map((item) => ({
          ...item,
          id: item.id || item._id,
        })),
      providesTags: ['Student'],
    }),

    sendGuardianOtp: builder.mutation<
      { success: boolean; isExistingGuardian: boolean; message: string },
      { invitationId: string; guardianEmail: string }
    >({
      query: (body) => ({
        url: '/squad-invitations/guardian-otp/send',
        method: 'POST',
        body,
      }),
    }),

    respondToSquadInvitation: builder.mutation<
      { success: boolean; status: string; guardianLinked?: boolean; isNewGuardian?: boolean },
      RespondSquadInvitationPayload
    >({
      query: ({ id, ...body }) => {
        const targetId = id || (body as any)._id;
        return {
          url: `/squad-invitations/${targetId}/respond`,
          method: 'POST',
          body,
        };
      },
      invalidatesTags: ['Student', 'User'],
    }),

    getAcademySquadInvitations: builder.query<SquadInvitation[], { status?: string } | void>({
      query: (params) => ({
        url: '/squad-invitations/academy',
        params: params || undefined,
      }),
      transformResponse: (res: { data: any[] }) =>
        (res.data || []).map((item) => ({
          ...item,
          id: item.id || item._id,
        })),
      providesTags: ['Student'],
    }),

    cancelSquadInvitation: builder.mutation<{ success: boolean; status: string }, string>({
      query: (id) => ({
        url: `/squad-invitations/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Student'],
    }),
  }),
});

export const {
  useSendSquadInvitationMutation,
  useGetMySquadInvitationsQuery,
  useSendGuardianOtpMutation,
  useRespondToSquadInvitationMutation,
  useGetAcademySquadInvitationsQuery,
  useCancelSquadInvitationMutation,
} = squadInvitationApi;
