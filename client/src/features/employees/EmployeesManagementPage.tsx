// src/features/employees/EmployeesManagementPage.tsx
import React, { useState } from "react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { UserPlus, Users, Shield, Wallet, Pencil, Power, Trash2, ShieldPlus } from "lucide-react";
import { Button, Input, Badge, Modal, Skeleton, EmptyState } from "../../components/ui";
import { useConfirm } from "../../hooks/useConfirm";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import {
  useListEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useSetEmployeeActiveMutation,
  useDeleteEmployeeMutation,
  useListRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  type Employee,
  type EmployeeRole,
  type EmployeePermissionKey,
} from "../../store/api/employeeApi";
import { SubscriptionModal } from "../subscription/SubscriptionModal";
import { SalaryTrackerPanel } from "./SalaryTrackerPanel";

const PERMISSION_LABELS: Record<EmployeePermissionKey, string> = {
  canManageUsers: "Manage Coaches & Employees",
  canManageFranchises: "Manage Franchises",
  canManageSessions: "Manage Sessions/Schedule",
  canManageFinance: "Manage Fees & Finance",
  canViewReports: "View Reports",
  canManageAttendance: "Manage Attendance",
  canManagePerformance: "Manage Performance",
  canManageSelection: "Manage Selection Board",
  canSendNotifications: "Send Notifications",
};
const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as EmployeePermissionKey[];

