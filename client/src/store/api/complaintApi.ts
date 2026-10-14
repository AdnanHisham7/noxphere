// src/store/api/complaintApi.ts
import { baseApi } from "./baseApi";

export interface ComplaintForwardedCoach {
  coachId: string;
  coachName: string;
  forwardedAt: string;
  notes?: string;
}

export interface ComplaintCoachResponse {
  coachId: string;
  coachName: string;
  response: string;
  respondedAt: string;
}

export interface Complaint {
  id: string;
  academyId: string;
  raisedBy: string;
  raisedByRole: string;
  raisedByName: string;
  studentId?: string;
  studentName?: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  forwardedToCoaches?: ComplaintForwardedCoach[];
  forwardedBy?: string;
  forwardedByName?: string;
  forwardedAt?: string;
  forwardedNotes?: string;
  response?: string;
  respondedAt?: string;
  respondedByName?: string;
  coachResponses?: ComplaintCoachResponse[];
  createdAt: string;
}

export interface CandidateCoach {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  isStudentCoach: boolean;
  relationship: string;
  isAlreadyForwarded: boolean;
}

export interface CandidateCoachesResult {
  complaintId: string;
  studentName?: string;
  coaches: CandidateCoach[];
}

export const complaintApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createComplaint: builder.mutation<Complaint, { subject: string; message: string; studentId?: string }>({
      query: (body) => ({ url: "/complaints", method: "POST", body }),
      transformResponse: (res: { data: Complaint }) => res.data,
      invalidatesTags: ["Complaint"],
    }),
    listMyComplaints: builder.query<Complaint[], void>({
      query: () => "/complaints/mine",
      transformResponse: (res: { data: Complaint[] }) => res.data,
      providesTags: ["Complaint"],
    }),
    listAcademyComplaints: builder.query<Complaint[], { academyId: string; status?: string }>({
      query: ({ academyId, status }) => ({ url: `/complaints/${academyId}`, params: status ? { status } : {} }),
      transformResponse: (res: { data: Complaint[] }) => res.data,
      providesTags: ["Complaint"],
    }),
    getCandidateCoaches: builder.query<CandidateCoachesResult, { academyId: string; complaintId: string }>({
      query: ({ academyId, complaintId }) => `/complaints/${academyId}/${complaintId}/candidate-coaches`,
      transformResponse: (res: { data: CandidateCoachesResult }) => res.data,
      providesTags: (_r, _e, { complaintId }) => [{ type: "Complaint", id: `coaches-${complaintId}` }],
    }),
    forwardComplaintToCoaches: builder.mutation<
      Complaint,
      { academyId: string; complaintId: string; coachIds: string[]; notes?: string }
    >({
      query: ({ academyId, complaintId, ...body }) => ({
        url: `/complaints/${academyId}/${complaintId}/forward`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: Complaint }) => res.data,
      invalidatesTags: ["Complaint"],
    }),
    coachRespondToComplaint: builder.mutation<
      Complaint,
      { academyId: string; complaintId: string; response: string }
    >({
      query: ({ academyId, complaintId, ...body }) => ({
        url: `/complaints/${academyId}/${complaintId}/coach-respond`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: Complaint }) => res.data,
      invalidatesTags: ["Complaint"],
    }),
    respondToComplaint: builder.mutation<
      Complaint,
      { academyId: string; complaintId: string; response: string; status: "in_progress" | "resolved" }
    >({
      query: ({ academyId, complaintId, ...body }) => ({
        url: `/complaints/${academyId}/${complaintId}/respond`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: Complaint }) => res.data,
      invalidatesTags: ["Complaint"],
    }),
  }),
});

export const {
  useCreateComplaintMutation,
  useListMyComplaintsQuery,
  useListAcademyComplaintsQuery,
  useGetCandidateCoachesQuery,
  useForwardComplaintToCoachesMutation,
  useCoachRespondToComplaintMutation,
  useRespondToComplaintMutation,
} = complaintApi;