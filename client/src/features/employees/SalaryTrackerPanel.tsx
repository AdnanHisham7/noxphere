// src/features/employees/SalaryTrackerPanel.tsx
import React, { useState, useMemo, useEffect } from "react";
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
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import { Badge, Button, Skeleton, EmptyState, Modal, Input } from "../../components/ui";
import {
  useListSalaryForPeriodQuery,
  useMarkSalaryPaidMutation,
  type SalaryPayment,
} from "../../store/api/employeeApi";
import { useCurrency } from "../../hooks/useCurrency";
import { SalaryHistoryModal } from "./SalaryHistoryModal";

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

interface MarkPaidModalProps {
  isOpen: boolean;
  record: SalaryPayment | null;
  periodLabel: string;
  onClose: () => void;
  onConfirm: (salaryPaymentId: string, amount: number, notes?: string) => Promise<void>;
  loading: boolean;
}

const MarkPaidModal: React.FC<MarkPaidModalProps> = ({
  isOpen,
  record,
  periodLabel,
  onClose,
  onConfirm,
  loading,
}) => {
  const { currencySymbol, format } = useCurrency();
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (record) {
      setAmount(String(record.amount));
      setNotes(record.notes || "");
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const emp = typeof record.employeeId === "object" ? record.employeeId : null;
  const employeeName = emp ? `${emp.firstName} ${emp.lastName}` : "Employee";
  const defaultAmount = record.amount;
  const currentAmountNum = Number(amount) || 0;
  const diff = currentAmountNum - defaultAmount;
  const designation =
    emp?.designation ||
    (emp && typeof emp.roleId === "object" ? emp.roleId?.name : (emp?.employeeType === "staff" ? "Staff" : "Employee"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(currentAmountNum) || currentAmountNum < 0) {
      toast.error("Please enter a valid salary amount");
      return;
    }
    await onConfirm(record.id, currentAmountNum, notes.trim() || undefined);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settle Salary Payment" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Employee Summary Card */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-pitch-800/60 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-white dark:bg-pitch-700 border border-slate-200 dark:border-white/10 flex items-center justify-center font-bold text-xs text-slate-800 dark:text-white shrink-0">
              {emp ? `${emp.firstName[0]}${emp.lastName[0]}`.toUpperCase() : "EM"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {employeeName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 text-2xs text-slate-500 dark:text-slate-400">
                <span className="font-medium text-volt-600 dark:text-volt-400">{designation}</span>
                <span>•</span>
                <span>{periodLabel}</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xs uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Base Salary</span>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
              {format(defaultAmount)}
            </span>
          </div>
        </div>

        {/* Amount Input with Live Difference Chip */}
        <div className="space-y-1.5">
          <Input
            label={`Paid Amount (${currencySymbol})`}
            type="number"
            min="0"
            step="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 25000"
          />

          <div className="flex items-center justify-between text-2xs pt-1">
            {diff > 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <TrendingUp size={12} />
                +{format(diff)} performance incentive / bonus included
              </span>
            ) : diff < 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <TrendingDown size={12} />
                -{format(Math.abs(diff))} deduction applied
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Info size={11} />
                Matches monthly default salary
              </span>
            )}
            <button
              type="button"
              onClick={() => setAmount(String(defaultAmount))}
              className="text-volt-600 dark:text-volt-400 hover:underline font-semibold"
            >
              Reset to Base
            </button>
          </div>
        </div>

        {/* Optional Notes */}
        <div>
          <label className="label">Notes / Remarks (Optional)</label>
          <input
            type="text"
            className="input text-xs"
            placeholder={`e.g. Added ${format(2000)} performance bonus for tournament victory`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
          <p className="text-2xs text-slate-400 dark:text-slate-500 mt-1">
            Notes will be attached to this month's payroll ledger record.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading} icon={<CheckCircle2 size={14} />}>
            Confirm Payout
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export const SalaryTrackerPanel: React.FC<{ academyId: string }> = ({ academyId }) => {
  const { format } = useCurrency();
  const [period, setPeriod] = useState(currentPeriod());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");
  const [payingRecord, setPayingRecord] = useState<SalaryPayment | null>(null);
  const [historyEmployee, setHistoryEmployee] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    designation?: string;
    salaryAmount?: number;
    phone?: string;
    email?: string;
  } | null>(null);

  const { data: records, isLoading } = useListSalaryForPeriodQuery({ academyId, period });
  const [markPaid, { isLoading: marking }] = useMarkSalaryPaidMutation();

  const handleConfirmPayout = async (salaryPaymentId: string, amount: number, notes?: string) => {
    try {
      await markPaid({
        academyId,
        salaryPaymentId,
        amount,
        notes,
      }).unwrap();
      toast.success("Salary payment marked as paid");
      setPayingRecord(null);
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update salary payment — try again");
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
      const designation = (
        emp?.designation ||
        (emp && typeof emp.roleId === "object"
          ? emp.roleId?.name
          : emp?.employeeType === "staff"
          ? "Staff"
          : "Employee")
      ).toLowerCase();
      const term = searchTerm.toLowerCase().trim();

      return fullName.includes(term) || designation.includes(term);
    });
  }, [allRecords, statusFilter, searchTerm]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Month Navigator Toolbar */}
      <div className="bg-white dark:bg-pitch-900/90 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-start">
          <div className="flex items-center bg-slate-100 dark:bg-pitch-800 rounded-lg p-1 border border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="p-1.5 rounded hover:bg-white dark:hover:bg-pitch-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5 px-2 sm:px-3">
              <Calendar size={14} className="text-volt-500 shrink-0" />
              <span className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-white min-w-[110px] sm:min-w-[130px] text-center">
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
              "px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors",
              period === currentPeriod()
                ? "bg-volt-500/10 border-volt-500/30 text-volt-600 dark:text-volt-400"
                : "bg-slate-100 dark:bg-pitch-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Current Month
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-white/5">
          <label className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0 flex items-center gap-1.5">
            <Calendar size={14} className="text-volt-500" />
            <span>Direct Jump:</span>
          </label>
          <div className="relative inline-flex items-center">
            <input
              type="month"
              value={period}
              onChange={(e) => e.target.value && setPeriod(e.target.value)}
              className="text-xs py-1.5 px-2.5 sm:px-3 bg-slate-50 dark:bg-pitch-950 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-lg focus:ring-1 focus:ring-volt-400 focus:outline-none dark:[color-scheme:dark] [color-scheme:light] [&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards (Optimized 2-in-a-row on mobile, 3-in-a-row on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="card p-3 sm:p-4 rounded-xl border-slate-200/80 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-2xs sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Total Payroll
            </span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <DollarSign size={14} />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
            <span className="text-base sm:text-xl font-bold font-display text-slate-900 dark:text-white font-mono">
              {format(totalPayroll)}
            </span>
            <span className="text-3xs sm:text-xs text-slate-500 dark:text-slate-400">
              ({allRecords.length} staff)
            </span>
          </div>
        </div>

        <div className="card p-3 sm:p-4 rounded-xl border-slate-200/80 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-2xs sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Disbursed (Paid)
            </span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
            <span className="text-base sm:text-xl font-bold font-display text-emerald-600 dark:text-emerald-400 font-mono">
              {format(totalPaid)}
            </span>
            <span className="text-3xs sm:text-xs text-slate-500 dark:text-slate-400">
              ({paidRecords.length} paid)
            </span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 card p-3 sm:p-4 rounded-xl border-slate-200/80 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-2xs sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Pending Payout
            </span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <AlertCircle size={14} />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
            <span className="text-base sm:text-xl font-bold font-display text-amber-600 dark:text-amber-400 font-mono">
              {format(totalPending)}
            </span>
            <span className="text-3xs sm:text-xs text-slate-500 dark:text-slate-400">
              ({pendingRecords.length} pending)
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar (Responsive full width / grid segmented control) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee or designation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-volt-400 transition-colors"
          />
        </div>

        <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-slate-100 dark:bg-pitch-800 p-1 rounded-lg border border-slate-200 dark:border-white/10 w-full sm:w-auto">
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
                  "px-2 sm:px-3 py-1.5 text-2xs sm:text-xs font-semibold rounded-md transition-all capitalize flex items-center justify-center gap-1.5",
                  statusFilter === filter
                    ? "bg-white dark:bg-pitch-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <span>{filter}</span>
                <span
                  className={clsx(
                    "text-3xs px-1.5 py-0.2 rounded-full",
                    statusFilter === filter
                      ? "bg-slate-100 dark:bg-pitch-800 text-slate-700 dark:text-slate-300"
                      : "bg-slate-200/60 dark:bg-pitch-700/80 text-slate-500 dark:text-slate-400"
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
        <div className="card rounded-xl border border-slate-200/80 dark:border-white/5 shadow-sm divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
          {filteredRecords.map((rec) => {
            const emp = typeof rec.employeeId === "object" ? rec.employeeId : null;
            const designation =
              emp?.designation ||
              (emp && typeof emp.roleId === "object"
                ? emp.roleId?.name
                : emp?.employeeType === "staff"
                ? "Staff"
                : "Employee");

            const isCoach = designation.toLowerCase().includes("coach");
            const isOpManager = designation.toLowerCase().includes("operational manager");

            return (
              <div
                key={rec.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-pitch-700/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-pitch-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0 border border-slate-200 dark:border-white/10">
                    {emp ? `${emp.firstName[0]}${emp.lastName[0]}`.toUpperCase() : "EM"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {emp ? `${emp.firstName} ${emp.lastName}` : "Employee"}
                    </p>
                    <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
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
                      <span>{emp?.employeeType === "staff" ? "System Access" : "Payroll Only"}</span>
                      {emp?.phone && (
                        <>
                          <span>•</span>
                          <span>{emp.phone}</span>
                        </>
                      )}
                    </div>
                    {rec.notes && rec.status === "paid" && (
                      <p className="text-2xs text-slate-500 dark:text-slate-400 italic mt-1 bg-slate-50 dark:bg-pitch-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-white/5 inline-block">
                        Remark: {rec.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 sm:gap-3 self-end sm:self-auto w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-white/5">
                  <div className="text-left sm:text-right">
                    <span className="text-sm font-bold text-slate-900 dark:text-white block font-mono">
                      {format(rec.amount)}
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

                  <Badge variant={rec.status === "paid" ? "green" : "yellow"} className="!text-3xs !py-0.5 !px-2">
                    {rec.status === "paid" ? "Paid" : "Pending"}
                  </Badge>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Clock3 size={13} />}
                      onClick={() => {
                        if (emp) {
                          setHistoryEmployee({
                            id: (emp as any).id || (emp as any)._id || (typeof rec.employeeId === "string" ? rec.employeeId : (emp as any).id),
                            firstName: emp.firstName,
                            lastName: emp.lastName,
                            designation,
                            salaryAmount: rec.amount,
                            phone: emp.phone,
                            email: emp.email,
                          });
                        }
                      }}
                      className="border-slate-300 dark:border-white/10 hover:border-slate-400 text-slate-600 dark:text-slate-300 !py-1 !px-2 text-xs"
                      title="View payout history"
                    >
                      History
                    </Button>

                    {rec.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<CheckCircle2 size={13} />}
                        onClick={() => setPayingRecord(rec)}
                        className="border-slate-300 dark:border-white/10 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors !py-1 !px-2.5 text-xs"
                      >
                        Mark Paid
                      </Button>
                    ) : (
                      <div className="min-w-[65px] text-right flex items-center justify-end gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 size={14} />
                        <span>Settled</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settle Payout Modal */}
      <MarkPaidModal
        isOpen={!!payingRecord}
        record={payingRecord}
        periodLabel={formattedMonthLabel}
        onClose={() => setPayingRecord(null)}
        onConfirm={handleConfirmPayout}
        loading={marking}
      />

      {/* Salary History Modal */}
      <SalaryHistoryModal
        isOpen={!!historyEmployee}
        employee={historyEmployee}
        academyId={academyId}
        onClose={() => setHistoryEmployee(null)}
      />
    </div>
  );
};