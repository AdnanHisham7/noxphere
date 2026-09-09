// src/features/fees/FeesPage.tsx
import React, { useState, useMemo } from "react";
import { clsx } from "clsx";
import {
  Wallet,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  AlertTriangle,
  Send,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Users,
  CheckCircle2,
  Clock,
  QrCode,
  Layers,
  Table as TableIcon,
  ShieldAlert,
  ArrowUpRight,
  History,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  Card,
  Badge,
  Button,
  Input,
  Modal,
  Skeleton,
  EmptyState,
  Avatar,
  ImageUploadField,
} from "../../components/ui";
import { useCurrentFranchiseId } from "../../hooks/useCurrentFranchiseId";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import { useConfirm } from "../../hooks/useConfirm";
import { academyApi } from "../../store/api/academyApi";
import {
  useListFeesQuery,
  useCreateFeeMutation,
  useRecordPaymentMutation,
  useUpdatePaymentMutation,
  useUndoPaymentMutation,
  useSendInstallmentReminderMutation,
  type CreateFeeBody,
  type AdminFeeRecord,
  type FeeInstallment,
} from "../../store/api/adminFeesApi";
import { useGetStudentsQuery } from "../../store/api/studentsApi";

const STATUS_VARIANT: Record<string, "green" | "red" | "yellow" | "gray"> = {
  paid: "green",
  overdue: "red",
  partial: "yellow",
  pending: "gray",
  refunded: "gray",
};

const FeeQrCodeCard: React.FC<{ isOpen: boolean; onToggle: () => void }> = ({ isOpen, onToggle }) => {
  const academyId = useCurrentAcademyId();
  const { data: academy, isLoading } = academyApi.useGetAcademyByIdQuery(academyId ?? "", { skip: !academyId });
  const [updateConfig, { isLoading: saving }] = academyApi.useUpdateAcademyConfigMutation();

  const qrImageUrl = academy?.feeQrImageUrl ?? (academy as any)?.data?.feeQrImageUrl;

  const handleChange = async (url: string | undefined) => {
    if (!academyId) {
      toast.error("Academy identification pending. Please try again.");
      return;
    }
    try {
      await updateConfig({ id: academyId, config: { feeQrImageUrl: url ?? "" } }).unwrap();
      toast.success(url ? "QR code updated" : "QR code removed");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't save the QR code — try again");
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/60 overflow-hidden mb-6 transition-all">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3.5 sm:px-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <QrCode size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                WhatsApp Payment QR Code
              </span>
              <span
                className={clsx(
                  "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                  qrImageUrl ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-400"
                )}
              >
                {qrImageUrl ? "Configured" : "Not Set"}
              </span>
            </div>
            <p className="text-2xs text-slate-400">
              Attached to WhatsApp due-date reminders sent to guardians.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <span>{isOpen ? "Hide settings" : "Configure QR"}</span>
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-2 border-t border-white/5 bg-pitch-950/40">
          <div className="max-w-xs">
            {isLoading && !qrImageUrl ? (
              <div className="w-[180px] aspect-square rounded-lg bg-slate-900 animate-pulse border border-dashed border-white/10 flex items-center justify-center text-2xs text-slate-400">
                Loading QR Code…
              </div>
            ) : (
              <ImageUploadField
                label="Payment QR code image"
                category="fee_qr"
                value={qrImageUrl}
                onChange={handleChange}
                shape="square"
              />
            )}
          </div>
          {saving && <p className="text-2xs text-volt-400 mt-2">Saving payment QR code…</p>}
        </div>
      )}
    </div>
  );
};

