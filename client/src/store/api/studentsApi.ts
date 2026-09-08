import { baseApi } from './baseApi';

export type SelectionStatus = 'pending' | 'shortlisted' | 'on_hold' | 'selected' | 'not_selected' | 'released';
export type TransferStatus = 'not_listed' | 'listed' | 'sold';
export type StudentStatus = 'active' | 'inactive' | 'on_leave' | 'graduated' | 'dropped_out';

export interface MedicalInfo {
  bloodGroup?: string;
  allergies?: string[];
  medicalConditions?: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalCondition?: string;
  medicalNotes?: string;
  medicalReportUrl?: string;
  medicalCertificateUrl?: string;
  scanReportUrl?: string;
  pdfAttachmentUrl?: string;
  imageAttachmentUrl?: string;
  docAttachmentUrl?: string;
}

export interface GuardianInfo {
  name: string;
  phone: string;
  email: string;
}

export interface Student {
  id: string;
  userId: string;
  franchiseId: string;
  teamId?: string;
  coachId?: string;
  guardianIds: string[];
  guardian: GuardianInfo;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ageGroup: string;
  jerseyNumber?: number;
  jerseySize?: string;
  position?: string;
  positions?: string[];
  photo?: string;
  medicalInfo: MedicalInfo;
  enrollmentDate: string;
  isActive: boolean;
  status: StudentStatus;
  publicProfileToken?: string;
  publicProfileEnabled?: boolean;
  attendancePercentage: number;
  overallRating: number;
  selectionStatus: SelectionStatus;
  selectionPhase?: string;
  selectionFeedback?: string;
  transferStatus: TransferStatus;
  transferPrice?: number;
  transferListedAt?: string;
  transferNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentBody {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO datetime
  ageGroup: string;
  franchiseId: string;
  teamId?: string;
  coachId?: string;
  jerseyNumber?: number;
  jerseySize?: string;
  position?: string;
  positions?: string[];
  photo?: string;
  guardian: GuardianInfo;
  medicalInfo: MedicalInfo;
}

export interface StudentPerformanceRecord {
  _id: string;
  sessionDate: string;
  skillScores: { parameter: string; score: number }[];
  overallScore: number;
  remarks?: string;
  videoUrl?: string;
  coachId?: { firstName: string; lastName: string };
}

export interface PlayerCard {
  student: Student;
  performances: StudentPerformanceRecord[];
  attendance: { sessionDate: string; status: string; remarks?: string }[];
  remarks: { _id: string; text: string; date: string; coachId?: { firstName: string; lastName: string } }[];
}

export interface FranchiseTransferLogEntry {
  id: string;
  fromFranchise: { id: string; name: string } | null;
  toFranchise: { id: string; name: string } | null;
  transferredBy: { id: string; name: string } | null;
  reason?: string;
  transferredAt: string;
}

export interface StudentReportFeeInstallment {
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidAmount: number;
  paidAt?: string;
  status: string;
}

export interface StudentReportFee {
  _id: string;
  feeType: string;
  finalAmount: number;
  overallStatus: string;
  installments: StudentReportFeeInstallment[];
}

export interface StudentReport {
  student: Student;
  performances: {
    sessionDate: string;
    skillScores: { parameter: string; score: number }[];
    overallScore: number;
    remarks?: string;
  }[];
  attendance: { sessionDate: string; status: string; remarks?: string }[];
  remarks: { _id: string; text: string; date: string; coachId?: { firstName: string; lastName: string } }[];
  fees: StudentReportFee[];
  summary: {
    attendanceRate: number;
    totalSessions: number;
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    generatedAt: string;
  };
}

export const studentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStudents: builder.query<
      { items: Student[]; total: number },
      { franchiseId: string; page?: number; limit?: number; search?: string; teamId?: string; ageGroup?: string; selectionStatus?: string }
    >({
      query: ({ franchiseId, page = 1, limit = 20, search, teamId, ageGroup, selectionStatus }) => ({
        url: '/students',
        params: { franchiseId, page, limit, search, teamId, ageGroup, selectionStatus },
      }),
      transformResponse: (res: { data: { items: Student[]; total: number } }) => res.data,
      providesTags: (result) =>
        result
          ? [...result.items.map((s) => ({ type: 'Student' as const, id: s.id })), { type: 'Student', id: 'LIST' }]
          : [{ type: 'Student', id: 'LIST' }],
    }),
    getStudentById: builder.query<Student, string>({
      query: (id) => `/students/${id}`,
      transformResponse: (res: { data: Student }) => res.data,
      providesTags: (_, __, id) => [{ type: 'Student', id }],
    }),
    createStudent: builder.mutation<Student, CreateStudentBody>({
      query: (body) => ({ url: '/students', method: 'POST', body }),
      transformResponse: (res: { data: Student }) => res.data,
      invalidatesTags: [{ type: 'Student', id: 'LIST' }],
    }),
    updateStudent: builder.mutation<Student, { id: string; data: Omit<Partial<CreateStudentBody>, "teamId" | "franchiseId"> & { teamId?: string | null } }>({
      query: ({ id, data }) => ({ url: `/students/${id}`, method: 'PUT', body: data }),
      transformResponse: (res: { data: Student }) => res.data,
      invalidatesTags: (_, __, { id }) => [{ type: 'Student', id }, { type: 'Student', id: 'LIST' }],
    }),
    updateStudentPhoto: builder.mutation<Student, { id: string; photo: string }>({
      query: ({ id, photo }) => ({ url: `/students/${id}/photo`, method: 'PATCH', body: { photo } }),
      transformResponse: (res: { data: Student }) => res.data,
      invalidatesTags: (_, __, { id }) => [{ type: 'Student', id }, { type: 'Student', id: 'LIST' }],
    }),
    deleteStudent: builder.mutation<void, string>({
      query: (id) => ({ url: `/students/${id}`, method: 'DELETE' }),
      invalidatesTags: (_, __, id) => [{ type: 'Student', id }, { type: 'Student', id: 'LIST' }],
    }),
    // NOTE: addPerformance/markAttendance used to live here as freeform
    // per-student writes. Attendance/performance are now only recorded
    // against a real scheduled session — see scheduleApi's
    // markSessionAttendance/logSessionPerformance.
    addCoachRemark: builder.mutation<unknown, { id: string; data: { text: string } }>({
      query: ({ id, data }) => ({ url: `/students/${id}/remarks`, method: 'POST', body: data }),
      invalidatesTags: (_, __, { id }) => [{ type: 'Student', id }],
    }),
    getPlayerCard: builder.query<PlayerCard, string>({
      query: (id) => `/students/${id}/playercard`,
      transformResponse: (res: { data: PlayerCard }) => res.data,
      providesTags: (_, __, id) => [{ type: 'Performance', id }, { type: 'Student', id }],
    }),
    getStudentReport: builder.query<StudentReport, string>({
      query: (id) => `/students/${id}/report`,
      transformResponse: (res: { data: StudentReport }) => res.data,
      providesTags: (_, __, id) => [{ type: 'Performance', id }, { type: 'Student', id }],
    }),
    updateStudentStatus: builder.mutation<Student, { id: string; status: StudentStatus }>({
      query: ({ id, status }) => ({ url: `/students/${id}/status`, method: 'PATCH', body: { status } }),
      transformResponse: (res: { data: Student }) => res.data,
      invalidatesTags: (_, __, { id }) => [{ type: 'Student', id }, { type: 'Student', id: 'LIST' }],
    }),
    transferStudentFranchise: builder.mutation<Student, { id: string; toFranchiseId: string; reason?: string }>({
      query: ({ id, toFranchiseId, reason }) => ({
        url: `/students/${id}/transfer-franchise`,
        method: 'POST',
        body: { toFranchiseId, reason },
      }),
      transformResponse: (res: { data: Student }) => res.data,

      invalidatesTags: (_, __, { id }) => [
        { type: 'Student', id },
        { type: 'Student', id: 'LIST' },
        { type: 'TransferHistory', id },
      ],
    }),
    getTransferHistory: builder.query<FranchiseTransferLogEntry[], string>({
      query: (id) => `/students/${id}/transfer-history`,
      transformResponse: (res: { data: FranchiseTransferLogEntry[] }) => res.data,
      providesTags: (_, __, id) => [{ type: 'TransferHistory', id }],
    }),
    getUnattachedStudents: builder.query<
      { students: Student[]; total: number; page: number; totalPages: number },
      { search?: string; ageGroup?: string; page?: number; limit?: number }
    >({
      query: (params) => ({
        url: '/students/unattached',
        params,
      }),
      transformResponse: (res: any) => {
        const raw = res?.data;
        const list = raw?.students || raw?.items || (Array.isArray(raw) ? raw : []);
        return {
          students: list,
          total: raw?.total ?? list.length,
          page: raw?.page ?? 1,
          totalPages: raw?.totalPages ?? raw?.pages ?? 1,
        };
      },
      providesTags: [{ type: 'Student', id: 'LIST' }],
    }),
    claimUnattachedStudent: builder.mutation<
      Student,
      {
        id: string;
        data: {
          franchiseId: string;
          teamId?: string;
          coachId?: string;
          jerseyNumber?: number;
          jerseySize?: string;
          position?: string;
          positions?: string[];
        };
      }
    >({
      query: ({ id, data }) => ({
        url: `/students/${id}/claim`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (res: { data: Student }) => res.data,
      invalidatesTags: [{ type: 'Student', id: 'LIST' }, 'Franchise'],
    }),
    registerPublicStudent: builder.mutation<
      { token: string; student: Student },
      {
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
        dateOfBirth: string;
        gender?: string;
        ageGroup: string;
        guardianEmail: string;
        guardianPhone: string;
        guardianName: string;
        password?: string;
        position?: string;
        positions?: string[];
        medicalInfo?: any;
      }
    >({
      query: (body) => ({
        url: '/auth/register-student',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: { token: string; student: Student } }) => res.data,
    }),
    getRegistrationRequests: builder.query<
      { requests: any[]; total: number },
      { academyId?: string; franchiseId?: string; status?: string }
    >({
      query: (params) => ({
        url: '/registration/requests',
        params,
      }),
      transformResponse: (res: any) => {
        const raw = res?.data;
        if (Array.isArray(raw)) {
          return { requests: raw, total: raw.length };
        }
        if (raw?.requests && Array.isArray(raw.requests)) {
          return { requests: raw.requests, total: raw.total ?? raw.requests.length };
        }
        return { requests: [], total: 0 };
      },
      providesTags: ['RegistrationRequest'],
    }),
    approveRegistrationRequest: builder.mutation<
      { request: any; student: Student },
      {
        id: string;
        data: {
          franchiseId?: string;
          teamId?: string;
          coachId?: string;
          jerseyNumber?: number;
          jerseySize?: string;
          position?: string;
          positions?: string[];
          studentDetails?: any;
          guardianDetails?: any;
        };
      }
    >({
      query: ({ id, data }) => ({
        url: `/registration/requests/${id}/approve`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (res: { data: { request: any; student: Student } }) => res.data,
      invalidatesTags: ['RegistrationRequest', { type: 'Student', id: 'LIST' }, 'Academy'],
    }),
    rejectRegistrationRequest: builder.mutation<
      { request: any },
      { id: string; reason?: string }
    >({
      query: ({ id, reason }) => ({
        url: `/registration/requests/${id}/reject`,
        method: 'POST',
        body: { reason },
      }),
      transformResponse: (res: { data: { request: any } }) => res.data,
      invalidatesTags: ['RegistrationRequest'],
    }),
  }),
});

export const {
  useGetStudentsQuery,
  useGetStudentByIdQuery,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useUpdateStudentPhotoMutation,
  useDeleteStudentMutation,
  useAddCoachRemarkMutation,
  useGetPlayerCardQuery,
  useGetStudentReportQuery,
  useUpdateStudentStatusMutation,
  useTransferStudentFranchiseMutation,
  useGetTransferHistoryQuery,
  useGetUnattachedStudentsQuery,
  useClaimUnattachedStudentMutation,
  useRegisterPublicStudentMutation,
  useGetRegistrationRequestsQuery,
  useApproveRegistrationRequestMutation,
  useRejectRegistrationRequestMutation,
} = studentsApi;