// src/features/fees/components/FeeReportsView.tsx
import React, { useState, useMemo } from "react";
import { clsx } from "clsx";
import {
  FileText,
  Calendar,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Percent,
  Search,
  Users,
  Printer,
  ChevronDown,
  Info,
} from "lucide-react";
import { Badge, Button } from "../../../components/ui";
import { formatCurrency } from "../../../utils/currency";
import type { AdminFeeRecord, FeeInstallment } from "../../../store/api/adminFeesApi";

export interface FeeReportsViewProps {
  fees: AdminFeeRecord[];
  currencySymbol: string;
  defaultCurrency?: string;
  onSelectStudent?: (studentId: string) => void;
}

type PeriodType =
  | "all"
  | "month_single"
  | "last_3_months"
  | "last_4_months"
  | "last_x_months"
  | "custom";

type StatusCategory = "all" | "paid" | "unpaid" | "partial" | "overdue";

interface FlattenedInstallmentRow {
  feeId: string;
  studentId: string;
  studentName: string;
  feeType: string;
  installmentNumber: number;
  dueDate: Date;
  dueDateStr: string;
  dueMonthKey: string; // YYYY-MM
  amount: number;
  paidAmount: number;
  balance: number;
  status: string; // "paid" | "partial" | "pending" | "overdue" | "pending_verification"
  paidAt?: Date;
  paymentMethod?: string;
  currency?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const FeeReportsView: React.FC<FeeReportsViewProps> = ({
  fees,
  currencySymbol,
  defaultCurrency = "INR",
  onSelectStudent,
}) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Filters State
  const [periodType, setPeriodType] = useState<PeriodType>("last_3_months");
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [customXMonths, setCustomXMonths] = useState<number>(6);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [statusCategory, setStatusCategory] = useState<StatusCategory>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFeeType, setSelectedFeeType] = useState<string>("all");

  // Flatten all installments for granular reporting
  const allInstallments = useMemo(() => {
    const rows: FlattenedInstallmentRow[] = [];
    for (const f of fees) {
      const studentName = f.studentId
        ? `${f.studentId.firstName || ""} ${f.studentId.lastName || ""}`.trim() || "Player"
        : "Unknown Player";
      const sId = typeof f.studentId === "object" ? f.studentId?._id : (f.studentId || "");

      for (const inst of f.installments || []) {
        const dueDate = new Date(inst.dueDate);
        const paid = inst.paidAmount || 0;
        const bal = Math.max(0, inst.amount - paid);
        const isPastDue = dueDate.getTime() < Date.now() && inst.status !== "paid";

        let computedStatus = inst.status;
        if (computedStatus === "pending" && isPastDue) {
          computedStatus = "overdue";
        }

        const y = dueDate.getFullYear();
        const m = String(dueDate.getMonth() + 1).padStart(2, "0");
        const dueMonthKey = `${y}-${m}`;

        rows.push({
          feeId: f._id,
          studentId: sId,
          studentName,
          feeType: f.feeType,
          installmentNumber: inst.installmentNumber,
          dueDate,
          dueDateStr: dueDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          dueMonthKey,
          amount: inst.amount,
          paidAmount: paid,
          balance: bal,
          status: computedStatus,
          paidAt: inst.paidAt ? new Date(inst.paidAt) : undefined,
          paymentMethod: inst.paymentMethod,
          currency: (f as any).currency || defaultCurrency,
        });
      }
    }
    return rows;
  }, [fees, defaultCurrency]);

  // Available unique years from data + reasonable range
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear - 1, currentYear, currentYear + 1]);
    for (const row of allInstallments) {
      years.add(row.dueDate.getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [allInstallments, currentYear]);

  // Compute Active Date Range Window
  const dateRangeWindow = useMemo(() => {
    const nowDate = new Date();
    if (periodType === "all") {
      return { start: null, end: null, label: "All Time (Complete History)" };
    }
    if (periodType === "month_single") {
      const start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
      const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
      return {
        start,
        end,
        label: `${MONTH_NAMES[selectedMonth]} ${selectedYear}`,
      };
    }
    if (periodType === "last_3_months") {
      const start = new Date(nowDate.getFullYear(), nowDate.getMonth() - 2, 1, 0, 0, 0, 0);
      const end = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        start,
        end,
        label: `Last 3 Months (${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()} – ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()})`,
      };
    }
    if (periodType === "last_4_months") {
      const start = new Date(nowDate.getFullYear(), nowDate.getMonth() - 3, 1, 0, 0, 0, 0);
      const end = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        start,
        end,
        label: `Last 4 Months (${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()} – ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()})`,
      };
    }
    if (periodType === "last_x_months") {
      const months = Math.max(1, customXMonths || 1);
      const start = new Date(nowDate.getFullYear(), nowDate.getMonth() - (months - 1), 1, 0, 0, 0, 0);
      const end = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        start,
        end,
        label: `Last ${months} Months (${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()} – ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()})`,
      };
    }
    if (periodType === "custom") {
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : null;
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59`) : null;
      return {
        start,
        end,
        label: `Custom: ${customStartDate || "Start"} to ${customEndDate || "Present"}`,
      };
    }
    return { start: null, end: null, label: "Overview" };
  }, [
    periodType,
    selectedMonth,
    selectedYear,
    customXMonths,
    customStartDate,
    customEndDate,
  ]);

  // Filter Installments by Date Window, Status Category, Fee Type, and Search
  const filteredRows = useMemo(() => {
    return allInstallments.filter((row) => {
      // Date Window filter (checking dueDate or paidAt depending on status)
      if (dateRangeWindow.start && row.dueDate < dateRangeWindow.start) return false;
      if (dateRangeWindow.end && row.dueDate > dateRangeWindow.end) return false;

      // Status filter
      if (statusCategory === "paid" && row.status !== "paid") return false;
      if (statusCategory === "unpaid" && row.status === "paid") return false; // includes pending, partial, overdue
      if (statusCategory === "partial" && row.status !== "partial") return false;
      if (statusCategory === "overdue" && row.status !== "overdue") return false;

      // Fee Type filter
      if (selectedFeeType !== "all" && row.feeType !== selectedFeeType) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = row.studentName.toLowerCase().includes(q);
        const matchesType = row.feeType.toLowerCase().includes(q);
        const matchesMethod = (row.paymentMethod || "").toLowerCase().includes(q);
        if (!matchesName && !matchesType && !matchesMethod) return false;
      }

      return true;
    });
  }, [allInstallments, dateRangeWindow, statusCategory, selectedFeeType, searchQuery]);

  // Summary Metrics for the Active Report
  const reportMetrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    const studentsWithBalance = new Set<string>();
    const uniqueStudents = new Set<string>();

    const paymentMethodTotals: Record<string, number> = {};

    for (const r of filteredRows) {
      totalInvoiced += r.amount;
      totalCollected += r.paidAmount;
      totalOutstanding += r.balance;
      uniqueStudents.add(r.studentId);

      if (r.status === "overdue") {
        totalOverdue += r.balance;
      }
      if (r.balance > 0) {
        studentsWithBalance.add(r.studentId);
      }

      if (r.paidAmount > 0 && r.paymentMethod) {
        const methodKey = r.paymentMethod.toLowerCase();
        paymentMethodTotals[methodKey] = (paymentMethodTotals[methodKey] || 0) + r.paidAmount;
      }
    }

    const collectionRate =
      totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

    return {
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      totalOverdue,
      collectionRate,
      studentCount: uniqueStudents.size,
      studentsWithBalanceCount: studentsWithBalance.size,
      paymentMethodTotals,
    };
  }, [filteredRows]);

  // Monthly breakdown inside the selected range
  const monthlyBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        monthKey: string;
        label: string;
        invoiced: number;
        collected: number;
        outstanding: number;
        overdue: number;
        count: number;
      }
    >();

    for (const r of filteredRows) {
      let item = map.get(r.dueMonthKey);
      if (!item) {
        const [y, m] = r.dueMonthKey.split("-").map(Number);
        const monthName = MONTH_NAMES[(m || 1) - 1] || "";
        item = {
          monthKey: r.dueMonthKey,
          label: `${monthName} ${y}`,
          invoiced: 0,
          collected: 0,
          outstanding: 0,
          overdue: 0,
          count: 0,
        };
        map.set(r.dueMonthKey, item);
      }
      item.invoiced += r.amount;
      item.collected += r.paidAmount;
      item.outstanding += r.balance;
      if (r.status === "overdue") item.overdue += r.balance;
      item.count++;
    }

    return Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredRows]);

  // CSV Export Handler
  const exportToCsv = () => {
    if (filteredRows.length === 0) return;
    const headers = [
      "Player Name",
      "Fee Type",
      "Milestone",
      "Due Date",
      "Total Amount",
      "Paid Amount",
      "Balance Due",
      "Status",
      "Payment Method",
    ];

    const rowsData = filteredRows.map((r) => [
      `"${r.studentName.replace(/"/g, '""')}"`,
      `"${r.feeType}"`,
      `"Milestone ${r.installmentNumber}"`,
      `"${r.dueDateStr}"`,
      r.amount,
      r.paidAmount,
      r.balance,
      `"${r.status}"`,
      `"${r.paymentMethod || "N/A"}"`,
    ]);

    const csvContent = [headers.join(","), ...rowsData.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `fees-report-${dateRangeWindow.label.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick Preset Selection Helper
  const setMonthPreset = (monthIdx: number, year: number) => {
    setPeriodType("month_single");
    setSelectedMonth(monthIdx);
    setSelectedYear(year);
  };

  return (
    <div className="space-y-6">
      {/* ─── Report Configuration Card ────────────────────────────────────── */}
      <div className="card p-4 sm:p-5 border border-slate-200 dark:border-white/5 space-y-4 shadow-sm bg-white dark:bg-pitch-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-volt-400/10 border border-volt-400/20 flex items-center justify-center text-volt-500 dark:text-volt-400">
              <TrendingUp size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-display">
                Interactive Financial Reports &amp; Analytics
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Generate monthly, quarterly, customized rolling ranges, or status-based audit reports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer size={13} />}
              onClick={() => window.print()}
              className="text-xs"
            >
              Print
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Download size={13} />}
              onClick={exportToCsv}
              disabled={filteredRows.length === 0}
              className="text-xs bg-volt-400 hover:bg-volt-300 text-pitch-950 font-bold"
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-widest mr-1">
              Timeframe:
            </span>
            {[
              { id: "last_3_months" as const, label: "Last 3 Months" },
              { id: "last_4_months" as const, label: "Last 4 Months" },
              { id: "last_x_months" as const, label: `Last ${customXMonths} Months (Custom)` },
              { id: "month_single" as const, label: "Specific Month" },
              { id: "custom" as const, label: "Date Range" },
              { id: "all" as const, label: "All Time" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriodType(tab.id)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                  periodType === tab.id
                    ? "bg-volt-400 text-pitch-950 border-volt-400 shadow-xs"
                    : "bg-slate-50 dark:bg-pitch-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/5 hover:border-volt-400/50",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sub-controls based on period type */}
          {periodType === "month_single" && (
            <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-slate-50 dark:bg-pitch-800/60 border border-slate-200 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="input !py-1 text-xs bg-white dark:bg-pitch-800 font-semibold"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={idx} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="input !py-1 text-xs bg-white dark:bg-pitch-800 font-semibold"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Jump Shortcuts for Common Requests */}
              <div className="flex items-center gap-1.5 ml-auto flex-wrap text-2xs">
                <span className="text-slate-400">Quick jumps:</span>
                <button
                  type="button"
                  onClick={() => setMonthPreset(8, currentYear)} // September
                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-pitch-700 hover:text-volt-400 transition-colors"
                >
                  September {currentYear}
                </button>
                <button
                  type="button"
                  onClick={() => setMonthPreset(10, currentYear)} // November
                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-pitch-700 hover:text-volt-400 transition-colors"
                >
                  November {currentYear}
                </button>
                <button
                  type="button"
                  onClick={() => setMonthPreset(currentMonth, currentYear)}
                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-pitch-700 hover:text-volt-400 transition-colors"
                >
                  This Month
                </button>
              </div>
            </div>
          )}

          {periodType === "last_x_months" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-pitch-800/60 border border-slate-200 dark:border-white/5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Number of Months (X):
              </span>
              <div className="flex items-center gap-2">
                {[2, 3, 4, 5, 6, 8, 12].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCustomXMonths(num)}
                    className={clsx(
                      "w-7 h-7 rounded text-xs font-bold font-mono transition-colors border",
                      customXMonths === num
                        ? "bg-volt-400 text-pitch-950 border-volt-400"
                        : "bg-white dark:bg-pitch-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-volt-400",
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <span className="text-2xs text-slate-400 ml-2">
                Calculates milestones due within the last {customXMonths} months.
              </span>
            </div>
          )}

          {periodType === "custom" && (
            <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-slate-50 dark:bg-pitch-800/60 border border-slate-200 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="input !py-1 text-xs bg-white dark:bg-pitch-800"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="input !py-1 text-xs bg-white dark:bg-pitch-800"
                />
              </div>
            </div>
          )}

          {/* Status Filter Row */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-widest mr-1">
              Payment Status:
            </span>
            {[
              { id: "all" as const, label: "Overall (All Records)" },
              { id: "paid" as const, label: "Paid Only" },
              { id: "unpaid" as const, label: "Unpaid / Outstanding" },
              { id: "partial" as const, label: "Partially Paid" },
              { id: "overdue" as const, label: "Overdue Only" },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setStatusCategory(btn.id)}
                className={clsx(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors border",
                  statusCategory === btn.id
                    ? "bg-slate-900 dark:bg-white text-white dark:text-pitch-950 font-bold border-transparent"
                    : "bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-pitch-800",
                )}
              >
                {btn.label}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <div className="relative min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search player, method..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input !pl-8 !py-1 text-xs w-full bg-slate-50 dark:bg-pitch-800"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Active Report Header & Metric Strip ─────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Report Summary: <span className="text-volt-500 dark:text-volt-400 font-display">{dateRangeWindow.label}</span>
            </h4>
            <Badge variant="gray" size="sm">
              {filteredRows.length} milestone{filteredRows.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-4 bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/5">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
              Total Invoiced
            </span>
            <p className="text-2xl font-extrabold font-display text-slate-900 dark:text-white mt-1">
              {formatCurrency(reportMetrics.totalInvoiced, defaultCurrency)}
            </p>
            <span className="text-2xs text-slate-400">
              Across {reportMetrics.studentCount} unique player{reportMetrics.studentCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="card p-4 bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-emerald-400">
                Collected
              </span>
              <span className="text-2xs font-bold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">
                {reportMetrics.collectionRate}%
              </span>
            </div>
            <p className="text-2xl font-extrabold font-display text-emerald-400 mt-1">
              {formatCurrency(reportMetrics.totalCollected, defaultCurrency)}
            </p>
            <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1 mt-2 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, reportMetrics.collectionRate)}%` }}
              />
            </div>
          </div>

          <div className="card p-4 bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/5">
            <span className="text-2xs font-bold uppercase tracking-wider text-amber-400">
              Outstanding Balance
            </span>
            <p className="text-2xl font-extrabold font-display text-amber-400 mt-1">
              {formatCurrency(reportMetrics.totalOutstanding, defaultCurrency)}
            </p>
            <span className="text-2xs text-slate-400">
              {reportMetrics.studentsWithBalanceCount} player{reportMetrics.studentsWithBalanceCount === 1 ? "" : "s"} with dues
            </span>
          </div>

          <div className="card p-4 bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-rose-400">
                Overdue Unpaid
              </span>
              {reportMetrics.totalOverdue > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              )}
            </div>
            <p className="text-2xl font-extrabold font-display text-rose-400 mt-1">
              {formatCurrency(reportMetrics.totalOverdue, defaultCurrency)}
            </p>
            <span className="text-2xs text-rose-400/80 font-mono">
              Actionable past-due payments
            </span>
          </div>
        </div>
      </div>

      {/* ─── Monthly Aggregation Trend Breakdown ───────────────────────── */}
      {monthlyBreakdown.length > 1 && (
        <div className="card p-4 border border-slate-200 dark:border-white/5 bg-white dark:bg-pitch-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar size={14} className="text-volt-400" />
              <span>Month-by-Month Breakdown</span>
            </h4>
            <span className="text-2xs text-slate-400">
              {monthlyBreakdown.length} months captured in this range
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {monthlyBreakdown.map((m) => {
              const rate = m.invoiced > 0 ? Math.round((m.collected / m.invoiced) * 100) : 0;
              return (
                <div
                  key={m.monthKey}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-pitch-700/60 border border-slate-200 dark:border-white/5 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {m.label}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400">
                      {rate}%
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-2xs">
                    <span className="text-slate-400">Collected:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatCurrency(m.collected, defaultCurrency)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-2xs">
                    <span className="text-slate-400">Invoiced:</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300">
                      {formatCurrency(m.invoiced, defaultCurrency)}
                    </span>
                  </div>
                  {m.outstanding > 0 && (
                    <div className="flex items-baseline justify-between text-2xs">
                      <span className="text-amber-500/90 font-medium">Due:</span>
                      <span className="font-mono font-semibold text-amber-400">
                        {formatCurrency(m.outstanding, defaultCurrency)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Detailed Report Table ─────────────────────────────────────── */}
      <div className="card overflow-hidden border border-slate-200 dark:border-white/5 bg-white dark:bg-pitch-800 shadow-sm">
        <div className="p-3.5 sm:px-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Itemized Milestone Ledger
            </span>
            <span className="text-2xs text-slate-400 font-mono">
              ({filteredRows.length} results)
            </span>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Info size={24} className="mx-auto text-slate-400" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No fee records matched your report filter.
            </p>
            <p className="text-2xs text-slate-500">
              Try selecting a wider timeframe or changing the payment status.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-pitch-900/60 border-b border-slate-200 dark:border-white/5 text-2xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Player</th>
                  <th className="py-2.5 px-3 font-semibold">Plan Type</th>
                  <th className="py-2.5 px-3 font-semibold">Milestone</th>
                  <th className="py-2.5 px-3 font-semibold">Due Date</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Scheduled</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Collected</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Balance</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {filteredRows.map((r, idx) => (
                  <tr
                    key={`${r.feeId}-${r.installmentNumber}-${idx}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-pitch-700/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                      {onSelectStudent ? (
                        <button
                          type="button"
                          onClick={() => onSelectStudent(r.studentId)}
                          className="hover:text-volt-400 hover:underline font-semibold text-left"
                        >
                          {r.studentName}
                        </button>
                      ) : (
                        r.studentName
                      )}
                    </td>
                    <td className="py-2.5 px-3 uppercase text-2xs font-mono text-slate-500">
                      {r.feeType.replace("_", " ")}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                      #{r.installmentNumber}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-2xs">
                      {r.dueDateStr}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-right text-slate-800 dark:text-slate-200">
                      {formatCurrency(r.amount, r.currency)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-right text-emerald-400">
                      {formatCurrency(r.paidAmount, r.currency)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-right text-amber-400">
                      {r.balance > 0 ? formatCurrency(r.balance, r.currency) : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant={
                          r.status === "paid"
                            ? "green"
                            : r.status === "overdue"
                            ? "red"
                            : r.status === "partial" || r.status === "pending_verification"
                            ? "yellow"
                            : "gray"
                        }
                        size="sm"
                      >
                        {r.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 uppercase text-2xs text-slate-400 font-mono">
                      {r.paymentMethod || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
