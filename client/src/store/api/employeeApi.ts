// src/store/api/employeeApi.ts
import { baseApi } from "./baseApi";

export type EmployeePermissionKey =
  | "canManageUsers"
  | "canManageFranchises"
  | "canManageSessions"
  | "canManageFinance"
  | "canViewReports"
  | "canManageAttendance"
  | "canManagePerformance"
  | "canManageSelection"
  | "canSendNotifications";

export interface EmployeeRole {
  id: string;
  academyId: string;
  name: string;
  permissions: EmployeePermissionKey[];
}

export interface Employee {
  id: string;
  academyId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  employeeType: "external" | "staff";
  userId?: string;
  roleId?: EmployeeRole | string;
  salaryAmount: number;
  joinDate: string;
  isActive: boolean;
  notes?: string;
}

export interface SalaryPayment {
  id: string;
  employeeId: string | { firstName: string; lastName: string; employeeType: string; roleId?: { name: string } | string };
  academyId: string;
  period: string;
  amount: number;
  status: "pending" | "paid";
  paidAt?: string;
  notes?: string;
}

export const employeeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listRoles: builder.query<EmployeeRole[], string>({
      query: (academyId) => `/employees/${academyId}/roles`,
      transformResponse: (res: { data: EmployeeRole[] }) => res.data,
      providesTags: ["EmployeeRole"],
    }),
    createRole: builder.mutation<EmployeeRole, { academyId: string; name: string; permissions: EmployeePermissionKey[] }>({
      query: ({ academyId, ...body }) => ({ url: `/employees/${academyId}/roles`, method: "POST", body }),
      transformResponse: (res: { data: EmployeeRole }) => res.data,
      invalidatesTags: ["EmployeeRole"],
    }),
    updateRole: builder.mutation<
      EmployeeRole,
      { academyId: string; roleId: string; name: string; permissions: EmployeePermissionKey[] }
    >({
      query: ({ academyId, roleId, ...body }) => ({
        url: `/employees/${academyId}/roles/${roleId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["EmployeeRole", "Employee"],
    }),
    deleteRole: builder.mutation<void, { academyId: string; roleId: string }>({
      query: ({ academyId, roleId }) => ({ url: `/employees/${academyId}/roles/${roleId}`, method: "DELETE" }),
      invalidatesTags: ["EmployeeRole"],
    }),

    listEmployees: builder.query<Employee[], string>({
      query: (academyId) => `/employees/${academyId}`,
      transformResponse: (res: { data: Employee[] }) => res.data,
      providesTags: ["Employee"],
    }),
    createEmployee: builder.mutation<
      Employee,
      {
        academyId: string;
        firstName: string;
        lastName: string;
        phone?: string;
        email?: string;
        employeeType: "external" | "staff";
        roleId?: string;
        salaryAmount: number;
        joinDate?: string;
        notes?: string;
      }
    >({
      query: ({ academyId, ...body }) => ({ url: `/employees/${academyId}`, method: "POST", body }),
      invalidatesTags: ["Employee"],
    }),
    updateEmployee: builder.mutation<
      Employee,
      { academyId: string; employeeId: string; data: Partial<Employee> }
    >({
      query: ({ academyId, employeeId, data }) => ({
        url: `/employees/${academyId}/${employeeId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Employee"],
    }),
    setEmployeeActive: builder.mutation<Employee, { academyId: string; employeeId: string; isActive: boolean }>({
      query: ({ academyId, employeeId, isActive }) => ({
        url: `/employees/${academyId}/${employeeId}/active`,
        method: "PATCH",
        body: { isActive },
      }),
      invalidatesTags: ["Employee"],
    }),
    deleteEmployee: builder.mutation<void, { academyId: string; employeeId: string }>({
      query: ({ academyId, employeeId }) => ({ url: `/employees/${academyId}/${employeeId}`, method: "DELETE" }),
      invalidatesTags: ["Employee"],
    }),

    listSalaryForPeriod: builder.query<SalaryPayment[], { academyId: string; period: string }>({
      query: ({ academyId, period }) => ({ url: `/employees/${academyId}/salary/period`, params: { period } }),
      transformResponse: (res: { data: SalaryPayment[] }) => res.data,
      providesTags: ["SalaryPayment"],
    }),
    markSalaryPaid: builder.mutation<SalaryPayment, { academyId: string; salaryPaymentId: string; notes?: string }>({
      query: ({ academyId, salaryPaymentId, notes }) => ({
        url: `/employees/${academyId}/salary/${salaryPaymentId}/paid`,
        method: "PATCH",
        body: { notes },
      }),
      invalidatesTags: ["SalaryPayment"],
    }),
    listSalaryHistory: builder.query<SalaryPayment[], { academyId: string; employeeId: string }>({
      query: ({ academyId, employeeId }) => `/employees/${academyId}/${employeeId}/salary-history`,
      transformResponse: (res: { data: SalaryPayment[] }) => res.data,
      providesTags: ["SalaryPayment"],
    }),
  }),
});

export const {
  useListRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useListEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useSetEmployeeActiveMutation,
  useDeleteEmployeeMutation,
  useListSalaryForPeriodQuery,
  useMarkSalaryPaidMutation,
  useListSalaryHistoryQuery,
} = employeeApi;