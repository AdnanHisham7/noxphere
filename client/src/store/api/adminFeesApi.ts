// src/store/api/adminFeesApi.ts
import { baseApi } from "./baseApi";

export interface FeeAuditLog {
  action: string;
  amount: number;
  installmentNumber: number;
  paymentMethod?: string;
  transactionId?: string;
  timestamp: string;
  performedByName: string;
  details?: string;
}

export interface FeeInstallment {
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidAmount: number;
  paidAt?: string;
  status: string;
  paymentMethod?: string;
  transactionId?: string;
}

export interface AdminFeeRecord {
  _id: string;
  studentId: { _id: string; firstName: string; lastName: string; photo?: string };
  feeType: string;
  totalAmount: number;
  finalAmount: number;
  overallStatus: string;
  installments: FeeInstallment[];
  auditLog?: FeeAuditLog[];
  createdAt: string;
}

export interface CreateFeeBody {
  studentId: string;
  franchiseId: string;
  feeType: "one_time" | "installment" | "early_bird";
  totalAmount: number;
  discount?: number;
  installments: { installmentNumber: number; amount: number; dueDate: string }[];
  notes?: string;
}

export const adminFeesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listFees: builder.query<AdminFeeRecord[], { franchiseId: string; studentId?: string; status?: string }>({
      query: (params) => ({ url: "/fees", params }),
      transformResponse: (res: { data: AdminFeeRecord[] }) => res.data,
      providesTags: ["Fee"],
    }),
    createFee: builder.mutation<AdminFeeRecord, CreateFeeBody>({
      query: (body) => ({ url: "/fees", method: "POST", body }),
      transformResponse: (res: { data: AdminFeeRecord }) => res.data,
      invalidatesTags: ["Fee", "Student"],
    }),
    recordPayment: builder.mutation<
      AdminFeeRecord,
      { feeId: string; installmentNumber: number; amount: number; paymentMethod?: string; transactionId?: string }
    >({
      query: ({ feeId, installmentNumber, ...body }) => ({
        url: `/fees/${feeId}/installments/${installmentNumber}/pay`,
        method: "POST",
        body,
      }),
      transformResponse: (res: { data: AdminFeeRecord }) => res.data,
      invalidatesTags: ["Fee", "Student"],
    }),
    updatePayment: builder.mutation<
      AdminFeeRecord,
      { feeId: string; installmentNumber: number; amount: number; paymentMethod?: string; transactionId?: string }
    >({
      query: ({ feeId, installmentNumber, ...body }) => ({
        url: `/fees/${feeId}/installments/${installmentNumber}/pay`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: { data: AdminFeeRecord }) => res.data,
      invalidatesTags: ["Fee", "Student"],
    }),
    undoPayment: builder.mutation<
      AdminFeeRecord,
      { feeId: string; installmentNumber: number }
    >({
      query: ({ feeId, installmentNumber }) => ({
        url: `/fees/${feeId}/installments/${installmentNumber}/undo`,
        method: "POST",
      }),
      transformResponse: (res: { data: AdminFeeRecord }) => res.data,
      invalidatesTags: ["Fee", "Student"],
    }),
  }),
});

export const {
  useListFeesQuery,
  useCreateFeeMutation,
  useRecordPaymentMutation,
  useUpdatePaymentMutation,
  useUndoPaymentMutation,
} = adminFeesApi;