const FeesPage: React.FC = () => {
  const franchiseId = useCurrentFranchiseId();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"student" | "table">("student");
  const [qrOpen, setQrOpen] = useState(false);

  // Modals state
  const [showCreate, setShowCreate] = useState(false);
  const [createInitialStudentId, setCreateInitialStudentId] = useState<string | undefined>(undefined);
  const [payTarget, setPayTarget] = useState<{ feeId: string; installmentNumber: number; amount: number } | null>(null);
  const [editTarget, setEditTarget] = useState<{ feeId: string; installmentNumber: number; amount: number; paymentMethod?: string; transactionId?: string } | null>(null);

  // Accordion expansion tracking
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [expandedFees, setExpandedFees] = useState<Set<string>>(new Set());
  const [expandedAudits, setExpandedAudits] = useState<Set<string>>(new Set());

  const { data: fees, isLoading, isError } = useListFeesQuery(
    { franchiseId: franchiseId ?? "" },
    { skip: !franchiseId },
  );
  const { data: studentsResult } = useGetStudentsQuery(
    { franchiseId: franchiseId ?? "", limit: 200 },
    { skip: !franchiseId },
  );
  const students = studentsResult?.items ?? [];

  const [createFee, { isLoading: creating }] = useCreateFeeMutation();
  const [undoPayment] = useUndoPaymentMutation();
  const [sendInstallmentReminder] = useSendInstallmentReminderMutation();
  const [remindingKey, setRemindingKey] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  // Metrics calculation
  const metrics = useMemo(() => {
    const list = fees ?? [];
    let invoiced = 0;
    let collected = 0;
    let overdue = 0;
    const studentsWithDues = new Set<string>();

    for (const f of list) {
      invoiced += f.finalAmount || 0;
      let feePaid = 0;
      for (const inst of f.installments || []) {
        const paid = inst.paidAmount || 0;
        feePaid += paid;
        const unpaid = Math.max(0, inst.amount - paid);
        const isPastDue = new Date(inst.dueDate).getTime() < Date.now() && inst.status !== "paid";
        if (inst.status === "overdue" || isPastDue) {
          overdue += unpaid;
        }
      }
      collected += feePaid;
      if (feePaid < f.finalAmount && f.studentId?._id) {
        studentsWithDues.add(f.studentId._id);
      }
    }

    const pending = Math.max(0, invoiced - collected);
    const collectionRate = invoiced > 0 ? Math.round((collected / invoiced) * 100) : 0;

    return {
      invoiced,
      collected,
      pending,
      overdue,
      collectionRate,
      studentsWithDuesCount: studentsWithDues.size,
    };
  }, [fees]);

  // Filtered fee list
  const filteredFees = useMemo(() => {
    return (fees ?? []).filter((fee) => {
      // Status filter
      if (statusFilter && fee.overallStatus !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const studentName = `${fee.studentId?.firstName || ""} ${fee.studentId?.lastName || ""}`.toLowerCase();
        const feeType = (fee.feeType || "").toLowerCase();
        return studentName.includes(q) || feeType.includes(q);
      }
      return true;
    });
  }, [fees, statusFilter, searchQuery]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { all: (fees ?? []).length, overdue: 0, pending: 0, partial: 0, paid: 0 };
    for (const f of fees ?? []) {
      if (f.overallStatus === "overdue") counts.overdue++;
      else if (f.overallStatus === "pending") counts.pending++;
      else if (f.overallStatus === "partial") counts.partial++;
      else if (f.overallStatus === "paid") counts.paid++;
    }
    return counts;
  }, [fees]);

  // Grouped by Student map
  const studentGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        student: { _id: string; firstName: string; lastName: string; photo?: string; ageGroup?: string };
        fees: AdminFeeRecord[];
        totalInvoiced: number;
        totalPaid: number;
        totalBalance: number;
        hasOverdue: boolean;
      }
    >();

    for (const fee of filteredFees) {
      const sId = fee.studentId?._id || "unknown";
      let group = map.get(sId);
      if (!group) {
        // Look up student ageGroup if available
        const matchedStudent = students.find((s) => s.id === sId);
        group = {
          student: {
            _id: sId,
            firstName: fee.studentId?.firstName || "Unknown",
            lastName: fee.studentId?.lastName || "Player",
            photo: fee.studentId?.photo,
            ageGroup: matchedStudent?.ageGroup,
          },
          fees: [],
          totalInvoiced: 0,
          totalPaid: 0,
          totalBalance: 0,
          hasOverdue: false,
        };
        map.set(sId, group);
      }

      group.fees.push(fee);
      group.totalInvoiced += fee.finalAmount;

      let planPaid = 0;
      for (const inst of fee.installments || []) {
        planPaid += inst.paidAmount || 0;
        const isPastDue = new Date(inst.dueDate).getTime() < Date.now() && inst.status !== "paid";
        if (inst.status === "overdue" || isPastDue) {
          group.hasOverdue = true;
        }
      }
      group.totalPaid += planPaid;
      group.totalBalance = Math.max(0, group.totalInvoiced - group.totalPaid);
    }

    return Array.from(map.values()).sort((a, b) => {
      // Prioritize students with overdue or pending balance first
      if (a.hasOverdue && !b.hasOverdue) return -1;
      if (!a.hasOverdue && b.hasOverdue) return 1;
      if (a.totalBalance > 0 && b.totalBalance === 0) return -1;
      if (a.totalBalance === 0 && b.totalBalance > 0) return 1;
      return a.student.firstName.localeCompare(b.student.firstName);
    });
  }, [filteredFees, students]);

  const toggleStudentExpanded = (id: string) => {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFeeExpanded = (id: string) => {
    setExpandedFees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAuditExpanded = (id: string) => {
    setExpandedAudits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (viewMode === "student") {
      setExpandedStudents(new Set(studentGroups.map((g) => g.student._id)));
    } else {
      setExpandedFees(new Set(filteredFees.map((f) => f._id)));
    }
  };

  const collapseAll = () => {
    setExpandedStudents(new Set());
    setExpandedFees(new Set());
  };

  const handleSendReminder = async (feeId: string, installmentNumber: number) => {
    const key = `${feeId}-${installmentNumber}`;
    setRemindingKey(key);
    try {
      const res = await sendInstallmentReminder({ feeId, installmentNumber }).unwrap();
      toast.success(res.message || "Payment alert & QR sent successfully");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to send payment alert — try again");
    } finally {
      setRemindingKey(null);
    }
  };

  const handleUndoPayment = async (feeId: string, installmentNumber: number) => {
    const ok = await confirm({
      title: "Undo payment",
      message: "Undo this payment? This will reset the installment to unpaid/pending.",
      confirmLabel: "Undo payment",
      danger: true,
    });
    if (!ok) return;
    try {
      await undoPayment({ feeId, installmentNumber }).unwrap();
      toast.success("Payment reverted successfully");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't undo payment — try again");
    }
  };

  if (!franchiseId) {
    return (
      <EmptyState
        icon={<Wallet size={28} />}
        title="No franchise selected"
        description="Select a franchise from the top bar to manage fees."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <p className="section-title mb-1">Financial Management</p>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white uppercase tracking-tight">
            Player Fees
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Track schedules, collection milestones, and due-date alerts across every enrolled player.
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            icon={<Plus size={15} />}
            onClick={() => {
              setCreateInitialStudentId(undefined);
              setShowCreate(true);
            }}
            className="w-full sm:w-auto justify-center"
          >
            Schedule fee
          </Button>
        </div>
      </div>

      {/* KPI Overview Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3.5 bg-pitch-900/60 border-white/10 relative overflow-hidden">
          <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Total Invoiced</p>
          <p className="text-xl font-display font-extrabold text-white mt-1">
            ₹{metrics.invoiced.toLocaleString("en-IN")}
          </p>
          <span className="text-2xs text-slate-500 font-mono">Across all active plans</span>
        </div>

        <div className="card p-3.5 bg-pitch-900/60 border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-2xs font-semibold uppercase tracking-wider text-emerald-400">Collected</p>
            <span className="text-2xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {metrics.collectionRate}%
            </span>
          </div>
          <p className="text-xl font-display font-extrabold text-emerald-400 mt-1">
            ₹{metrics.collected.toLocaleString("en-IN")}
          </p>
          {/* Mini progress bar */}
          <div className="w-full bg-white/5 rounded-full h-1 mt-2 overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.collectionRate)}%` }}
            />
          </div>
        </div>

        <div className="card p-3.5 bg-pitch-900/60 border-white/10 relative overflow-hidden">
          <p className="text-2xs font-semibold uppercase tracking-wider text-amber-400">Outstanding Due</p>
          <p className="text-xl font-display font-extrabold text-amber-400 mt-1">
            ₹{metrics.pending.toLocaleString("en-IN")}
          </p>
          <span className="text-2xs text-slate-500">
            {metrics.studentsWithDuesCount} student{metrics.studentsWithDuesCount === 1 ? "" : "s"} with dues
          </span>
        </div>

        <div className="card p-3.5 bg-pitch-900/60 border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-2xs font-semibold uppercase tracking-wider text-rose-400">Overdue Amount</p>
            {metrics.overdue > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            )}
          </div>
          <p className="text-xl font-display font-extrabold text-rose-400 mt-1">
            ₹{metrics.overdue.toLocaleString("en-IN")}
          </p>
          <span className="text-2xs text-rose-400/80 font-mono">Needs immediate reminder</span>
        </div>
      </div>

      {/* Collapsible Payment QR Code Setting */}
      <FeeQrCodeCard isOpen={qrOpen} onToggle={() => setQrOpen((prev) => !prev)} />

      {/* Control & Filter Toolbar */}
      <div className="card p-3.5 space-y-3 bg-pitch-900/80 border-white/10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Search input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by student name, fee type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input !pl-9 !py-1.5 text-xs w-full bg-pitch-950/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* View mode toggle & expand controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-pitch-950/80 rounded-lg p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode("student")}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors",
                  viewMode === "student" ? "bg-volt-400 text-pitch-950" : "text-slate-400 hover:text-white"
                )}
                title="Group multiple cards by student"
              >
                <Layers size={13} />
                <span>By Student</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors",
                  viewMode === "table" ? "bg-volt-400 text-pitch-950" : "text-slate-400 hover:text-white"
                )}
                title="Dense tabular view"
              >
                <TableIcon size={13} />
                <span>All Fees</span>
              </button>
            </div>

            <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={expandAll}
              className="text-2xs font-semibold text-slate-400 hover:text-volt-400 px-2 py-1 transition-colors"
            >
              Expand all
            </button>
            <span className="text-slate-600 text-2xs">·</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-2xs font-semibold text-slate-400 hover:text-volt-400 px-2 py-1 transition-colors"
            >
              Collapse all
            </button>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-white/5">
          {[
            { id: "", label: "All Statuses", count: statusCounts.all },
            { id: "overdue", label: "Overdue", count: statusCounts.overdue, variant: "red" },
            { id: "pending", label: "Pending", count: statusCounts.pending, variant: "gray" },
            { id: "partial", label: "Partial", count: statusCounts.partial, variant: "yellow" },
            { id: "paid", label: "Paid", count: statusCounts.paid, variant: "green" },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={clsx(
                "px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 border",
                statusFilter === pill.id
                  ? "bg-volt-400 text-pitch-950 border-volt-400"
                  : "bg-white/[0.03] text-slate-400 border-white/5 hover:border-white/15"
              )}
            >
              <span>{pill.label}</span>
              <span
                className={clsx(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                  statusFilter === pill.id
                    ? "bg-pitch-900/30 text-pitch-950"
                    : pill.id === "overdue" && pill.count > 0
                    ? "bg-rose-500/20 text-rose-400"
                    : "bg-white/10 text-slate-400"
                )}
              >
                {pill.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && <EmptyState title="Couldn't load fees" description="Please try again shortly." />}

      {/* Empty State */}
      {!isLoading && !isError && filteredFees.length === 0 && (
        <EmptyState
          icon={<Wallet size={28} />}
          title={searchQuery || statusFilter ? "No matching fees found" : "No fee records yet"}
          description={
            searchQuery || statusFilter
              ? "Try resetting your search query or status filter."
              : "Schedule a fee for a player to start tracking collection."
          }
          action={
            searchQuery || statusFilter ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setShowCreate(true)}>Schedule a fee</Button>
            )
          }
        />
      )}

      {/* VIEW MODE 1: Grouped By Student (Default & Recommended for 100+ students) */}
      {!isLoading && !isError && filteredFees.length > 0 && viewMode === "student" && (
        <div className="space-y-3">
          {studentGroups.map((group) => {
            const isExpanded = expandedStudents.has(group.student._id);
            const percentPaid =
              group.totalInvoiced > 0 ? Math.round((group.totalPaid / group.totalInvoiced) * 100) : 0;

            return (
              <div
                key={group.student._id}
                className="card border-white/10 bg-pitch-900/70 overflow-hidden transition-all shadow-sm"
              >
                {/* Student Header Bar */}
                <div
                  onClick={() => toggleStudentExpanded(group.student._id)}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={`${group.student.firstName} ${group.student.lastName}`}
                      src={group.student.photo}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-bold text-white text-sm uppercase tracking-wide truncate">
                          {group.student.firstName} {group.student.lastName}
                        </h3>
                        {group.student.ageGroup && (
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
                            {group.student.ageGroup}
                          </span>
                        )}
                      </div>
                      <p className="text-2xs text-slate-500 font-mono mt-0.5">
                        {group.fees.length} fee plan{group.fees.length === 1 ? "" : "s"} assigned
                      </p>
                    </div>
                  </div>

                  {/* Financial summary & Progress */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 flex-wrap w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs font-mono font-bold text-white">
                          ₹{group.totalPaid.toLocaleString("en-IN")}
                        </span>
                        <span className="text-2xs text-slate-500">/</span>
                        <span className="text-xs font-mono text-slate-400">
                          ₹{group.totalInvoiced.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="w-32 sm:w-40 bg-white/5 rounded-full h-1.5 mt-1 overflow-hidden ml-auto">
                        <div
                          className={clsx(
                            "h-full rounded-full transition-all",
                            group.hasOverdue
                              ? "bg-rose-500"
                              : percentPaid === 100
                              ? "bg-emerald-400"
                              : "bg-volt-400"
                          )}
                          style={{ width: `${Math.min(100, percentPaid)}%` }}
                        />
                      </div>
                    </div>

                    {/* Overall Status Badge */}
                    <div className="w-24 text-right">
                      {group.hasOverdue ? (
                        <Badge variant="red" size="sm">Overdue</Badge>
                      ) : group.totalBalance === 0 ? (
                        <Badge variant="green" size="sm">Paid Full</Badge>
                      ) : group.totalPaid > 0 ? (
                        <Badge variant="yellow" size="sm">Partial</Badge>
                      ) : (
                        <Badge variant="gray" size="sm">Pending</Badge>
                      )}
                    </div>

                    {/* Quick action: Add fee & Accordion toggle */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateInitialStudentId(group.student._id);
                          setShowCreate(true);
                        }}
                        className="text-2xs font-semibold text-volt-400 hover:text-volt-300 bg-volt-400/10 border border-volt-400/20 px-2 py-1 rounded transition-colors"
                        title="Add another fee schedule for this student"
                      >
                        + Add Fee
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStudentExpanded(group.student._id)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Fee Details for this Student */}
                {isExpanded && (
                  <div className="border-t border-white/10 bg-pitch-950/50 p-3.5 sm:p-4 space-y-4">
                    {group.fees.map((fee) => (
                      <FeePlanDetailBlock
                        key={fee._id}
                        fee={fee}
                        remindingKey={remindingKey}
                        onSendReminder={handleSendReminder}
                        onUndoPayment={handleUndoPayment}
                        onRecordPayment={(target) => setPayTarget(target)}
                        onEditPayment={(target) => setEditTarget(target)}
                        isAuditExpanded={expandedAudits.has(fee._id)}
                        onToggleAudit={() => toggleAuditExpanded(fee._id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: Compact High-Density Table / List */}
      {!isLoading && !isError && filteredFees.length > 0 && viewMode === "table" && (
        <div className="card overflow-hidden border-white/10 bg-pitch-900/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Player</th>
                  <th className="py-2.5 px-3">Fee Type</th>
                  <th className="py-2.5 px-3 text-right">Invoiced</th>
                  <th className="py-2.5 px-3 text-right">Collected</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Milestones</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredFees.map((fee) => {
                  const isExpanded = expandedFees.has(fee._id);
                  const totalPaid = fee.installments.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
                  const balance = Math.max(0, fee.finalAmount - totalPaid);
                  const paidCount = fee.installments.filter((i) => i.status === "paid").length;

                  return (
                    <React.Fragment key={fee._id}>
                      <tr
                        onClick={() => toggleFeeExpanded(fee._id)}
                        className={clsx(
                          "cursor-pointer hover:bg-white/[0.02] transition-colors",
                          isExpanded ? "bg-white/[0.02]" : ""
                        )}
                      >
                        <td className="py-2.5 px-3 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
                            </span>
                            <span>{fee.studentId?.firstName} {fee.studentId?.lastName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="capitalize font-mono text-slate-300">
                            {fee.feeType.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-white">
                          ₹{fee.finalAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-semibold">
                          ₹{totalPaid.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-400 font-semibold">
                          ₹{balance.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant={STATUS_VARIANT[fee.overallStatus] ?? "gray"} size="sm">
                            {fee.overallStatus}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-2xs text-slate-400 font-mono">
                            {paidCount}/{fee.installments.length} paid
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleFeeExpanded(fee._id)}
                            className="text-2xs font-semibold text-volt-400 hover:underline"
                          >
                            {isExpanded ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Installment Table */}
                      {isExpanded && (
                        <tr className="bg-pitch-950/70">
                          <td colSpan={8} className="p-3.5 border-t border-b border-white/10">
                            <FeePlanDetailBlock
                              fee={fee}
                              remindingKey={remindingKey}
                              onSendReminder={handleSendReminder}
                              onUndoPayment={handleUndoPayment}
                              onRecordPayment={(target) => setPayTarget(target)}
                              onEditPayment={(target) => setEditTarget(target)}
                              isAuditExpanded={expandedAudits.has(fee._id)}
                              onToggleAudit={() => toggleAuditExpanded(fee._id)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateFeeModal
          franchiseId={franchiseId}
          initialStudentId={createInitialStudentId}
          onClose={() => {
            setShowCreate(false);
            setCreateInitialStudentId(undefined);
          }}
          creating={creating}
          onCreate={async (body) => {
            try {
              await createFee(body).unwrap();
              toast.success("Fee scheduled successfully");
              setShowCreate(false);
              setCreateInitialStudentId(undefined);
            } catch (err: any) {
              toast.error(err?.data?.message || "Couldn't schedule fee — try again");
            }
          }}
        />
      )}

      {payTarget && <RecordPaymentModal target={payTarget} onClose={() => setPayTarget(null)} />}
      {editTarget && <EditPaymentModal target={editTarget} onClose={() => setEditTarget(null)} />}
      {ConfirmDialog}
    </div>
  );
};

// ─── Compact Fee Plan Block with Installments & Collapsible Audit ──────────────

interface FeePlanDetailBlockProps {
  fee: AdminFeeRecord;
  remindingKey: string | null;
  onSendReminder: (feeId: string, installmentNumber: number) => void;
  onUndoPayment: (feeId: string, installmentNumber: number) => void;
  onRecordPayment: (target: { feeId: string; installmentNumber: number; amount: number }) => void;
  onEditPayment: (target: { feeId: string; installmentNumber: number; amount: number; paymentMethod?: string; transactionId?: string }) => void;
  isAuditExpanded: boolean;
  onToggleAudit: () => void;
}

const FeePlanDetailBlock: React.FC<FeePlanDetailBlockProps> = ({
  fee,
  remindingKey,
  onSendReminder,
  onUndoPayment,
  onRecordPayment,
  onEditPayment,
  isAuditExpanded,
  onToggleAudit,
}) => {
  return (
    <div className="rounded-lg border border-white/5 bg-pitch-900/50 p-3.5 space-y-3">
      {/* Plan Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider capitalize font-mono">
            {fee.feeType.replace("_", " ")}
          </span>
          <span className="text-slate-500 text-2xs">·</span>
          <span className="text-xs font-mono font-semibold text-slate-300">
            Total: ₹{fee.finalAmount.toLocaleString("en-IN")}
          </span>
          {fee.auditLog && fee.auditLog.length > 0 && (
            <button
              type="button"
              onClick={onToggleAudit}
              className="text-[10px] text-slate-400 hover:text-volt-400 ml-2 font-mono flex items-center gap-1 border border-white/10 px-1.5 py-0.5 rounded transition-colors"
            >
              <History size={11} />
              <span>{fee.auditLog.length} Audit Events</span>
              {isAuditExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>
        <Badge variant={STATUS_VARIANT[fee.overallStatus] ?? "gray"} size="sm">
          {fee.overallStatus}
        </Badge>
      </div>

      {/* High-density Installments List */}
      <div className="space-y-1.5">
        {fee.installments.map((inst) => {
          const isPastDue = new Date(inst.dueDate).getTime() < Date.now() && inst.status !== "paid";
          const unpaid = Math.max(0, inst.amount - (inst.paidAmount || 0));

          return (
            <div
              key={inst.installmentNumber}
              className="flex items-center justify-between text-xs bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 flex-wrap gap-2 hover:bg-white/[0.04] transition-colors"
            >
              {/* Left Info: Milestone #, Due Date, Payment Details */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">
                    Milestone {inst.installmentNumber}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className={clsx("text-2xs", isPastDue ? "text-rose-400 font-semibold" : "text-slate-400")}>
                    Due: {new Date(inst.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {isPastDue && " (Overdue)"}
                  </span>
                </div>
                {inst.paidAt && (
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    Paid via <span className="uppercase font-semibold text-slate-300">{inst.paymentMethod || "cash"}</span> on{" "}
                    {new Date(inst.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {inst.transactionId && ` (Txn: ${inst.transactionId})`}
                  </span>
                )}
                {inst.status !== "paid" && (inst.reminderSentCount ?? 0) > 0 && (
                  <span className="text-[10px] text-sky-400/90 font-mono mt-0.5">
                    QR alert sent {inst.reminderSentCount} time{(inst.reminderSentCount ?? 0) > 1 ? "s" : ""}
                    {inst.lastReminderAt && ` (last: ${new Date(inst.lastReminderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`}
                  </span>
                )}
              </div>

              {/* Right: Amounts, Badge, Actions */}
              <div className="flex items-center gap-3 flex-wrap ml-auto">
                <span className="font-mono text-xs">
                  <span className="text-emerald-400 font-semibold">₹{inst.paidAmount.toLocaleString("en-IN")}</span>
                  <span className="text-slate-500"> / </span>
                  <span className="text-slate-300">₹{inst.amount.toLocaleString("en-IN")}</span>
                </span>

                <Badge variant={STATUS_VARIANT[inst.status] ?? (isPastDue ? "red" : "gray")} size="sm">
                  {isPastDue && inst.status !== "paid" ? "overdue" : inst.status}
                </Badge>

                <div className="flex items-center gap-1.5">
                  {inst.paidAmount > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          onEditPayment({
                            feeId: fee._id,
                            installmentNumber: inst.installmentNumber,
                            amount: inst.paidAmount,
                            paymentMethod: inst.paymentMethod || "cash",
                            transactionId: inst.transactionId || "",
                          })
                        }
                        className="text-[10px] text-slate-400 hover:text-volt-400 font-semibold border border-white/5 bg-white/5 rounded px-2 py-1 transition-colors"
                        title="Edit payment details"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onUndoPayment(fee._id, inst.installmentNumber)}
                        className="text-[10px] text-slate-400 hover:text-rose-400 font-semibold border border-white/5 bg-white/5 rounded px-2 py-1 transition-colors"
                        title="Undo this payment"
                      >
                        Undo
                      </button>
                    </>
                  )}

                  {inst.status !== "paid" && (
                    <>
                      <button
                        type="button"
                        onClick={() => onSendReminder(fee._id, inst.installmentNumber)}
                        disabled={remindingKey === `${fee._id}-${inst.installmentNumber}`}
                        className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        title="Send WhatsApp payment link and QR code alert"
                      >
                        {remindingKey === `${fee._id}-${inst.installmentNumber}` ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Send size={11} />
                        )}
                        <span>QR alert</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onRecordPayment({
                            feeId: fee._id,
                            installmentNumber: inst.installmentNumber,
                            amount: unpaid,
                          })
                        }
                        className="text-[11px] font-semibold text-pitch-950 bg-volt-400 hover:bg-volt-300 px-2.5 py-1 rounded transition-colors"
                      >
                        Record Pay
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible Audit Trail */}
      {isAuditExpanded && fee.auditLog && fee.auditLog.length > 0 && (
        <div className="border-t border-white/5 pt-2.5 space-y-1.5 animate-fade-in">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Audit Trail Records
          </p>
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {fee.auditLog.map((log, idx) => (
              <div
                key={idx}
                className="flex justify-between items-start text-[10px] bg-white/[0.01] border border-white/5 rounded px-2.5 py-1 font-mono text-slate-400"
              >
                <div>
                  <span className="text-volt-400 font-semibold capitalize">[{log.action.replace("_", " ")}]</span>{" "}
                  <span>{log.details || `Amount: ₹${log.amount}`}</span>
                </div>
                <div className="text-right text-[9px] text-slate-500 shrink-0 ml-2">
                  <span>by {log.performedByName}</span>
                  <span className="block">{new Date(log.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Modal Components ─────────────────────────────────────────────────────────

const emptyInstallment = () => ({ amount: "", dueDate: "" });

const CreateFeeModal: React.FC<{
  franchiseId: string;
  initialStudentId?: string;
  onClose: () => void;
  onCreate: (body: CreateFeeBody) => void;
  creating: boolean;
}> = ({ franchiseId, initialStudentId, onClose, onCreate, creating }) => {
  const { data: studentsResult } = useGetStudentsQuery(
    { franchiseId, limit: 200 },
    { skip: !franchiseId },
  );
  const students = studentsResult?.items ?? [];

  const [studentId, setStudentId] = useState(initialStudentId ?? "");
  const [feeType, setFeeType] = useState<CreateFeeBody["feeType"]>("one_time");
  const [totalAmount, setTotalAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [installments, setInstallments] = useState([emptyInstallment()]);

  const setFeeTypeAndAdjust = (type: CreateFeeBody["feeType"]) => {
    setFeeType(type);
    if (type !== "installment") setInstallments([emptyInstallment()]);
  };

  const addInstallment = () => setInstallments((prev) => [...prev, emptyInstallment()]);
  const removeInstallment = (i: number) => setInstallments((prev) => prev.filter((_, idx) => idx !== i));
  const updateInstallment = (i: number, field: "amount" | "dueDate", value: string) => {
    setInstallments((prev) => prev.map((inst, idx) => (idx === i ? { ...inst, [field]: value } : inst)));
  };

  const splitEvenly = () => {
    const total = parseFloat(totalAmount);
    if (!total || installments.length === 0) return;
    const each = Math.floor((total / installments.length) * 100) / 100;
    const remainder = Math.round((total - each * installments.length) * 100) / 100;
    setInstallments((prev) =>
      prev.map((inst, i) => ({ ...inst, amount: (i === prev.length - 1 ? each + remainder : each).toString() })),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      toast.error("Select a player");
      return;
    }
    const total = parseFloat(totalAmount);
    if (!total || total <= 0) {
      toast.error("Enter a valid total amount");
      return;
    }
    if (installments.some((i) => !i.amount || !i.dueDate)) {
      toast.error("Fill in an amount and due date for every milestone");
      return;
    }
    const installmentTotal = installments.reduce((sum, i) => sum + parseFloat(i.amount || "0"), 0);
    const finalAmount = total - (parseFloat(discount) || 0);
    if (Math.abs(installmentTotal - finalAmount) > 0.5) {
      toast.error(`Installments (₹${installmentTotal.toFixed(2)}) must add up to the total minus discount (₹${finalAmount.toFixed(2)})`);
      return;
    }

    onCreate({
      studentId,
      franchiseId,
      feeType,
      totalAmount: total,
      discount: parseFloat(discount) || undefined,
      notes: notes || undefined,
      installments: installments.map((inst, i) => ({
        installmentNumber: i + 1,
        amount: parseFloat(inst.amount),
        dueDate: new Date(inst.dueDate).toISOString(),
      })),
    });
  };

  return (
    <Modal isOpen onClose={onClose} title="Schedule a fee" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label text-xs">Player</label>
          <select className="input text-xs !w-full" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            <option value="">Select a player…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName} · {s.ageGroup}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label text-xs">Fee type</label>
          <div className="flex gap-2">
            {(["one_time", "installment", "early_bird"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFeeTypeAndAdjust(t)}
                className={clsx(
                  "flex-1 px-3 py-2 rounded border text-xs font-semibold uppercase tracking-wide transition-colors",
                  feeType === t ? "bg-volt-400 text-pitch-900 border-volt-400" : "border-white/10 text-slate-400 hover:border-white/25",
                )}
              >
                {t === "one_time" ? "One-time" : t === "installment" ? "Installment plan" : "Early bird"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Total amount (₹)" type="number" min={1} value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
          <Input label="Discount (₹, optional)" type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label !mb-0 text-xs">
              {feeType === "installment" ? "Milestone installments" : "Payment due date"}
            </label>
            <div className="flex gap-3">
              {totalAmount && (
                <button type="button" onClick={splitEvenly} className="text-2xs text-volt-400 hover:underline">
                  Split evenly
                </button>
              )}
              {feeType === "installment" && (
                <button type="button" onClick={addInstallment} className="text-2xs text-ice-400 hover:underline">
                  + Add installment
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {installments.map((inst, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-2xs text-slate-500 w-5">{i + 1}.</span>
                <input
                  type="number"
                  min={1}
                  placeholder="Amount"
                  value={inst.amount}
                  onChange={(e) => updateInstallment(i, "amount", e.target.value)}
                  className="input flex-1 text-xs"
                  required
                />
                <input
                  type="date"
                  value={inst.dueDate}
                  onChange={(e) => updateInstallment(i, "dueDate", e.target.value)}
                  className="input flex-1 text-xs"
                  required
                />
                {feeType === "installment" && installments.length > 1 && (
                  <button type="button" onClick={() => removeInstallment(i)} className="text-slate-500 hover:text-rose-400 px-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label text-xs">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input w-full resize-none text-xs" placeholder="e.g. Annual registration fee" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1" loading={creating}>Schedule fee</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
};

const RecordPaymentModal: React.FC<{
  target: { feeId: string; installmentNumber: number; amount: number };
  onClose: () => void;
}> = ({ target, onClose }) => {
  const [recordPayment, { isLoading }] = useRecordPaymentMutation();
  const [amount, setAmount] = useState(String(target.amount));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [transactionId, setTransactionId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordPayment({
        feeId: target.feeId,
        installmentNumber: target.installmentNumber,
        amount: Number(amount),
        paymentMethod,
        transactionId: transactionId || undefined,
      }).unwrap();
      toast.success("Payment recorded");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't record payment — try again");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Record payment" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Amount (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <div>
          <label className="label text-xs">Payment method</label>
          <select className="input text-xs !w-full" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </div>
        <Input label="Transaction ID (optional)" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
        <Button type="submit" loading={isLoading} className="w-full bg-volt-400 hover:bg-volt-300 text-pitch-900 font-bold uppercase py-2">
          Record payment
        </Button>
      </form>
    </Modal>
  );
};

const EditPaymentModal: React.FC<{
  target: { feeId: string; installmentNumber: number; amount: number; paymentMethod?: string; transactionId?: string };
  onClose: () => void;
}> = ({ target, onClose }) => {
  const [updatePayment, { isLoading }] = useUpdatePaymentMutation();
  const [amount, setAmount] = useState(String(target.amount));
  const [paymentMethod, setPaymentMethod] = useState(target.paymentMethod || "cash");
  const [transactionId, setTransactionId] = useState(target.transactionId || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updatePayment({
        feeId: target.feeId,
        installmentNumber: target.installmentNumber,
        amount: Number(amount),
        paymentMethod,
        transactionId: transactionId || undefined,
      }).unwrap();
      toast.success("Payment details updated");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update payment — try again");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Edit payment details" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Amount (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <div>
          <label className="label text-xs">Payment method</label>
          <select className="input text-xs !w-full" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </div>
        <Input label="Transaction ID (optional)" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
        <Button type="submit" loading={isLoading} className="w-full bg-volt-400 hover:bg-volt-300 text-pitch-900 font-bold uppercase py-2">
          Save Changes
        </Button>
      </form>
    </Modal>
  );
};

export default FeesPage;