const EmployeesManagementPage: React.FC = () => {
  const academyId = useCurrentAcademyId();
  const [tab, setTab] = useState<"employees" | "roles" | "salary">("employees");
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<EmployeeRole | "new" | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const { data: employees, isLoading: employeesLoading } = useListEmployeesQuery(academyId ?? "", { skip: !academyId });
  const { data: roles, isLoading: rolesLoading } = useListRolesQuery(academyId ?? "", { skip: !academyId });
  const [createEmployee, { isLoading: creating }] = useCreateEmployeeMutation();
  const [setActive] = useSetEmployeeActiveMutation();
  const [deleteEmployee] = useDeleteEmployeeMutation();
  const [createRole] = useCreateRoleMutation();
  const [updateRole] = useUpdateRoleMutation();
  const [deleteRole] = useDeleteRoleMutation();

  if (!academyId) {
    return <EmptyState icon={<Users size={28} />} title="No academy context" description="Select a franchise to manage its academy's employees." />;
  }

  const handleToggleActive = async (emp: Employee) => {
    try {
      await setActive({ academyId, employeeId: emp.id, isActive: !emp.isActive }).unwrap();
      toast.success(emp.isActive ? "Employee deactivated" : "Employee activated");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update — try again");
    }
  };

  const handleDelete = async (emp: Employee) => {
    const ok = await confirm({
      title: "Remove employee",
      message: `Remove ${emp.firstName} ${emp.lastName}? This can't be undone.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEmployee({ academyId, employeeId: emp.id }).unwrap();
      toast.success("Employee removed");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't remove employee — try again");
    }
  };

  const handleDeleteRole = async (role: EmployeeRole) => {
    const ok = await confirm({
      title: "Remove role",
      message: `Remove the "${role.name}" role? Employees must be reassigned first.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteRole({ academyId, roleId: role.id }).unwrap();
      toast.success("Role removed");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't remove role — try again");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-title mb-1">Academy Staff</p>
          <h1 className="font-display font-extrabold text-white text-2xl uppercase tracking-tight">Employees</h1>
        </div>
        <Button icon={<UserPlus size={15} />} onClick={() => setShowAddEmployee(true)}>Add Employee</Button>
      </div>

      <div className="flex gap-2 border-b border-white/5">
        {[
          { id: "employees" as const, label: "Employees", icon: Users },
          { id: "roles" as const, label: "Roles", icon: Shield },
          { id: "salary" as const, label: "Salary", icon: Wallet },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors",
              tab === t.id ? "border-volt-400 text-volt-400" : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "employees" && (
        employeesLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded" />)}</div>
        ) : !employees?.length ? (
          <EmptyState icon={<Users size={28} />} title="No employees yet" description="Add your first employee to get started." />
        ) : (
          <div className="card divide-y divide-white/5">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-pitch-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                  {emp.firstName[0]}{emp.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{emp.firstName} {emp.lastName}</p>
                  <p className="text-2xs text-slate-500">
                    {emp.employeeType === "staff" ? (typeof emp.roleId === "object" ? emp.roleId?.name : "Staff") : "External"}
                    {emp.email ? ` · ${emp.email}` : ""}
                  </p>
                </div>
                <Badge variant={emp.employeeType === "staff" ? "blue" : "gray"}>
                  {emp.employeeType === "staff" ? "System access" : "External"}
                </Badge>
                <Badge variant={emp.isActive ? "green" : "gray"}>{emp.isActive ? "Active" : "Inactive"}</Badge>
                <span className="text-xs text-slate-400 w-24 text-right">₹{emp.salaryAmount.toLocaleString("en-IN")}/mo</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditEmployee(emp)} className="text-slate-500 hover:text-volt-400"><Pencil size={14} /></button>
                  <button onClick={() => handleToggleActive(emp)} className="text-slate-500 hover:text-volt-400"><Power size={14} /></button>
                  <button onClick={() => handleDelete(emp)} className="text-slate-500 hover:text-ember-400"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "roles" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" icon={<ShieldPlus size={14} />} onClick={() => setShowRoleModal("new")}>New Role</Button>
          </div>
          {rolesLoading ? (
            <Skeleton className="h-32 rounded" />
          ) : !roles?.length ? (
            <EmptyState icon={<Shield size={28} />} title="No roles yet" description="Create a role to assign permissions to staff employees." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {roles.map((role) => (
                <div key={role.id} className="card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{role.name}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowRoleModal(role)} className="text-slate-500 hover:text-volt-400"><Pencil size={13} /></button>
                      <button onClick={() => handleDeleteRole(role)} className="text-slate-500 hover:text-ember-400"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.length === 0 ? (
                      <span className="text-2xs text-slate-600">No permissions granted</span>
                    ) : (
                      role.permissions.map((p) => (
                        <span key={p} className="text-2xs px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                          {PERMISSION_LABELS[p]}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "salary" && <SalaryTrackerPanel academyId={academyId} />}

      {showAddEmployee && (
        <EmployeeFormModal
          academyId={academyId}
          roles={roles ?? []}
          creating={creating}
          onClose={() => setShowAddEmployee(false)}
          onSubmit={async (body) => {
            try {
              await createEmployee({ academyId, ...body }).unwrap();
              toast.success("Employee added");
              setShowAddEmployee(false);
            } catch (err: any) {
              if (err?.data?.code === "SUBSCRIPTION_REQUIRED" || err?.data?.code === "SUBSCRIPTION_CAPACITY_EXCEEDED") {
                setShowAddEmployee(false);
                setSubscriptionModalOpen(true);
              } else {
                toast.error(err?.data?.message || "Couldn't add employee — try again");
              }
            }
          }}
        />
      )}

      {editEmployee && (
        <EditEmployeeModal
          academyId={academyId}
          employee={editEmployee}
          roles={roles ?? []}
          onClose={() => setEditEmployee(null)}
        />
      )}

      {showRoleModal && (
        <RoleFormModal
          role={showRoleModal === "new" ? null : showRoleModal}
          onClose={() => setShowRoleModal(null)}
          onSubmit={async (name, permissions) => {
            try {
              if (showRoleModal === "new") {
                await createRole({ academyId, name, permissions }).unwrap();
                toast.success("Role created");
              } else {
                await updateRole({ academyId, roleId: showRoleModal.id, name, permissions }).unwrap();
                toast.success("Role updated");
              }
              setShowRoleModal(null);
            } catch (err: any) {
              toast.error(err?.data?.message || "Couldn't save role — try again");
            }
          }}
        />
      )}

      {subscriptionModalOpen && (
        <SubscriptionModal academyId={academyId} mode="upgrade" onClose={() => setSubscriptionModalOpen(false)} />
      )}
      {ConfirmDialog}
    </div>
  );
};

const EmployeeFormModal: React.FC<{
  academyId: string;
  roles: EmployeeRole[];
  creating: boolean;
  onClose: () => void;
  onSubmit: (body: {
    firstName: string; lastName: string; phone?: string; email?: string;
    employeeType: "external" | "staff"; roleId?: string; salaryAmount: number; notes?: string;
  }) => void;
}> = ({ roles, creating, onClose, onSubmit }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [employeeType, setEmployeeType] = useState<"external" | "staff">("external");
  const [roleId, setRoleId] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    if (!firstName.trim() || !lastName.trim()) return toast.error("Name is required");
    if (!salaryAmount || Number(salaryAmount) < 0) return toast.error("Enter a valid salary amount");
    if (employeeType === "staff" && (!email.trim() || !roleId)) {
      return toast.error("Staff employees need an email and a role");
    }
    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      employeeType,
      roleId: employeeType === "staff" ? roleId : undefined,
      salaryAmount: Number(salaryAmount),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Add Employee" size="sm">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />

        <div>
          <label className="label">Employee type</label>
          <div className="flex gap-2">
            {(["external", "staff"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setEmployeeType(t)}
                className={clsx(
                  "flex-1 rounded px-3 py-2 text-sm font-semibold border transition-colors",
                  employeeType === t ? "bg-volt-400 border-volt-400 text-pitch-900" : "bg-pitch-800 border-white/10 text-slate-400"
                )}
              >
                {t === "external" ? "External (no login)" : "Staff (system access)"}
              </button>
            ))}
          </div>
          {employeeType === "staff" && (
            <p className="text-2xs text-slate-500 mt-1.5">Counts toward your billed staff-seat capacity.</p>
          )}
        </div>

        {employeeType === "staff" && (
          <>
            <Input label="Email (login)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div>
              <label className="label">Role</label>
              <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="input !w-full">
                <option value="">Select a role…</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {roles.length === 0 && <p className="text-2xs text-slate-500 mt-1.5">Create a role first, under the Roles tab.</p>}
            </div>
          </>
        )}

        <Input label="Monthly salary (₹)" type="number" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} />
        <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <Button className="w-full" loading={creating} onClick={handleSubmit}>Add Employee</Button>
      </div>
    </Modal>
  );
};

const EditEmployeeModal: React.FC<{
  academyId: string;
  employee: Employee;
  roles: EmployeeRole[];
  onClose: () => void;
}> = ({ academyId, employee, roles, onClose }) => {
  const [updateEmployee, { isLoading }] = useUpdateEmployeeMutation();
  const [firstName, setFirstName] = useState(employee.firstName);
  const [lastName, setLastName] = useState(employee.lastName);
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [salaryAmount, setSalaryAmount] = useState(String(employee.salaryAmount));
  const [roleId, setRoleId] = useState(typeof employee.roleId === "object" ? employee.roleId?.id ?? "" : employee.roleId ?? "");

  const handleSave = async () => {
    try {
      await updateEmployee({
        academyId,
        employeeId: employee.id,
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          salaryAmount: Number(salaryAmount),
          ...(employee.employeeType === "staff" ? { roleId } : {}),
        } as any,
      }).unwrap();
      toast.success("Employee updated");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update — try again");
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Employee" size="sm">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {employee.employeeType === "staff" && (
          <div>
            <label className="label">Role</label>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="input !w-full">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
        <Input label="Monthly salary (₹)" type="number" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} />
        <Button className="w-full" loading={isLoading} onClick={handleSave}>Save Changes</Button>
      </div>
    </Modal>
  );
};

const RoleFormModal: React.FC<{
  role: EmployeeRole | null;
  onClose: () => void;
  onSubmit: (name: string, permissions: EmployeePermissionKey[]) => void;
}> = ({ role, onClose, onSubmit }) => {
  const [name, setName] = useState(role?.name ?? "");
  const [permissions, setPermissions] = useState<Set<EmployeePermissionKey>>(new Set(role?.permissions ?? []));

  const togglePermission = (key: EmployeePermissionKey) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={role ? "Edit Role" : "New Role"} size="sm">
      <div className="space-y-4">
        <Input label="Role name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Accountant, Front Desk" />
        <div>
          <label className="label">Permissions</label>
          <div className="space-y-2 mt-1">
            {ALL_PERMISSIONS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={permissions.has(key)}
                  onChange={() => togglePermission(key)}
                  className="accent-volt-400"
                />
                {PERMISSION_LABELS[key]}
              </label>
            ))}
          </div>
        </div>
        <Button
          className="w-full"
          onClick={() => {
            if (!name.trim()) return toast.error("Enter a role name");
            onSubmit(name.trim(), Array.from(permissions));
          }}
        >
          {role ? "Save Changes" : "Create Role"}
        </Button>
      </div>
    </Modal>
  );
};

export default EmployeesManagementPage;