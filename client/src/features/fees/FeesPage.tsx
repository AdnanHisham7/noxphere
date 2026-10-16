// src/features/fees/FeesPage.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { clsx } from "clsx";
import { useHighlightEffect } from "../../hooks/useEntityHighlight";
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
  Landmark,
  Layers,
  Table as TableIcon,
  ShieldAlert,
  ArrowUpRight,
  History,
  X,
  ShieldCheck,
  CheckCircle,
  User,
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
  PageHeader,
  Select,
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
  useVerifyPaymentMutation,
  type CreateFeeBody,
  type AdminFeeRecord,
  type FeeInstallment,
  type PaymentBreakdownItem,
} from "../../store/api/adminFeesApi";
import { useGetStudentsQuery } from "../../store/api/studentsApi";

const STATUS_VARIANT: Record<string, "green" | "red" | "yellow" | "gray"> = {
  paid: "green",
  overdue: "red",
  partial: "yellow",
  pending: "gray",
  refunded: "gray",
  pending_verification: "yellow",
};

const FeeQrCodeCard: React.FC<{ isOpen: boolean; onToggle: () => void }> = ({
  isOpen,
  onToggle,
}) => {
  const academyId = useCurrentAcademyId();
  const { data: academy, isLoading } = academyApi.useGetAcademyByIdQuery(
    academyId ?? "",
    { skip: !academyId },
  );
  const [updateConfig, { isLoading: saving }] =
    academyApi.useUpdateAcademyConfigMutation();

  const qrImageUrl =
    academy?.feeQrImageUrl ?? (academy as any)?.data?.feeQrImageUrl;
  const paymentMethod =
    academy?.feePaymentMethod ?? (academy as any)?.data?.feePaymentMethod ?? "qr";
  const existingBank =
    academy?.bankDetails ?? (academy as any)?.data?.bankDetails ?? {};

  const [method, setMethod] = useState<"qr" | "bank_transfer" | "both">(paymentMethod);
  const [bankForm, setBankForm] = useState({
    beneficiaryName: existingBank.beneficiaryName || "",
    accountNumber: existingBank.accountNumber || "",
    ifscCode: existingBank.ifscCode || "",
    bankName: existingBank.bankName || "",
    branchName: existingBank.branchName || "",
    upiId: existingBank.upiId || "",
  });

  // Keep in sync when academy data loads
  React.useEffect(() => {
    if (academy) {
      const pm = academy.feePaymentMethod ?? (academy as any)?.data?.feePaymentMethod;
      if (pm) setMethod(pm);
      const b = academy.bankDetails ?? (academy as any)?.data?.bankDetails;
      if (b) {
        setBankForm({
          beneficiaryName: b.beneficiaryName || "",
          accountNumber: b.accountNumber || "",
          ifscCode: b.ifscCode || "",
          bankName: b.bankName || "",
          branchName: b.branchName || "",
          upiId: b.upiId || "",
        });
      }
    }
  }, [academy]);

  const handleQrChange = async (url: string | undefined) => {
    if (!academyId) {
      toast.error("Academy identification pending. Please try again.");
      return;
    }
    try {
      await updateConfig({
        id: academyId,
        config: { feeQrImageUrl: url ?? "" },
      }).unwrap();
      toast.success(url ? "QR code updated" : "QR code removed");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't save the QR code — try again");
    }
  };

  const handleMethodChange = async (newMethod: "qr" | "bank_transfer" | "both") => {
    setMethod(newMethod);
    if (!academyId) return;
    try {
      await updateConfig({
        id: academyId,
        config: { feePaymentMethod: newMethod },
      }).unwrap();
      toast.success(`Fee collection method updated to: ${newMethod === "qr" ? "QR Code" : newMethod === "bank_transfer" ? "Bank Transfer" : "Both (QR + Bank)"}`);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update payment method");
    }
  };

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academyId) {
      toast.error("Academy identification pending. Please try again.");
      return;
    }
    try {
      await updateConfig({
        id: academyId,
        config: {
          feePaymentMethod: method,
          bankDetails: bankForm,
        },
      }).unwrap();
      toast.success("Academy bank account details saved successfully");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't save bank details — try again");
    }
  };

  const isConfigured =
    method === "qr"
      ? !!qrImageUrl
      : method === "bank_transfer"
      ? !!(bankForm.accountNumber && bankForm.ifscCode)
      : !!qrImageUrl || !!(bankForm.accountNumber && bankForm.ifscCode);

  return (
    <div className="card rounded-xl border border-slate-200/80 dark:border-white/5 overflow-hidden mb-6 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3.5 sm:px-4 text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            {method === "bank_transfer" ? <Landmark size={16} /> : <QrCode size={16} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Fee Collection &amp; Payment Options
              </span>
              <span
                className={clsx(
                  "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                  isConfigured
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                )}
              >
                {method === "qr"
                  ? "UPI QR Code"
                  : method === "bank_transfer"
                  ? "Bank Account"
                  : "Both (QR + Bank)"}
              </span>
            </div>
            <p className="text-2xs text-slate-400">
              Payment info sent in WhatsApp due-date reminders and displayed in the Guardian Portal.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <span>{isOpen ? "Hide settings" : "Configure options"}</span>
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-3 border-t border-slate-200 dark:border-white/5 bg-slate-50/60 dark:bg-pitch-900/60 space-y-4">
          {/* Method selector */}
          <div>
            <label className="block text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Preferred Payment Method to Share with Guardians
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  id: "qr" as const,
                  label: "UPI QR Code Only",
                  desc: "WhatsApp alerts include QR image; Guardians scan to pay",
                  icon: QrCode,
                },
                {
                  id: "bank_transfer" as const,
                  label: "Bank Account Only",
                  desc: "WhatsApp alerts include A/C No, IFSC & Beneficiary details",
                  icon: Landmark,
                },
                {
                  id: "both" as const,
                  label: "Both (QR + Bank)",
                  desc: "Share QR code and Bank transfer info together",
                  icon: Wallet,
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleMethodChange(opt.id)}
                  className={clsx(
                    "p-3 rounded-lg border text-left transition-all",
                    method === opt.id
                      ? "border-volt-400 bg-volt-400/10 dark:bg-volt-400/5 text-slate-900 dark:text-white ring-1 ring-volt-400/50"
                      : "border-slate-200 dark:border-white/5 bg-white dark:bg-pitch-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <opt.icon size={15} className={method === opt.id ? "text-volt-400" : "text-slate-400"} />
                    <span className="text-xs font-bold">{opt.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {/* QR Code Section */}
            {(method === "qr" || method === "both") && (
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-white/5 bg-white dark:bg-pitch-800 space-y-3">
                <div className="flex items-center gap-2">
                  <QrCode size={16} className="text-sky-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                    UPI Payment QR Code
                  </span>
                </div>
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
                      onChange={handleQrChange}
                      shape="square"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Bank Account Section */}
            {(method === "bank_transfer" || method === "both") && (
              <form
                onSubmit={handleSaveBankDetails}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-white/5 bg-white dark:bg-pitch-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                      Academy Bank Details
                    </span>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    loading={saving}
                    className="text-xs bg-volt-400 hover:bg-volt-300 text-pitch-950 font-bold"
                  >
                    Save Details
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Input
                    label="Beneficiary / Account Name"
                    value={bankForm.beneficiaryName}
                    onChange={(e) =>
                      setBankForm((prev) => ({ ...prev, beneficiaryName: e.target.value }))
                    }
                    placeholder="e.g. Apex Football Academy"
                    required
                  />
                  <Input
                    label="Bank Name"
                    value={bankForm.bankName}
                    onChange={(e) =>
                      setBankForm((prev) => ({ ...prev, bankName: e.target.value }))
                    }
                    placeholder="e.g. HDFC Bank"
                    required
                  />
                  <Input
                    label="Account Number"
                    value={bankForm.accountNumber}
                    onChange={(e) =>
                      setBankForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                    }
                    placeholder="Enter bank account number"
                    required
                  />
                  <Input
                    label="IFSC Code"
                    value={bankForm.ifscCode}
                    onChange={(e) =>
                      setBankForm((prev) => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))
                    }
                    placeholder="e.g. HDFC0001234"
                    required
                  />
                  <Input
                    label="Branch Name (optional)"
                    value={bankForm.branchName}
                    onChange={(e) =>
                      setBankForm((prev) => ({ ...prev, branchName: e.target.value }))
                    }
                    placeholder="e.g. Koramangala Branch"
                  />
                  <Input
                    label="Academy UPI ID (optional)"
                    value={bankForm.upiId}
                    onChange={(e) =>
                      setBankForm((prev) => ({ ...prev, upiId: e.target.value }))
                    }
                    placeholder="e.g. academy@hdfcbank"
                  />
                </div>
              </form>
            )}
          </div>
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
  const [createInitialStudentId, setCreateInitialStudentId] = useState<
    string | undefined
  >(undefined);
  const [payTarget, setPayTarget] = useState<{
    feeId: string;
    installmentNumber: number;
    amount: number;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<{
    feeId: string;
    installmentNumber: number;
    amount: number;
    paymentMethod?: string;
    transactionId?: string;
    paymentBreakdown?: PaymentBreakdownItem[];
  } | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<{
    fee: AdminFeeRecord;
    installment: FeeInstallment;
  } | null>(null);

  // Accordion expansion tracking
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(
    new Set(),
  );
  const [expandedFees, setExpandedFees] = useState<Set<string>>(new Set());
  const [expandedAudits, setExpandedAudits] = useState<Set<string>>(new Set());

  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlightId");
  useHighlightEffect();

  const {
    data: fees,
    isLoading,
    isError,
  } = useListFeesQuery(
    { franchiseId: franchiseId ?? "" },
    { skip: !franchiseId },
  );

  useEffect(() => {
    if (!highlightId || !fees) return;
    const matchedFee = fees.find(
      (f) =>
        f._id === highlightId ||
        (typeof f.studentId === "object" && f.studentId?._id === highlightId) ||
        (typeof f.studentId === "string" && f.studentId === highlightId),
    );
    if (matchedFee) {
      const studentId =
        typeof matchedFee.studentId === "object"
          ? matchedFee.studentId._id
          : matchedFee.studentId;
      if (studentId) {
        setExpandedStudents((prev) => new Set([...prev, studentId]));
      }
      setExpandedFees((prev) => new Set([...prev, matchedFee._id]));
    } else {
      setExpandedStudents((prev) => new Set([...prev, highlightId]));
    }
  }, [highlightId, fees]);
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
        const isPastDue =
          new Date(inst.dueDate).getTime() < Date.now() &&
          inst.status !== "paid";
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
    const collectionRate =
      invoiced > 0 ? Math.round((collected / invoiced) * 100) : 0;

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
        const studentName =
          `${fee.studentId?.firstName || ""} ${fee.studentId?.lastName || ""}`.toLowerCase();
        const feeType = (fee.feeType || "").toLowerCase();
        return studentName.includes(q) || feeType.includes(q);
      }
      return true;
    });
  }, [fees, statusFilter, searchQuery]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = {
      all: (fees ?? []).length,
      overdue: 0,
      pending: 0,
      partial: 0,
      paid: 0,
      pending_verification: 0,
    };
    for (const f of fees ?? []) {
      if (f.overallStatus === "overdue") counts.overdue++;
      else if (f.overallStatus === "pending") counts.pending++;
      else if (f.overallStatus === "partial") counts.partial++;
      else if (f.overallStatus === "paid") counts.paid++;
      else if (f.overallStatus === "pending_verification") counts.pending_verification++;
    }
    return counts;
  }, [fees]);

  // Grouped by Student map
  const studentGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        student: {
          _id: string;
          firstName: string;
          lastName: string;
          photo?: string;
          ageGroup?: string;
        };
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
        const isPastDue =
          new Date(inst.dueDate).getTime() < Date.now() &&
          inst.status !== "paid";
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

  const handleSendReminder = async (
    feeId: string,
    installmentNumber: number,
  ) => {
    const key = `${feeId}-${installmentNumber}`;
    setRemindingKey(key);
    try {
      const res = await sendInstallmentReminder({
        feeId,
        installmentNumber,
      }).unwrap();
      toast.success(res.message || "Payment alert & QR sent successfully");
    } catch (err: any) {
      toast.error(
        err?.data?.message || "Failed to send payment alert — try again",
      );
    } finally {
      setRemindingKey(null);
    }
  };

  const handleUndoPayment = async (
    feeId: string,
    installmentNumber: number,
  ) => {
    const ok = await confirm({
      title: "Undo payment",
      message:
        "Undo this payment? This will reset the installment to unpaid/pending.",
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
      <PageHeader
        eyebrow="Financial Management"
        title="Player Fees"
        subtitle="Track schedules, collection milestones, and due-date alerts across every enrolled player."
        actions={
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
        }
      />

      {/* KPI Overview Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3.5 relative overflow-hidden">
          <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">
            Total Invoiced
          </p>
          <p className="text-xl font-display font-extrabold text-slate-900 dark:text-white mt-1">
            ₹{metrics.invoiced.toLocaleString("en-IN")}
          </p>
          <span className="text-2xs text-slate-500 font-mono">
            Across all active plans
          </span>
        </div>

        <div className="card p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-2xs font-semibold uppercase tracking-wider text-emerald-400">
              Collected
            </p>
            <span className="text-2xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {metrics.collectionRate}%
            </span>
          </div>
          <p className="text-xl font-display font-extrabold text-emerald-400 mt-1">
            ₹{metrics.collected.toLocaleString("en-IN")}
          </p>
          {/* Mini progress bar */}
          <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1 mt-2 overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.collectionRate)}%` }}
            />
          </div>
        </div>

        <div className="card p-3.5 relative overflow-hidden">
          <p className="text-2xs font-semibold uppercase tracking-wider text-amber-400">
            Outstanding Due
          </p>
          <p className="text-xl font-display font-extrabold text-amber-400 mt-1">
            ₹{metrics.pending.toLocaleString("en-IN")}
          </p>
          <span className="text-2xs text-slate-500">
            {metrics.studentsWithDuesCount} student
            {metrics.studentsWithDuesCount === 1 ? "" : "s"} with dues
          </span>
        </div>

        <div className="card p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-2xs font-semibold uppercase tracking-wider text-rose-400">
              Overdue Amount
            </p>
            {metrics.overdue > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            )}
          </div>
          <p className="text-xl font-display font-extrabold text-rose-400 mt-1">
            ₹{metrics.overdue.toLocaleString("en-IN")}
          </p>
          <span className="text-2xs text-rose-400/80 font-mono">
            Needs immediate reminder
          </span>
        </div>
      </div>

      {/* Collapsible Payment QR Code Setting */}
      <FeeQrCodeCard
        isOpen={qrOpen}
        onToggle={() => setQrOpen((prev) => !prev)}
      />

      {/* Control & Filter Toolbar */}
      <div className="card p-3.5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Search input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by student name, fee type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input !pl-9 !py-1.5 text-xs w-full bg-slate-50 dark:bg-pitch-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* View mode toggle & expand controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-pitch-800 rounded-lg p-0.5 border border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setViewMode("student")}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors",
                  viewMode === "student"
                    ? "bg-volt-400 text-pitch-950"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
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
                  viewMode === "table"
                    ? "bg-volt-400 text-pitch-950"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                )}
                title="Dense tabular view"
              >
                <TableIcon size={13} />
                <span>All Fees</span>
              </button>
            </div>

            <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1 hidden sm:block" />

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
            {
              id: "overdue",
              label: "Overdue",
              count: statusCounts.overdue,
              variant: "red",
            },
            {
              id: "pending",
              label: "Pending",
              count: statusCounts.pending,
              variant: "gray",
            },
            {
              id: "partial",
              label: "Partial",
              count: statusCounts.partial,
              variant: "yellow",
            },
            {
              id: "pending_verification",
              label: "Under Verification",
              count: statusCounts.pending_verification,
              variant: "yellow",
            },
            {
              id: "paid",
              label: "Paid",
              count: statusCounts.paid,
              variant: "green",
            },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={clsx(
                "px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 border",
                statusFilter === pill.id
                  ? "bg-volt-400 text-pitch-950 border-volt-400"
                  : "bg-slate-100 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15",
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
                      : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400",
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
      {isError && (
        <EmptyState
          title="Couldn't load fees"
          description="Please try again shortly."
        />
      )}

      {/* Empty State */}
      {!isLoading && !isError && filteredFees.length === 0 && (
        <EmptyState
          icon={<Wallet size={28} />}
          title={
            searchQuery || statusFilter
              ? "No matching fees found"
              : "No fee records yet"
          }
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
              <Button onClick={() => setShowCreate(true)}>
                Schedule a fee
              </Button>
            )
          }
        />
      )}

      {/* VIEW MODE 1: Grouped By Student (Default & Recommended for 100+ students) */}
      {!isLoading &&
        !isError &&
        filteredFees.length > 0 &&
        viewMode === "student" && (
          <div className="space-y-3">
            {studentGroups.map((group) => {
              const isExpanded = expandedStudents.has(group.student._id);
              const percentPaid =
                group.totalInvoiced > 0
                  ? Math.round((group.totalPaid / group.totalInvoiced) * 100)
                  : 0;

              return (
                <div
                  key={group.student._id}
                  id={`entity-${group.student._id}`}
                  data-highlight-id={group.student._id}
                  className="card border-slate-200/80 dark:border-white/5 overflow-hidden transition-all shadow-sm"
                >
                  {/* Student Header Bar */}
                  <div
                    onClick={() => toggleStudentExpanded(group.student._id)}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={`${group.student.firstName} ${group.student.lastName}`}
                        src={group.student.photo}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide truncate">
                            {group.student.firstName} {group.student.lastName}
                          </h3>
                          {group.student.ageGroup && (
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5">
                              {group.student.ageGroup}
                            </span>
                          )}
                        </div>
                        <p className="text-2xs text-slate-500 font-mono mt-0.5">
                          {group.fees.length} fee plan
                          {group.fees.length === 1 ? "" : "s"} assigned
                        </p>
                      </div>
                    </div>

                    {/* Financial summary & Progress */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 flex-wrap w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                            ₹{group.totalPaid.toLocaleString("en-IN")}
                          </span>
                          <span className="text-2xs text-slate-500">/</span>
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            ₹{group.totalInvoiced.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="w-32 sm:w-40 bg-slate-100 dark:bg-white/5 rounded-full h-1.5 mt-1 overflow-hidden ml-auto">
                          <div
                            className={clsx(
                              "h-full rounded-full transition-all",
                              group.hasOverdue
                                ? "bg-rose-500"
                                : percentPaid === 100
                                  ? "bg-emerald-400"
                                  : "bg-volt-400",
                            )}
                            style={{ width: `${Math.min(100, percentPaid)}%` }}
                          />
                        </div>
                      </div>

                      {/* Overall Status Badge */}
                      <div className="w-24 text-right">
                        {group.hasOverdue ? (
                          <Badge variant="red" size="sm">
                            Overdue
                          </Badge>
                        ) : group.totalBalance === 0 ? (
                          <Badge variant="green" size="sm">
                            Paid Full
                          </Badge>
                        ) : group.totalPaid > 0 ? (
                          <Badge variant="yellow" size="sm">
                            Partial
                          </Badge>
                        ) : (
                          <Badge variant="gray" size="sm">
                            Pending
                          </Badge>
                        )}
                      </div>

                      {/* Quick action: Add fee & Accordion toggle */}
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                          onClick={() =>
                            toggleStudentExpanded(group.student._id)
                          }
                          className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Fee Details for this Student */}
                  {isExpanded && (
                    <div className="border-t border-slate-200/80 dark:border-white/5 bg-slate-50/70 dark:bg-pitch-900/60 p-3.5 sm:p-4 space-y-4">
                      {group.fees.map((fee) => (
                        <FeePlanDetailBlock
                          key={fee._id}
                          fee={fee}
                          remindingKey={remindingKey}
                          onSendReminder={handleSendReminder}
                          onUndoPayment={handleUndoPayment}
                          onRecordPayment={(target) => setPayTarget(target)}
                          onEditPayment={(target) => setEditTarget(target)}
                          onVerifyPayment={(target) => setVerifyTarget(target)}
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
      {!isLoading &&
        !isError &&
        filteredFees.length > 0 &&
        viewMode === "table" && (
          <div className="card overflow-hidden border-slate-200/80 dark:border-white/5 shadow-sm">
            <div className="table-responsive">
              <table className="w-full min-w-[680px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
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
                    const totalPaid = fee.installments.reduce(
                      (sum, i) => sum + (i.paidAmount || 0),
                      0,
                    );
                    const balance = Math.max(0, fee.finalAmount - totalPaid);
                    const paidCount = fee.installments.filter(
                      (i) => i.status === "paid",
                    ).length;

                    return (
                      <React.Fragment key={fee._id}>
                        <tr
                          id={`entity-${fee._id}`}
                          data-highlight-id={fee._id}
                          onClick={() => toggleFeeExpanded(fee._id)}
                          className={clsx(
                            "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-slate-100 dark:border-white/5",
                            isExpanded ? "bg-slate-50/80 dark:bg-white/[0.02]" : "",
                          )}
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">
                                {isExpanded ? (
                                  <ChevronUp size={13} />
                                ) : (
                                  <ChevronRight size={13} />
                                )}
                              </span>
                              <span>
                                {fee.studentId?.firstName}{" "}
                                {fee.studentId?.lastName}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="capitalize font-mono text-slate-700 dark:text-slate-300">
                              {fee.feeType.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-white">
                            ₹{fee.finalAmount.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-semibold">
                            ₹{totalPaid.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-amber-400 font-semibold">
                            ₹{balance.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge
                              variant={
                                STATUS_VARIANT[fee.overallStatus] ?? "gray"
                              }
                              size="sm"
                            >
                              {fee.overallStatus}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-2xs text-slate-400 font-mono">
                              {paidCount}/{fee.installments.length} paid
                            </span>
                          </td>
                          <td
                            className="py-2.5 px-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
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
                          <tr className="bg-slate-50/70 dark:bg-pitch-900/60">
                            <td
                              colSpan={8}
                              className="p-3.5 border-t border-b border-slate-200 dark:border-white/10"
                            >
                              <FeePlanDetailBlock
                                fee={fee}
                                remindingKey={remindingKey}
                                onSendReminder={handleSendReminder}
                                onUndoPayment={handleUndoPayment}
                                onRecordPayment={(target) =>
                                  setPayTarget(target)
                                }
                                onEditPayment={(target) =>
                                  setEditTarget(target)
                                }
                                onVerifyPayment={(target) =>
                                  setVerifyTarget(target)
                                }
                                isAuditExpanded={expandedAudits.has(fee._id)}
                                onToggleAudit={() =>
                                  toggleAuditExpanded(fee._id)
                                }
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
          onCreate={async (body, targetStudentIds) => {
            try {
              if (targetStudentIds.length === 1) {
                await createFee({
                  ...body,
                  studentId: targetStudentIds[0],
                }).unwrap();
                toast.success("Fee scheduled successfully");
              } else {
                let successCount = 0;
                let failCount = 0;
                for (const sid of targetStudentIds) {
                  try {
                    await createFee({ ...body, studentId: sid }).unwrap();
                    successCount++;
                  } catch {
                    failCount++;
                  }
                }
                if (failCount === 0) {
                  toast.success(
                    `Fee scheduled for all ${successCount} players!`,
                  );
                } else {
                  toast.success(
                    `Fee scheduled for ${successCount} players (${failCount} failed).`,
                  );
                }
              }
              setShowCreate(false);
              setCreateInitialStudentId(undefined);
            } catch (err: any) {
              toast.error(
                err?.data?.message || "Couldn't schedule fee — try again",
              );
            }
          }}
        />
      )}

      {payTarget && (
        <RecordPaymentModal
          target={payTarget}
          onClose={() => setPayTarget(null)}
        />
      )}
      {editTarget && (
        <EditPaymentModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
      {verifyTarget && (
        <VerifyPaymentModal
          fee={verifyTarget.fee}
          installment={verifyTarget.installment}
          onClose={() => setVerifyTarget(null)}
        />
      )}
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
  onRecordPayment: (target: {
    feeId: string;
    installmentNumber: number;
    amount: number;
  }) => void;
  onEditPayment: (target: {
    feeId: string;
    installmentNumber: number;
    amount: number;
    paymentMethod?: string;
    transactionId?: string;
    paymentBreakdown?: PaymentBreakdownItem[];
  }) => void;
  onVerifyPayment?: (target: {
    fee: AdminFeeRecord;
    installment: FeeInstallment;
  }) => void;
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
  onVerifyPayment,
  isAuditExpanded,
  onToggleAudit,
}) => {
  return (
    <div
      id={`entity-${fee._id}`}
      data-highlight-id={fee._id}
      className="rounded-lg border border-slate-200/80 dark:border-white/5 bg-white dark:bg-pitch-800 p-3.5 space-y-3 shadow-xs"
    >
      {/* Plan Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider capitalize font-mono">
            {fee.feeType.replace("_", " ")}
          </span>
          <span className="text-slate-500 text-2xs">·</span>
          <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
            Total: ₹{fee.finalAmount.toLocaleString("en-IN")}
          </span>
          {fee.auditLog && fee.auditLog.length > 0 && (
            <button
              type="button"
              onClick={onToggleAudit}
              className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-volt-600 dark:hover:text-volt-400 ml-2 font-mono flex items-center gap-1 border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded transition-colors"
            >
              <History size={11} />
              <span>{fee.auditLog.length} Audit Events</span>
              {isAuditExpanded ? (
                <ChevronUp size={11} />
              ) : (
                <ChevronDown size={11} />
              )}
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
          const isPastDue =
            new Date(inst.dueDate).getTime() < Date.now() &&
            inst.status !== "paid";
          const unpaid = Math.max(0, inst.amount - (inst.paidAmount || 0));

          return (
            <div
              key={inst.installmentNumber}
              id={`entity-${fee._id}-${inst.installmentNumber}`}
              data-highlight-id={`${fee._id}-${inst.installmentNumber}`}
              className="flex items-center justify-between text-xs bg-slate-50 dark:bg-pitch-700/50 border border-slate-200/80 dark:border-white/5 rounded-lg px-3 py-2 flex-wrap gap-2 hover:bg-slate-100 dark:hover:bg-pitch-700/80 transition-colors shadow-2xs"
            >
              {/* Left Info: Milestone #, Due Date, Payment Details */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Milestone {inst.installmentNumber}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span
                    className={clsx(
                      "text-2xs",
                      isPastDue
                        ? "text-rose-400 font-semibold"
                        : "text-slate-400",
                    )}
                  >
                    Due:{" "}
                    {new Date(inst.dueDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {isPastDue && " (Overdue)"}
                  </span>
                </div>
                {inst.paidAt && (
                  <div className="flex flex-col gap-1 mt-0.5">
                    <span className="text-[10px] text-slate-400">
                      Paid via{" "}
                      <span className="uppercase font-semibold text-slate-700 dark:text-slate-300">
                        {inst.paymentBreakdown && inst.paymentBreakdown.length > 1
                          ? "Split Payment"
                          : inst.paymentMethod || "cash"}
                      </span>{" "}
                      on{" "}
                      {new Date(inst.paidAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                      {inst.transactionId && ` (Txn: ${inst.transactionId})`}
                    </span>
                    {inst.paymentBreakdown && inst.paymentBreakdown.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {inst.paymentBreakdown.map((item, bIdx) => (
                          <span
                            key={bIdx}
                            className="inline-flex items-center gap-1 text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          >
                            <span className="uppercase font-bold">{item.method}:</span>
                            <span>₹{item.amount.toLocaleString("en-IN")}</span>
                            {item.transactionId && (
                              <span className="text-slate-400">({item.transactionId})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {inst.status !== "paid" &&
                  (inst.reminderSentCount ?? 0) > 0 && (
                    <span className="text-[10px] text-sky-400/90 font-mono mt-0.5">
                      QR alert sent {inst.reminderSentCount} time
                      {(inst.reminderSentCount ?? 0) > 1 ? "s" : ""}
                      {inst.lastReminderAt &&
                        ` (last: ${new Date(inst.lastReminderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`}
                    </span>
                  )}
              </div>

              {/* Right: Amounts, Badge, Actions */}
              <div className="flex items-center gap-3 flex-wrap ml-auto">
                <span className="font-mono text-xs">
                  <span className="text-emerald-400 font-semibold">
                    ₹{inst.paidAmount.toLocaleString("en-IN")}
                  </span>
                  <span className="text-slate-500"> / </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    ₹{inst.amount.toLocaleString("en-IN")}
                  </span>
                </span>

                <Badge
                  variant={
                    inst.status === "pending_verification"
                      ? "yellow"
                      : (STATUS_VARIANT[inst.status] ?? (isPastDue ? "red" : "gray"))
                  }
                  size="sm"
                >
                  {inst.status === "pending_verification"
                    ? "verification pending"
                    : isPastDue && inst.status !== "paid"
                    ? "overdue"
                    : inst.status}
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
                            paymentBreakdown: inst.paymentBreakdown,
                          })
                        }
                        className="text-[10px] text-slate-600 dark:text-slate-400 hover:text-volt-600 dark:hover:text-volt-400 font-semibold border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 rounded px-2 py-1 transition-colors"
                        title="Edit payment details"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUndoPayment(fee._id, inst.installmentNumber)
                        }
                        className="text-[10px] text-slate-600 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 font-semibold border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 rounded px-2 py-1 transition-colors"
                        title="Undo this payment"
                      >
                        Undo
                      </button>
                    </>
                  )}

                  {inst.status === "pending_verification" ? (
                    <button
                      type="button"
                      onClick={() => onVerifyPayment?.({ fee, installment: inst })}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 px-3 py-1 rounded shadow-sm transition-colors animate-pulse"
                      title="Guardian submitted proof. Click to verify."
                    >
                      <ShieldCheck size={12} />
                      <span>Verify Payment</span>
                    </button>
                  ) : inst.status !== "paid" ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          onSendReminder(fee._id, inst.installmentNumber)
                        }
                        disabled={
                          remindingKey ===
                          `${fee._id}-${inst.installmentNumber}`
                        }
                        className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        title="Send WhatsApp payment link and QR code alert"
                      >
                        {remindingKey ===
                        `${fee._id}-${inst.installmentNumber}` ? (
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
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible Audit Trail */}
      {isAuditExpanded && fee.auditLog && fee.auditLog.length > 0 && (
        <div className="border-t border-slate-200 dark:border-white/5 pt-2.5 space-y-1.5 animate-fade-in">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Audit Trail Records
          </p>
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {fee.auditLog.map((log, idx) => (
              <div
                key={idx}
                className="flex justify-between items-start text-[10px] bg-slate-50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/5 rounded px-2.5 py-1 font-mono text-slate-600 dark:text-slate-400"
              >
                <div>
                  <span className="text-volt-400 font-semibold capitalize">
                    [{log.action.replace("_", " ")}]
                  </span>{" "}
                  <span>{log.details || `Amount: ₹${log.amount}`}</span>
                </div>
                <div className="text-right text-[9px] text-slate-500 shrink-0 ml-2">
                  <span>by {log.performedByName}</span>
                  <span className="block">
                    {new Date(log.timestamp).toLocaleDateString()}
                  </span>
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
  onCreate: (
    body: Omit<CreateFeeBody, "studentId">,
    studentIds: string[],
  ) => void;
  creating: boolean;
}> = ({ franchiseId, initialStudentId, onClose, onCreate, creating }) => {
  const { data: studentsResult } = useGetStudentsQuery(
    { franchiseId, limit: 200 },
    { skip: !franchiseId },
  );
  const students = studentsResult?.items ?? [];

  const [selectionMode, setSelectionMode] = useState<
    "single" | "all" | "category" | "custom"
  >(initialStudentId ? "single" : "single");
  const [studentId, setStudentId] = useState(initialStudentId ?? "");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [customSelectedIds, setCustomSelectedIds] = useState<string[]>(
    initialStudentId ? [initialStudentId] : [],
  );
  const [playerFilter, setPlayerFilter] = useState<string>("");

  const [feeType, setFeeType] = useState<CreateFeeBody["feeType"]>("one_time");
  const [totalAmount, setTotalAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [installments, setInstallments] = useState([emptyInstallment()]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    students.forEach((s) => {
      if (s.ageGroup) cats.add(s.ageGroup);
    });
    return Array.from(cats).sort();
  }, [students]);

  // Derived target students
  const targetStudentIds = useMemo(() => {
    if (selectionMode === "single") return studentId ? [studentId] : [];
    if (selectionMode === "all") return students.map((s) => s.id);
    if (selectionMode === "category") {
      return selectedCategory
        ? students
            .filter((s) => s.ageGroup === selectedCategory)
            .map((s) => s.id)
        : [];
    }
    if (selectionMode === "custom") return customSelectedIds;
    return [];
  }, [selectionMode, studentId, students, selectedCategory, customSelectedIds]);

  const setFeeTypeAndAdjust = (type: CreateFeeBody["feeType"]) => {
    setFeeType(type);
    if (type !== "installment") setInstallments([emptyInstallment()]);
  };

  const addInstallment = () =>
    setInstallments((prev) => [...prev, emptyInstallment()]);
  const removeInstallment = (i: number) =>
    setInstallments((prev) => prev.filter((_, idx) => idx !== i));
  const updateInstallment = (
    i: number,
    field: "amount" | "dueDate",
    value: string,
  ) => {
    setInstallments((prev) =>
      prev.map((inst, idx) => (idx === i ? { ...inst, [field]: value } : inst)),
    );
  };

  const splitEvenly = () => {
    const total = parseFloat(totalAmount);
    if (!total || installments.length === 0) return;
    const each = Math.floor((total / installments.length) * 100) / 100;
    const remainder =
      Math.round((total - each * installments.length) * 100) / 100;
    setInstallments((prev) =>
      prev.map((inst, i) => ({
        ...inst,
        amount: (i === prev.length - 1 ? each + remainder : each).toString(),
      })),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetStudentIds.length === 0) {
      toast.error("Please select at least one player to schedule this fee for");
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
    const installmentTotal = installments.reduce(
      (sum, i) => sum + parseFloat(i.amount || "0"),
      0,
    );
    const finalAmount = total - (parseFloat(discount) || 0);
    if (Math.abs(installmentTotal - finalAmount) > 0.5) {
      toast.error(
        `Installments (₹${installmentTotal.toFixed(2)}) must add up to the total minus discount (₹${finalAmount.toFixed(2)})`,
      );
      return;
    }

    onCreate(
      {
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
      },
      targetStudentIds,
    );
  };

  return (
    <Modal isOpen onClose={onClose} title="Schedule a fee" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label text-xs">Assign Fee To</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[
              { id: "single", label: "Single Player" },
              { id: "all", label: `All (${students.length})` },
              { id: "category", label: "By Category" },
              { id: "custom", label: `Custom (${customSelectedIds.length})` },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectionMode(m.id as any)}
                className={clsx(
                  "px-2.5 py-1.5 rounded border text-xs font-semibold transition-all text-center",
                  selectionMode === m.id
                    ? "bg-volt-400 text-pitch-900 border-volt-400 shadow-xs"
                    : "bg-slate-100 dark:bg-pitch-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {selectionMode === "single" && (
            <Select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            >
              <option value="">Select a player…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}{" "}
                  {s.ageGroup ? `· ${s.ageGroup}` : ""}
                </option>
              ))}
            </Select>
          )}

          {selectionMode === "all" && (
            <div className="p-3 rounded-lg bg-volt-400/10 border border-volt-400/20 text-xs text-slate-700 dark:text-slate-300">
              Fee schedule will be created for{" "}
              <strong className="text-volt-600 dark:text-volt-400">
                {students.length} active players
              </strong>{" "}
              in this franchise.
            </div>
          )}

          {selectionMode === "category" && (
            <div className="space-y-2">
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                required
              >
                <option value="">Select an age category / squad…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c} ({students.filter((s) => s.ageGroup === c).length}{" "}
                    players)
                  </option>
                ))}
              </Select>
              {selectedCategory && (
                <p className="text-2xs text-slate-500">
                  Targeting{" "}
                  {
                    students.filter((s) => s.ageGroup === selectedCategory)
                      .length
                  }{" "}
                  players in {selectedCategory}.
                </p>
              )}
            </div>
          )}

          {selectionMode === "custom" && (
            <div className="space-y-2 border border-slate-200 dark:border-white/10 rounded-lg p-3 bg-slate-50/50 dark:bg-pitch-800/60">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder="Filter players by name..."
                  value={playerFilter}
                  onChange={(e) => setPlayerFilter(e.target.value)}
                  className="input text-xs flex-1 py-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customSelectedIds.length === students.length) {
                      setCustomSelectedIds([]);
                    } else {
                      setCustomSelectedIds(students.map((s) => s.id));
                    }
                  }}
                  className="text-2xs text-volt-600 dark:text-volt-400 hover:underline font-semibold whitespace-nowrap"
                >
                  {customSelectedIds.length === students.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 pr-1">
                {students
                  .filter((s) =>
                    `${s.firstName} ${s.lastName} ${s.ageGroup || ""}`
                      .toLowerCase()
                      .includes(playerFilter.toLowerCase()),
                  )
                  .map((s) => {
                    const isChecked = customSelectedIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-2.5 py-1.5 px-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCustomSelectedIds([
                                ...customSelectedIds,
                                s.id,
                              ]);
                            } else {
                              setCustomSelectedIds(
                                customSelectedIds.filter((id) => id !== s.id),
                              );
                            }
                          }}
                          className="rounded text-volt-500 focus:ring-volt-400"
                        />
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {s.firstName} {s.lastName}
                        </span>
                        {s.ageGroup && (
                          <span className="text-2xs text-slate-400 ml-auto font-mono">
                            {s.ageGroup}
                          </span>
                        )}
                      </label>
                    );
                  })}
              </div>
              <p className="text-2xs text-slate-500">
                {customSelectedIds.length} players selected.
              </p>
            </div>
          )}
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
                  feeType === t
                    ? "bg-volt-400 text-pitch-900 border-volt-400"
                    : "bg-slate-50 dark:bg-pitch-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/25",
                )}
              >
                {t === "one_time"
                  ? "One-time"
                  : t === "installment"
                    ? "Installment plan"
                    : "Early bird"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Total amount (₹)"
            type="number"
            min={1}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            required
          />
          <Input
            label="Discount (₹, optional)"
            type="number"
            min={0}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label !mb-0 text-xs">
              {feeType === "installment"
                ? "Milestone installments"
                : "Payment due date"}
            </label>
            <div className="flex gap-3">
              {totalAmount && (
                <button
                  type="button"
                  onClick={splitEvenly}
                  className="text-2xs text-volt-400 hover:underline"
                >
                  Split evenly
                </button>
              )}
              {feeType === "installment" && (
                <button
                  type="button"
                  onClick={addInstallment}
                  className="text-2xs text-ice-400 hover:underline"
                >
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
                  onChange={(e) =>
                    updateInstallment(i, "amount", e.target.value)
                  }
                  className="input flex-1 text-xs"
                  required
                />
                <input
                  type="date"
                  value={inst.dueDate}
                  onChange={(e) =>
                    updateInstallment(i, "dueDate", e.target.value)
                  }
                  className="input flex-1 text-xs"
                  required
                />
                {feeType === "installment" && installments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeInstallment(i)}
                    className="text-slate-500 hover:text-rose-400 px-1"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label text-xs">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input w-full resize-none text-xs"
            placeholder="e.g. Annual registration fee"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1" loading={creating}>
            {targetStudentIds.length > 1
              ? `Schedule fee for ${targetStudentIds.length} players`
              : "Schedule fee"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const VerifyPaymentModal: React.FC<{
  fee: AdminFeeRecord;
  installment: FeeInstallment;
  onClose: () => void;
}> = ({ fee, installment, onClose }) => {
  const [verifyPayment, { isLoading }] = useVerifyPaymentMutation();
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const proof = installment.verificationProof;
  const claimedAmount = proof?.claimedAmount ?? (installment.amount - installment.paidAmount);
  const studentName = `${fee.studentId?.firstName || ""} ${fee.studentId?.lastName || ""}`.trim() || "Student";

  const handleApprove = async () => {
    try {
      await verifyPayment({
        feeId: fee._id,
        installmentNumber: installment.installmentNumber,
        action: "approve",
        adjustedAmount: claimedAmount,
      }).unwrap();
      toast.success("Payment verified and marked as paid! Receipt created.");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to verify payment");
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please enter a reason for rejecting the payment proof");
      return;
    }
    try {
      await verifyPayment({
        feeId: fee._id,
        installmentNumber: installment.installmentNumber,
        action: "reject",
        rejectionReason: rejectionReason.trim(),
      }).unwrap();
      toast.success("Payment proof rejected");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to reject payment proof");
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Verify Guardian Payment Proof"
      size="md"
    >
      <div className="space-y-4">
        {/* Info Card */}
        <div className="bg-slate-50 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User size={16} className="text-volt-500" />
              <span className="font-semibold text-slate-900 dark:text-white text-sm">
                {studentName}
              </span>
            </div>
            <span className="text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
              Pending Verification
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-200 dark:border-white/10 pt-3">
            <div>
              <span className="text-slate-500 block text-2xs uppercase tracking-wider font-mono">
                Installment Milestone
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                Installment #{installment.installmentNumber}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-2xs uppercase tracking-wider font-mono">
                Milestone Due Date
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {new Date(installment.dueDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Claimed Payment Proof Box */}
        <div className="border border-amber-500/30 bg-amber-500/[0.04] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Submitted Payment Proof
            </span>
            <span className="font-orbital text-lg font-bold text-slate-900 dark:text-white">
              ₹{claimedAmount.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div>
              <span className="text-slate-500 text-2xs block uppercase font-mono">Payment Mode:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                {proof?.paymentMethod || "UPI"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-2xs block uppercase font-mono">Reference / UTR ID:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white truncate block">
                {proof?.transactionId || "—"}
              </span>
            </div>
            {proof?.submittedAt && (
              <div className="sm:col-span-2">
                <span className="text-slate-500 text-2xs block uppercase font-mono">Submitted On:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {new Date(proof.submittedAt).toLocaleString()}
                </span>
              </div>
            )}
            {proof?.notes && (
              <div className="sm:col-span-2 pt-1 border-t border-amber-500/20">
                <span className="text-slate-500 text-2xs block uppercase font-mono">Guardian Notes:</span>
                <p className="text-slate-700 dark:text-slate-300 italic text-xs mt-0.5">
                  "{proof.notes}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reject Reason Form if active */}
        {showRejectInput && (
          <div className="space-y-2 border border-rose-500/30 bg-rose-500/[0.04] rounded-xl p-3 animate-fade-in">
            <label className="block text-xs font-semibold text-rose-600 dark:text-rose-400">
              Rejection Reason (will be shown to guardian)
            </label>
            <input
              type="text"
              placeholder="e.g. UTR number not found in academy bank account, incorrect amount"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full text-xs rounded-lg bg-white dark:bg-white/5 border border-rose-300 dark:border-rose-500/30 px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-rose-500"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-white/10">
          {!showRejectInput ? (
            <button
              type="button"
              onClick={() => setShowRejectInput(true)}
              className="text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold px-3 py-2 rounded hover:bg-rose-500/10 transition-colors"
            >
              Reject Proof
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReject}
                disabled={isLoading}
                className="btn-danger text-xs py-2 px-3"
              >
                Confirm Reject
              </button>
              <button
                type="button"
                onClick={() => setShowRejectInput(false)}
                className="btn-secondary text-xs py-2 px-3"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-secondary text-xs py-2 px-3"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isLoading}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <CheckCircle size={14} />
              <span>Approve &amp; Mark Paid</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const RecordPaymentModal: React.FC<{
  target: { feeId: string; installmentNumber: number; amount: number };
  onClose: () => void;
}> = ({ target, onClose }) => {
  const [recordPayment, { isLoading }] = useRecordPaymentMutation();
  const [isMixed, setIsMixed] = useState(false);
  const [singleAmount, setSingleAmount] = useState(String(target.amount));
  const [singleMethod, setSingleMethod] = useState("cash");
  const [singleTxnId, setSingleTxnId] = useState("");

  const [splitRows, setSplitRows] = useState<
    { method: string; amount: string; transactionId: string }[]
  >([
    { method: "cash", amount: String(Math.floor(target.amount / 2)), transactionId: "" },
    { method: "upi", amount: String(target.amount - Math.floor(target.amount / 2)), transactionId: "" },
  ]);

  const totalSplit = useMemo(() => {
    return splitRows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
  }, [splitRows]);

  const addSplitRow = () => {
    const diff = Math.max(0, target.amount - totalSplit);
    setSplitRows((prev) => [
      ...prev,
      { method: "upi", amount: diff > 0 ? String(diff) : "", transactionId: "" },
    ]);
  };

  const removeSplitRow = (idx: number) => {
    setSplitRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSplitRow = (
    idx: number,
    field: "method" | "amount" | "transactionId",
    value: string,
  ) => {
    setSplitRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isMixed) {
        const validBreakdown = splitRows
          .filter((r) => Number(r.amount) > 0)
          .map((r) => ({
            method: r.method,
            amount: Number(r.amount),
            transactionId: r.transactionId.trim() || undefined,
          }));

        if (validBreakdown.length === 0) {
          toast.error("Please enter valid amounts for the split payment rows");
          return;
        }

        const totalAmt = validBreakdown.reduce((sum, r) => sum + r.amount, 0);

        await recordPayment({
          feeId: target.feeId,
          installmentNumber: target.installmentNumber,
          amount: totalAmt,
          paymentMethod: validBreakdown.length > 1 ? "mixed" : validBreakdown[0].method,
          transactionId: validBreakdown.map((r) => r.transactionId).filter(Boolean).join(", ") || undefined,
          paymentBreakdown: validBreakdown,
        }).unwrap();
      } else {
        await recordPayment({
          feeId: target.feeId,
          installmentNumber: target.installmentNumber,
          amount: Number(singleAmount),
          paymentMethod: singleMethod,
          transactionId: singleTxnId.trim() || undefined,
          paymentBreakdown: [
            {
              method: singleMethod,
              amount: Number(singleAmount),
              transactionId: singleTxnId.trim() || undefined,
            },
          ],
        }).unwrap();
      }
      toast.success("Payment recorded successfully");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't record payment — try again");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Record Payment" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Mode: Single vs Mixed */}
        <div className="flex p-1 bg-slate-100 dark:bg-pitch-800 rounded-lg border border-slate-200 dark:border-white/5">
          <button
            type="button"
            onClick={() => setIsMixed(false)}
            className={clsx(
              "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all text-center",
              !isMixed
                ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
            )}
          >
            Single Method
          </button>
          <button
            type="button"
            onClick={() => setIsMixed(true)}
            className={clsx(
              "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all text-center flex items-center justify-center gap-1.5",
              isMixed
                ? "bg-volt-400 text-pitch-950 shadow-sm font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
            )}
          >
            <span>Mixed / Split Payment</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-pitch-900/20 font-mono">
              Cash + UPI
            </span>
          </button>
        </div>

        {!isMixed ? (
          <div className="space-y-4">
            <Input
              label="Amount (₹)"
              type="number"
              value={singleAmount}
              onChange={(e) => setSingleAmount(e.target.value)}
              required
            />
            <Select
              label="Payment Method"
              value={singleMethod}
              onChange={(e) => setSingleMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI / GPay / PhonePe</option>
              <option value="card">Credit / Debit Card</option>
              <option value="bank_transfer">Bank Transfer / NEFT</option>
              <option value="cheque">Cheque</option>
            </Select>
            <Input
              label="Transaction ID / Ref (optional)"
              value={singleTxnId}
              onChange={(e) => setSingleTxnId(e.target.value)}
              placeholder="e.g. UPI Ref / Bank Txn ID"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Split Breakdown Rows
              </span>
              <button
                type="button"
                onClick={addSplitRow}
                className="text-xs font-semibold text-volt-400 hover:text-volt-300 flex items-center gap-1 transition-colors"
              >
                <Plus size={13} />
                <span>Add Method</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {splitRows.map((row, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5"
                >
                  <div className="w-32 shrink-0">
                    <Select
                      value={row.method}
                      onChange={(e) => updateSplitRow(idx, "method", e.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Txn</option>
                      <option value="cheque">Cheque</option>
                    </Select>
                  </div>

                  <div className="flex-1 relative">
                    <input
                      type="number"
                      placeholder="Amount (₹)"
                      value={row.amount}
                      onChange={(e) => updateSplitRow(idx, "amount", e.target.value)}
                      className="input text-xs !w-full font-mono font-semibold"
                      required
                    />
                  </div>

                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Txn ID (optional)"
                      value={row.transactionId}
                      onChange={(e) =>
                        updateSplitRow(idx, "transactionId", e.target.value)
                      }
                      className="input text-xs !w-full"
                    />
                  </div>

                  {splitRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSplitRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Remove method"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Allocation summary banner */}
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-pitch-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Total Allocated: </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ₹{totalSplit.toLocaleString("en-IN")}
                </span>
                <span className="text-slate-500 mx-1">/</span>
                <span className="text-slate-500 font-mono">
                  Due: ₹{target.amount.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                {totalSplit === target.amount ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1 font-mono text-[11px]">
                    <CheckCircle2 size={13} />
                    Balanced
                  </span>
                ) : totalSplit < target.amount ? (
                  <span className="text-amber-400 font-mono text-[11px]">
                    Remaining: ₹{(target.amount - totalSplit).toLocaleString("en-IN")}
                  </span>
                ) : (
                  <span className="text-rose-400 font-mono text-[11px]">
                    Over by ₹{(totalSplit - target.amount).toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <Button
          type="submit"
          loading={isLoading}
          className="w-full bg-volt-400 hover:bg-volt-300 text-pitch-900 font-bold uppercase py-2 mt-2"
        >
          {isMixed ? `Record Split Payment (₹${totalSplit})` : `Record Payment (₹${singleAmount})`}
        </Button>
      </form>
    </Modal>
  );
};

const EditPaymentModal: React.FC<{
  target: {
    feeId: string;
    installmentNumber: number;
    amount: number;
    paymentMethod?: string;
    transactionId?: string;
    paymentBreakdown?: PaymentBreakdownItem[];
  };
  onClose: () => void;
}> = ({ target, onClose }) => {
  const [updatePayment, { isLoading }] = useUpdatePaymentMutation();
  const hasExistingBreakdown = !!(
    target.paymentBreakdown && target.paymentBreakdown.length > 1
  );

  const [isMixed, setIsMixed] = useState(hasExistingBreakdown);
  const [singleAmount, setSingleAmount] = useState(String(target.amount));
  const [singleMethod, setSingleMethod] = useState(
    target.paymentMethod && target.paymentMethod !== "mixed"
      ? target.paymentMethod
      : "cash",
  );
  const [singleTxnId, setSingleTxnId] = useState(target.transactionId || "");

  const [splitRows, setSplitRows] = useState<
    { method: string; amount: string; transactionId: string }[]
  >(() => {
    if (target.paymentBreakdown && target.paymentBreakdown.length > 0) {
      return target.paymentBreakdown.map((b) => ({
        method: b.method,
        amount: String(b.amount),
        transactionId: b.transactionId || "",
      }));
    }
    return [
      {
        method: target.paymentMethod || "cash",
        amount: String(target.amount),
        transactionId: target.transactionId || "",
      },
    ];
  });

  const totalSplit = useMemo(() => {
    return splitRows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
  }, [splitRows]);

  const addSplitRow = () => {
    setSplitRows((prev) => [
      ...prev,
      { method: "upi", amount: "", transactionId: "" },
    ]);
  };

  const removeSplitRow = (idx: number) => {
    setSplitRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSplitRow = (
    idx: number,
    field: "method" | "amount" | "transactionId",
    value: string,
  ) => {
    setSplitRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isMixed) {
        const validBreakdown = splitRows
          .filter((r) => Number(r.amount) > 0)
          .map((r) => ({
            method: r.method,
            amount: Number(r.amount),
            transactionId: r.transactionId.trim() || undefined,
          }));

        if (validBreakdown.length === 0) {
          toast.error("Please provide valid split breakdown amounts");
          return;
        }

        const totalAmt = validBreakdown.reduce((sum, r) => sum + r.amount, 0);

        await updatePayment({
          feeId: target.feeId,
          installmentNumber: target.installmentNumber,
          amount: totalAmt,
          paymentMethod: validBreakdown.length > 1 ? "mixed" : validBreakdown[0].method,
          transactionId: validBreakdown.map((r) => r.transactionId).filter(Boolean).join(", ") || undefined,
          paymentBreakdown: validBreakdown,
        }).unwrap();
      } else {
        await updatePayment({
          feeId: target.feeId,
          installmentNumber: target.installmentNumber,
          amount: Number(singleAmount),
          paymentMethod: singleMethod,
          transactionId: singleTxnId.trim() || undefined,
          paymentBreakdown: [
            {
              method: singleMethod,
              amount: Number(singleAmount),
              transactionId: singleTxnId.trim() || undefined,
            },
          ],
        }).unwrap();
      }
      toast.success("Payment details updated successfully");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update payment — try again");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Edit Payment Details" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Mode */}
        <div className="flex p-1 bg-slate-100 dark:bg-pitch-800 rounded-lg border border-slate-200 dark:border-white/5">
          <button
            type="button"
            onClick={() => setIsMixed(false)}
            className={clsx(
              "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all text-center",
              !isMixed
                ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
            )}
          >
            Single Method
          </button>
          <button
            type="button"
            onClick={() => setIsMixed(true)}
            className={clsx(
              "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all text-center flex items-center justify-center gap-1.5",
              isMixed
                ? "bg-volt-400 text-pitch-950 shadow-sm font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
            )}
          >
            <span>Mixed / Split Payment</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-pitch-900/20 font-mono">
              Cash + UPI
            </span>
          </button>
        </div>

        {!isMixed ? (
          <div className="space-y-4">
            <Input
              label="Amount (₹)"
              type="number"
              value={singleAmount}
              onChange={(e) => setSingleAmount(e.target.value)}
              required
            />
            <Select
              label="Payment Method"
              value={singleMethod}
              onChange={(e) => setSingleMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI / GPay / PhonePe</option>
              <option value="card">Credit / Debit Card</option>
              <option value="bank_transfer">Bank Transfer / NEFT</option>
              <option value="cheque">Cheque</option>
            </Select>
            <Input
              label="Transaction ID / Ref (optional)"
              value={singleTxnId}
              onChange={(e) => setSingleTxnId(e.target.value)}
              placeholder="e.g. UPI Ref / Bank Txn ID"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Split Breakdown Rows
              </span>
              <button
                type="button"
                onClick={addSplitRow}
                className="text-xs font-semibold text-volt-400 hover:text-volt-300 flex items-center gap-1 transition-colors"
              >
                <Plus size={13} />
                <span>Add Method</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {splitRows.map((row, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5"
                >
                  <div className="w-32 shrink-0">
                    <Select
                      value={row.method}
                      onChange={(e) => updateSplitRow(idx, "method", e.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Txn</option>
                      <option value="cheque">Cheque</option>
                    </Select>
                  </div>

                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="Amount (₹)"
                      value={row.amount}
                      onChange={(e) => updateSplitRow(idx, "amount", e.target.value)}
                      className="input text-xs !w-full font-mono font-semibold"
                      required
                    />
                  </div>

                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Txn ID (optional)"
                      value={row.transactionId}
                      onChange={(e) =>
                        updateSplitRow(idx, "transactionId", e.target.value)
                      }
                      className="input text-xs !w-full"
                    />
                  </div>

                  {splitRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSplitRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Remove method"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Allocation summary banner */}
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-pitch-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Total Updated Amount: </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ₹{totalSplit.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        )}

        <Button
          type="submit"
          loading={isLoading}
          className="w-full bg-volt-400 hover:bg-volt-300 text-pitch-900 font-bold uppercase py-2 mt-2"
        >
          {isMixed ? `Save Changes (₹${totalSplit})` : `Save Changes (₹${singleAmount})`}
        </Button>
      </form>
    </Modal>
  );
};

export default FeesPage;
