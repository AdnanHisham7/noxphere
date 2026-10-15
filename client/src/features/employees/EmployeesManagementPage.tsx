// src/features/employees/EmployeesManagementPage.tsx
import React, { useState, useMemo } from "react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import {
  UserPlus,
  Users,
  ShieldCheck,
  Wallet,
  Pencil,
  Power,
  Trash2,
  Search,
  Eye,
  EyeOff,
  Building2,
  Briefcase,
  AlertCircle,
  Phone,
  Mail,
} from "lucide-react";
import {
  Button,
  Input,
  Badge,
  Modal,
  Skeleton,
  EmptyState,
  PageHeader,
  Tabs,
  Select,
} from "../../components/ui";
import { useConfirm } from "../../hooks/useConfirm";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import {
  useListEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useSetEmployeeActiveMutation,
  useDeleteEmployeeMutation,
  type Employee,
} from "../../store/api/employeeApi";
import { useCreateUserMutation } from "../../store/api/usersApi";
import { useGetFranchisesQuery } from "../../store/api/franchiseApi";
import { SalaryTrackerPanel } from "./SalaryTrackerPanel";

const EmployeesManagementPage: React.FC = () => {
  const academyId = useCurrentAcademyId();
  const [tab, setTab] = useState<"employees" | "salary">("employees");
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddOperationalManager, setShowAddOperationalManager] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "coaches" | "operational" | "staff">("all");
  const { confirm, ConfirmDialog } = useConfirm();

  const { data: employees, isLoading: employeesLoading } = useListEmployeesQuery(academyId ?? "", {
    skip: !academyId,
  });
  const { data: franchises } = useGetFranchisesQuery(
    academyId ? { academyId, isActive: true } : undefined,
    { skip: !academyId }
  );

  const [createEmployee, { isLoading: creatingEmployee }] = useCreateEmployeeMutation();
  const [createUser, { isLoading: creatingUser }] = useCreateUserMutation();
  const [updateEmployee, { isLoading: updatingEmployee }] = useUpdateEmployeeMutation();
  const [setActive] = useSetEmployeeActiveMutation();
  const [deleteEmployee] = useDeleteEmployeeMutation();

  if (!academyId) {
    return (
      <EmptyState
        icon={<Users size={28} />}
        title="No academy context"
        description="Select a franchise or academy to manage employee records."
      />
    );
  }

  const handleToggleActive = async (emp: Employee) => {
    try {
      await setActive({ academyId, employeeId: emp.id, isActive: !emp.isActive }).unwrap();
      toast.success(emp.isActive ? "Employee deactivated" : "Employee activated");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update employee status — try again");
    }
  };

  const handleDelete = async (emp: Employee) => {
    const ok = await confirm({
      title: "Remove employee",
      message: `Remove ${emp.firstName} ${emp.lastName} from employee payroll records? This action cannot be undone.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEmployee({ academyId, employeeId: emp.id }).unwrap();
      toast.success("Employee removed successfully");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't remove employee — try again");
    }
  };

  const filteredEmployees = useMemo(() => {
    return (employees ?? []).filter((emp) => {
      const designation = (emp.designation || (emp.employeeType === "staff" ? "Staff" : "Employee")).toLowerCase();
      const isCoach = designation.includes("coach");
      const isOpManager = designation.includes("operational manager");

      if (roleFilter === "coaches" && !isCoach) return false;
      if (roleFilter === "operational" && !isOpManager) return false;
      if (roleFilter === "staff" && (isCoach || isOpManager)) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const phone = emp.phone?.toLowerCase() || "";
      const email = emp.email?.toLowerCase() || "";

      return fullName.includes(term) || designation.includes(term) || phone.includes(term) || email.includes(term);
    });
  }, [employees, roleFilter, searchTerm]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Academy Operations"
        title="Employees & Payroll"
        subtitle="Manage employees, coach salaries, operational manager accounts, and monthly payroll disbursement."
        actions={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <Button
              variant="secondary"
              icon={<ShieldCheck size={15} className="text-volt-500 dark:text-volt-400" />}
              onClick={() => setShowAddOperationalManager(true)}
              className="border-volt-500/30 text-slate-800 dark:text-white hover:border-volt-400 justify-center"
            >
              Add Operational Manager
            </Button>
            <Button
              variant="primary"
              icon={<UserPlus size={15} />}
              onClick={() => setShowAddEmployee(true)}
              className="justify-center"
            >
              Add Employee
            </Button>
          </div>
        }
      />

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: "employees", label: "Employees & Staff", icon: <Users size={14} /> },
          { id: "salary", label: "Salary Tracker", icon: <Wallet size={14} /> },
        ]}
      />

      {tab === "employees" && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, designation, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-volt-400 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-pitch-900 p-1 rounded-lg border border-slate-200 dark:border-white/10 self-start sm:self-auto">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "coaches", label: "Coaches" },
                  { id: "operational", label: "Operational Managers" },
                  { id: "staff", label: "General Staff" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setRoleFilter(f.id)}
                  className={clsx(
                    "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                    roleFilter === f.id
                      ? "bg-white dark:bg-pitch-800 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Employee Roster */}
          {employeesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : !employees?.length ? (
            <EmptyState
              icon={<Users size={28} />}
              title="No employees registered"
              description="Add your first employee or operational manager to begin managing staff and payroll."
              action={
                <Button size="sm" onClick={() => setShowAddEmployee(true)} icon={<UserPlus size={14} />}>
                  Add Employee
                </Button>
              }
            />
          ) : !filteredEmployees.length ? (
            <EmptyState
              icon={<Search size={28} />}
              title="No matching staff"
              description="No employee records match your active search or role filter."
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSearchTerm("");
                    setRoleFilter("all");
                  }}
                >
                  Clear Filters
                </Button>
              }
            />
          ) : (
            <div className="bg-white dark:bg-pitch-900/90 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
              {filteredEmployees.map((emp) => {
                const designation =
                  emp.designation ||
                  (emp.employeeType === "staff"
                    ? typeof emp.roleId === "object"
                      ? emp.roleId?.name
                      : "Staff"
                    : "Employee");
                const isCoach = designation.toLowerCase().includes("coach");
                const isOpManager = designation.toLowerCase().includes("operational manager");

                return (
                  <div
                    key={emp.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 hover:bg-slate-50 dark:hover:bg-pitch-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-pitch-800 border border-slate-200 dark:border-white/10 flex items-center justify-center font-bold text-xs text-slate-800 dark:text-white shrink-0">
                        {emp.firstName[0]}
                        {emp.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {emp.firstName} {emp.lastName}
                          </p>
                          {isOpManager && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-bold bg-volt-500/10 text-volt-600 dark:text-volt-400 border border-volt-500/20">
                              <ShieldCheck size={11} />
                              Ops Manager
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-2xs text-slate-500 dark:text-slate-400">
                          <span
                            className={clsx(
                              "font-semibold px-1.5 py-0.5 rounded",
                              isCoach
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : isOpManager
                                ? "bg-volt-500/10 text-volt-600 dark:text-volt-400"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            )}
                          >
                            {designation}
                          </span>
                          <span>•</span>
                          <span>{emp.employeeType === "staff" ? "System Access" : "Payroll Record Only"}</span>
                          {emp.phone && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Phone size={10} />
                                {emp.phone}
                              </span>
                            </>
                          )}
                          {emp.email && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Mail size={10} />
                                {emp.email}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 self-end sm:self-auto w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-white/5">
                      <div className="text-left sm:text-right">
                        <span className="text-sm font-bold font-mono text-slate-900 dark:text-white block">
                          ₹{emp.salaryAmount.toLocaleString("en-IN")}
                          <span className="text-2xs font-normal text-slate-400">/mo</span>
                        </span>
                        <span className="text-2xs text-slate-400 dark:text-slate-500">
                          Joined {new Date(emp.joinDate || Date.now()).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Badge variant={emp.isActive ? "green" : "gray"}>
                          {emp.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditEmployee(emp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                          title="Edit employee"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(emp)}
                          className={clsx(
                            "p-1.5 rounded-lg transition-colors",
                            emp.isActive
                              ? "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                              : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                          )}
                          title={emp.isActive ? "Deactivate employee" : "Activate employee"}
                        >
                          <Power size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(emp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                          title="Remove employee"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "salary" && <SalaryTrackerPanel academyId={academyId} />}

      {/* Add Employee Modal (Record-only payroll management) */}
      {showAddEmployee && (
        <AddEmployeeModal
          isOpen={showAddEmployee}
          loading={creatingEmployee}
          onClose={() => setShowAddEmployee(false)}
          onSubmit={async (data) => {
            try {
              await createEmployee({
                academyId,
                ...data,
                employeeType: "external",
              }).unwrap();
              toast.success("Employee added successfully");
              setShowAddEmployee(false);
            } catch (err: any) {
              toast.error(err?.data?.message || "Couldn't add employee — try again");
            }
          }}
        />
      )}

      {/* Add Operational Manager Modal (System Access Account + Linked Payroll) */}
      {showAddOperationalManager && (
        <AddOperationalManagerModal
          isOpen={showAddOperationalManager}
          loading={creatingUser}
          academyId={academyId}
          franchises={franchises ?? []}
          onClose={() => setShowAddOperationalManager(false)}
          onSubmit={async (data) => {
            try {
              await createUser({
                ...data,
                role: "operational_manager",
                academyId,
              }).unwrap();
              toast.success("Operational Manager account created successfully");
              setShowAddOperationalManager(false);
            } catch (err: any) {
              toast.error(err?.data?.message || "Couldn't create operational manager — try again");
            }
          }}
        />
      )}

      {/* Edit Employee Modal */}
      {editEmployee && (
        <EditEmployeeModal
          isOpen={!!editEmployee}
          employee={editEmployee}
          loading={updatingEmployee}
          onClose={() => setEditEmployee(null)}
          onSubmit={async (data) => {
            try {
              await updateEmployee({
                academyId,
                employeeId: editEmployee.id,
                data,
              }).unwrap();
              toast.success("Employee details updated");
              setEditEmployee(null);
            } catch (err: any) {
              toast.error(err?.data?.message || "Couldn't update employee — try again");
            }
          }}
        />
      )}

      {ConfirmDialog}
    </div>
  );
};

/* ─── Add Employee Modal ────────────────────────────────────────────── */
interface AddEmployeeModalProps {
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (data: {
    firstName: string;
    lastName: string;
    designation: string;
    salaryAmount: number;
    phone?: string;
    email?: string;
    notes?: string;
  }) => Promise<void>;
}

const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  loading,
  onClose,
  onSubmit,
}) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [designation, setDesignation] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      return toast.error("Please enter first and last name");
    }
    if (!designation.trim()) {
      return toast.error("Please enter a designation or job title");
    }
    const salary = Number(salaryAmount);
    if (isNaN(salary) || salary < 0) {
      return toast.error("Please enter a valid monthly salary amount");
    }

    await onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      designation: designation.trim(),
      salaryAmount: salary,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Employee" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-pitch-800/50 border border-slate-200 dark:border-white/10 text-2xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
          <Briefcase size={14} className="text-volt-500 shrink-0 mt-0.5" />
          <span>
            Record-only employee for salary and payroll management. No separate system login or account credentials are created.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. Rahul"
          />
          <Input
            label="Last Name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="e.g. Sharma"
          />
        </div>

        <Input
          label="Designation / Role Title"
          required
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          placeholder="e.g. Physiotherapist, Groundsman, Kit Manager, Admin"
        />

        <Input
          label="Monthly Salary (₹)"
          type="number"
          min="0"
          step="1"
          required
          value={salaryAmount}
          onChange={(e) => setSalaryAmount(e.target.value)}
          placeholder="e.g. 25000"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Phone (Optional)"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
          />
          <Input
            label="Email (Optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@example.com"
          />
        </div>

        <div>
          <label className="label">Notes / Remarks (Optional)</label>
          <input
            type="text"
            className="input text-xs"
            placeholder="e.g. Part-time matchday physiotherapist"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading} icon={<UserPlus size={14} />}>
            Create Employee
          </Button>
        </div>
      </form>
    </Modal>
  );
};

/* ─── Add Operational Manager Modal ─────────────────────────────────── */
interface AddOperationalManagerModalProps {
  isOpen: boolean;
  loading: boolean;
  academyId: string;
  franchises: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
    franchiseId?: string;
    salaryAmount?: number;
  }) => Promise<void>;
}

const AddOperationalManagerModal: React.FC<AddOperationalManagerModalProps> = ({
  isOpen,
  loading,
  franchises,
  onClose,
  onSubmit,
}) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [franchiseId, setFranchiseId] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let gen = "";
    for (let i = 0; i < 10; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(gen);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      return toast.error("Please enter first and last name");
    }
    if (!email.trim() || !email.includes("@")) {
      return toast.error("Please enter a valid login email");
    }
    if (!password || password.length < 8) {
      return toast.error("Password must be at least 8 characters");
    }
    if (!phone.trim()) {
      return toast.error("Please enter a contact phone number");
    }

    const salary = salaryAmount ? Number(salaryAmount) : 0;
    if (isNaN(salary) || salary < 0) {
      return toast.error("Please enter a valid salary amount");
    }

    await onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone.trim(),
      franchiseId: franchiseId || undefined,
      salaryAmount: salary,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Operational Manager" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Security & Access Notice */}
        <div className="p-3.5 rounded-xl bg-volt-500/10 border border-volt-500/20 text-slate-700 dark:text-slate-300 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-volt-600 dark:text-volt-400">
            <ShieldCheck size={16} />
            <span>Full Operational Access (Excluding Employees)</span>
          </div>
          <p className="text-2xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Operational Managers can manage teams, schedules, sessions, squads, coaches, fees, expenses, and settings just like an academy manager. To eliminate conflict of interest, they cannot view or manage the Employees & Payroll section.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. Vikram"
          />
          <Input
            label="Last Name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="e.g. Sethi"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Login Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ops.manager@academy.com"
          />
          <Input
            label="Phone Number"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
          />
        </div>

        {/* Password Field with toggle & generator */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="label">Account Password</label>
            <button
              type="button"
              onClick={handleGeneratePassword}
              className="text-2xs text-volt-600 dark:text-volt-400 hover:underline font-semibold"
            >
              Generate Strong Password
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pr-10 text-xs"
              placeholder="Minimum 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Select
              label="Assigned Franchise Scope"
              value={franchiseId}
              onChange={(e) => setFranchiseId(e.target.value)}
            >
              <option value="">Academy-wide (All Franchises)</option>
              {franchises.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
            <p className="text-2xs text-slate-400 dark:text-slate-500 mt-1">
              Select a specific franchise or leave academy-wide.
            </p>
          </div>

          <div>
            <Input
              label="Monthly Salary (₹)"
              type="number"
              min="0"
              step="1"
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              placeholder="e.g. 45000"
            />
            <p className="text-2xs text-slate-400 dark:text-slate-500 mt-1">
              Logged in the academy's payroll for monthly payout.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            icon={<ShieldCheck size={14} />}
          >
            Create Operational Manager
          </Button>
        </div>
      </form>
    </Modal>
  );
};

/* ─── Edit Employee Modal ────────────────────────────────────────────── */
interface EditEmployeeModalProps {
  isOpen: boolean;
  employee: Employee;
  loading: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Employee>) => Promise<void>;
}

const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  isOpen,
  employee,
  loading,
  onClose,
  onSubmit,
}) => {
  const [firstName, setFirstName] = useState(employee.firstName);
  const [lastName, setLastName] = useState(employee.lastName);
  const [designation, setDesignation] = useState(employee.designation || "");
  const [salaryAmount, setSalaryAmount] = useState(String(employee.salaryAmount));
  const [phone, setPhone] = useState(employee.phone || "");
  const [email, setEmail] = useState(employee.email || "");
  const [notes, setNotes] = useState(employee.notes || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      return toast.error("Please enter first and last name");
    }
    const salary = Number(salaryAmount);
    if (isNaN(salary) || salary < 0) {
      return toast.error("Please enter a valid monthly salary");
    }

    await onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      designation: designation.trim() || undefined,
      salaryAmount: salary,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Employee" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            label="Last Name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <Input
          label="Designation / Role Title"
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          placeholder="e.g. Coach, Physiotherapist, Operational Manager"
        />

        <Input
          label="Monthly Salary (₹)"
          type="number"
          min="0"
          step="1"
          required
          value={salaryAmount}
          onChange={(e) => setSalaryAmount(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Notes / Remarks</label>
          <input
            type="text"
            className="input text-xs"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EmployeesManagementPage;