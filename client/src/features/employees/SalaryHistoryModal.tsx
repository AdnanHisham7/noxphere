// src/features/employees/SalaryHistoryModal.tsx
import React, { useMemo } from "react";
import { clsx } from "clsx";
import {
  Calendar,
  CheckCircle2,
  Clock3,
  DollarSign,
  TrendingUp,
  X,
  FileText,
  UserCheck,
} from "lucide-react";
import { Modal, Badge, Skeleton, EmptyState, Button } from "../../components/ui";
import { useListSalaryHistoryQuery, type SalaryPayment } from "../../store/api/employeeApi";

interface SalaryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  academyId: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    designation?: string;
    salaryAmount?: number;
    phone?: string;
    email?: string;
  } | null;
}

export const SalaryHistoryModal: React.FC<SalaryHistoryModalProps> = ({
  isOpen,
  onClose,
  academyId,
  employee,
}) => {
  const { data: history, isLoading } = useListSalaryHistoryQuery(
    { academyId, employeeId: employee?.id ?? "" },
    { skip: !isOpen || !employee?.id || !academyId },
  );

  const currentPeriod = new Date().toISOString().slice(0, 7);

  // Filter out any future periods strictly: only past months up to current period
  const historyRecords = useMemo(
    () => (history ?? []).filter((r) => r.period <= currentPeriod),
    [history, currentPeriod],
  );

  const paidRecords = useMemo(
    () => historyRecords.filter((r) => r.status === "paid"),
    [historyRecords],
  );
  const pendingRecords = useMemo(
    () => historyRecords.filter((r) => r.status === "pending"),
    [historyRecords],
  );

  const totalPaid = useMemo(
    () => paidRecords.reduce((sum, r) => sum + r.amount, 0),
    [paidRecords],
  );
  const totalPending = useMemo(
    () => pendingRecords.reduce((sum, r) => sum + r.amount, 0),
    [pendingRecords],
  );

  if (!isOpen || !employee) return null;

  const initials = `${employee.firstName[0] || ""}${employee.lastName[0] || ""}`.toUpperCase();

  const formatPeriod = (periodStr: string) => {
    try {
      const [y, m] = periodStr.split("-").map(Number);
      const d = new Date(y, m - 1, 15);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return periodStr;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Salary Payout History" size="lg">
      <div className="space-y-4">
        {/* Employee Info Header */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-pitch-800/70 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-volt-500/10 text-volt-600 dark:text-volt-400 border border-volt-500/20 flex items-center justify-center font-bold text-sm shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {employee.firstName} {employee.lastName}
              </h4>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-2xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-volt-600 dark:text-volt-400">
                  {employee.designation || "Staff Member"}
                </span>
                {employee.salaryAmount !== undefined && (
                  <>
                    <span>•</span>
                    <span className="font-mono">
                      ₹{employee.salaryAmount.toLocaleString("en-IN")}/mo Base
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Paid & Pending Summary Stats (No Total Logged) */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
          <div className="p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-3xs uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400">
                Total Paid
              </span>
              <CheckCircle2 size={14} className="text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono font-bold text-base sm:text-lg text-emerald-600 dark:text-emerald-400">
                ₹{totalPaid.toLocaleString("en-IN")}
              </span>
              <span className="text-3xs text-emerald-600/70 dark:text-emerald-400/70">
                ({paidRecords.length} paid)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center justify-between">
              <span className="text-3xs uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-400">
                Pending Payout
              </span>
              <Clock3 size={14} className="text-amber-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono font-bold text-base sm:text-lg text-amber-600 dark:text-amber-400">
                ₹{totalPending.toLocaleString("en-IN")}
              </span>
              <span className="text-3xs text-amber-600/70 dark:text-amber-400/70">
                ({pendingRecords.length} pending)
              </span>
            </div>
          </div>
        </div>

        {/* Payout History Timeline / List */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Monthly Disbursement Timeline
            </span>
            <span className="text-3xs text-slate-400 dark:text-slate-500 font-mono">
              Newest first
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : !historyRecords.length ? (
            <div className="py-6 text-center rounded-xl bg-slate-50 dark:bg-pitch-800/40 border border-slate-200 dark:border-white/10">
              <Clock3 size={24} className="mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No salary records found
              </p>
              <p className="text-2xs text-slate-400 mt-0.5">
                Salary payouts logged in the Salary Tracker will appear here.
              </p>
            </div>
          ) : (
            <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
              {historyRecords.map((rec) => {
                const isPaid = rec.status === "paid";
                const paidByObj =
                  typeof rec.paidBy === "object" && rec.paidBy !== null
                    ? (rec.paidBy as any)
                    : null;
                const paidByName = paidByObj
                  ? `${paidByObj.firstName || ""} ${paidByObj.lastName || ""}`.trim()
                  : null;

                return (
                  <div
                    key={rec.id}
                    className="card p-3 rounded-xl border-slate-200/80 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-slate-300 dark:hover:border-white/15 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={clsx(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          isPaid
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {isPaid ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {formatPeriod(rec.period)}
                          </span>
                          <span className="text-3xs font-mono text-slate-400 dark:text-slate-500">
                            ({rec.period})
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {isPaid && rec.paidAt ? (
                            <span>
                              Disbursed on{" "}
                              {new Date(rec.paidAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Pending Payout
                            </span>
                          )}
                          {paidByName && (
                            <>
                              <span>•</span>
                              <span>by {paidByName}</span>
                            </>
                          )}
                        </div>
                        {rec.notes && (
                          <p className="text-3xs text-slate-500 dark:text-slate-400 italic mt-1 bg-slate-50 dark:bg-pitch-800/80 px-2 py-0.5 rounded border border-slate-200/60 dark:border-white/5 inline-block">
                            Note: {rec.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 self-end sm:self-auto w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-white/5">
                      <div className="text-left sm:text-right">
                        <span
                          className={clsx(
                            "text-sm font-bold font-mono block",
                            isPaid
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          ₹{rec.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <Badge variant={isPaid ? "green" : "yellow"} className="!text-3xs !py-0.5 !px-2">
                        {isPaid ? "Paid" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
