// src/features/employees/SalaryTrackerPanel.tsx
import React, { useState, useMemo } from "react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import {
  CheckCircle2,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  DollarSign,
  Wallet,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Badge, Button, Skeleton, EmptyState } from "../../components/ui";
import { useConfirm } from "../../hooks/useConfirm";
import { useListSalaryForPeriodQuery, useMarkSalaryPaidMutation } from "../../store/api/employeeApi";

const currentPeriod = () => new Date().toISOString().slice(0, 7);

export const SalaryTrackerPanel: React.FC<{ academyId: string }> = ({ academyId }) => {
  const [period, setPeriod] = useState(currentPeriod());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");

  const { data: records, isLoading } = useListSalaryForPeriodQuery({ academyId, period });
  const [markPaid, { isLoading: marking }] = useMarkSalaryPaidMutation();
  const { confirm, ConfirmDialog } = useConfirm();

  const handleMarkPaid = async (salaryPaymentId: string, name: string) => {
    const ok = await confirm({
      title: "Mark salary as paid",
      message: `Mark ${name}'s salary for ${period} as paid? This is a record-keeping action only — no payment is actually processed.`,
      confirmLabel: "Mark as paid",
    });
    if (!ok) return;
    try {
      await markPaid({ academyId, salaryPaymentId }).unwrap();
      toast.success("Marked as paid");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update — try again");
    }
  };

  const shiftPeriod = (deltaMonths: number) => {
    const [y, m] = period.split("-").map(Number);
    let newM = m + deltaMonths;
    let newY = y;
    while (newM > 12) {
      newM -= 12;
      newY += 1;
    }
    while (newM < 1) {
      newM += 12;
      newY -= 1;
    }
    setPeriod(`${newY}-${String(newM).padStart(2, "0")}`);
  };

  const setThisMonth = () => setPeriod(currentPeriod());

  const formattedMonthLabel = useMemo(() => {
    try {
      const [y, m] = period.split("-").map(Number);
      const d = new Date(y, m - 1, 15);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return period;
    }
  }, [period]);

  const allRecords = records ?? [];
  const pendingRecords = useMemo(() => allRecords.filter((r) => r.status === "pending"), [allRecords]);
  const paidRecords = useMemo(() => allRecords.filter((r) => r.status === "paid"), [allRecords]);

  const totalPending = useMemo(() => pendingRecords.reduce((sum, r) => sum + r.amount, 0), [pendingRecords]);
  const totalPaid = useMemo(() => paidRecords.reduce((sum, r) => sum + r.amount, 0), [paidRecords]);
  const totalPayroll = useMemo(() => allRecords.reduce((sum, r) => sum + r.amount, 0), [allRecords]);

  const filteredRecords = useMemo(() => {
    return allRecords.filter((rec) => {
      if (statusFilter !== "all" && rec.status !== statusFilter) return false;
      if (!searchTerm.trim()) return true;

      const emp = typeof rec.employeeId === "object" ? rec.employeeId : null;
      const fullName = emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : "employee";
      const roleName = (emp && typeof emp.roleId === "object" ? emp.roleId?.name : (emp?.employeeType === "staff" ? "Staff" : "External")).toLowerCase();
      const term = searchTerm.toLowerCase().trim();

      return fullName.includes(term) || roleName.includes(term);
    });
  }, [allRecords, statusFilter, searchTerm]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Month Navigator Toolbar */}
      <div className="bg-white dark:bg-pitch-900/80 p-4 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-pitch-800 rounded-lg p-1 border border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="p-1.5 rounded hover:bg-white dark:hover:bg-pitch-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 px-3">
              <Calendar size={15} className="text-volt-500" />
              <span className="font-semibold text-sm text-slate-800 dark:text-white min-w-[130px] text-center">
                {formattedMonthLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="p-1.5 rounded hover:bg-white dark:hover:bg-pitch-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={setThisMonth}
            className={clsx(
              "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors",
              period === currentPeriod()
                ? "bg-volt-500/10 border-volt-500/30 text-volt-600 dark:text-volt-400"
                : "bg-slate-100 dark:bg-pitch-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Current Month
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">Direct Jump:</label>
          <input
            type="month"
            value={period}
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
            className="input text-xs py-1 px-2.5 bg-slate-50 dark:bg-pitch-950 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-pitch-900/80 border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Payroll
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-slate-900 dark:text-white">
              ₹{totalPayroll.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({allRecords.length} staff)
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-pitch-900/80 border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Disbursed (Paid)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              ₹{totalPaid.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({paidRecords.length} paid)
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-pitch-900/80 border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pending Payout
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-display text-amber-600 dark:text-amber-400">
              ₹{totalPending.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({pendingRecords.length} pending)
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-volt-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-pitch-900 p-1 rounded-lg border border-slate-200 dark:border-white/10 self-start sm:self-auto">
          {(["all", "pending", "paid"] as const).map((filter) => {
            const count =
              filter === "all"
                ? allRecords.length
                : filter === "pending"
                ? pendingRecords.length
                : paidRecords.length;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={clsx(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize flex items-center gap-1.5",
                  statusFilter === filter
                    ? "bg-white dark:bg-pitch-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <span>{filter}</span>
                <span
                  className={clsx(
                    "text-2xs px-1.5 py-0.2 rounded-full",
                    statusFilter === filter
                      ? "bg-slate-100 dark:bg-pitch-700 text-slate-700 dark:text-slate-300"
                      : "bg-slate-200/60 dark:bg-pitch-800/80 text-slate-500 dark:text-slate-400"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Record List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : !allRecords.length ? (
        <EmptyState
          icon={<Clock3 size={28} />}
          title="No employees recorded for this period"
          description={`No payroll records found for ${formattedMonthLabel}. Employees configured under the Employees tab will appear here.`}
        />
      ) : !filteredRecords.length ? (
        <EmptyState
          icon={<Search size={28} />}
          title="No matching records"
          description="No employee payroll records match your active search or filter criteria."
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
              }}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        <div className="bg-white dark:bg-pitch-900/90 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
          {filteredRecords.map((rec) => {
            const emp = typeof rec.employeeId === "object" ? rec.employeeId : null;
            const roleName =
              emp && typeof emp.roleId === "object"
                ? emp.roleId?.name
                : emp?.employeeType === "staff"
                ? "Staff"
                : "External";

            return (
              <div
                key={rec.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-pitch-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-pitch-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0">
                    {emp ? `${emp.firstName[0]}${emp.lastName[0]}`.toUpperCase() : "EM"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {emp ? `${emp.firstName} ${emp.lastName}` : "Employee"}
                    </p>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span
                        className={clsx(
                          "font-semibold",
                          roleName === "Coach"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-blue-600 dark:text-blue-400"
                        )}
                      >
                        {roleName}
                      </span>
                      <span>·</span>
                      <span>{emp?.employeeType === "staff" ? "System Access" : "External / On-field"}</span>
                      {(emp as any)?.phone && (
                        <>
                          <span>·</span>
                          <span>{(emp as any).phone}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-white/5">
                  <div className="text-left sm:text-right">
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">
                      ₹{rec.amount.toLocaleString("en-IN")}
                    </span>
                    <span className="text-2xs text-slate-400 dark:text-slate-500">
                      {rec.status === "paid" && rec.paidAt
                        ? `Paid on ${new Date(rec.paidAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}`
                        : "Due for period"}
                    </span>
                  </div>

                  <Badge variant={rec.status === "paid" ? "green" : "yellow"}>
                    {rec.status === "paid" ? "Paid" : "Pending"}
                  </Badge>

                  {rec.status === "pending" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<CheckCircle2 size={13} />}
                      loading={marking}
                      onClick={() =>
                        handleMarkPaid(
                          rec.id,
                          emp ? `${emp.firstName} ${emp.lastName}` : "this employee"
                        )
                      }
                      className="border-slate-300 dark:border-white/10 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      Mark Paid
                    </Button>
                  ) : (
                    <div className="w-[88px] text-right flex items-center justify-end gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                      <CheckCircle2 size={14} />
                      <span>Settled</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
};