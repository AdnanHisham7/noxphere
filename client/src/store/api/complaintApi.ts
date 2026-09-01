// src/store/api/complaintApi.ts
import { baseApi } from "./baseApi";

export interface Complaint {
  id: string;
  academyId: string;
  raisedBy: string;
  raisedByRole: string;
  raisedByName: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  response?: string;
  respondedAt?: string;
  createdAt: string;
}

export const complaintApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createComplaint: builder.mutation<Complaint, { subject: string; message: string }>({
      query: (body) => ({ url: "/complaints", method: "POST", body }),
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
    respondToComplaint: builder.mutation<
      Complaint,
      { academyId: string; complaintId: string; response: string; status: "in_progress" | "resolved" }
    >({
      query: ({ academyId, complaintId, ...body }) => ({
        url: `/complaints/${academyId}/${complaintId}/respond`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Complaint"],
    }),
  }),
});

export const {
  useCreateComplaintMutation,
  useListMyComplaintsQuery,
  useListAcademyComplaintsQuery,
  useRespondToComplaintMutation,
} = complaintApi;