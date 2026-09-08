// src/features/subscription/SubscriptionManagementPage.tsx
import React, { useState } from "react";
import { useSelector } from "react-redux";
import {
  CreditCard,
  Zap,
  Users,
  UserCheck,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import { RootState } from "../../store";
import {
  useGetAcademyBillingDetailsQuery,
  type BillingAlert,
  type BillingTransaction,
} from "../../store/api/academySubscriptionApi";
import { Button, Badge, Skeleton } from "../../components/ui";
import { SubscriptionModal } from "./SubscriptionModal";
import { clsx } from "clsx";

export const SubscriptionManagementPage: React.FC = () => {
  const { user } = useSelector((s: RootState) => s.auth);
  const academyId = user?.academyId;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"subscribe" | "upgrade">("upgrade");

  const {
    data: details,
    isLoading,
    isFetching,
    refetch,
  } = useGetAcademyBillingDetailsQuery(academyId || "", {
    skip: !academyId,
  });

  const openModal = (mode: "subscribe" | "upgrade") => {
    setModalMode(mode);
    setModalOpen(true);
  };

  if (!academyId) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-400">No academy associated with your account.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const hasSubscription = details?.hasSubscription && details.isActive;
  const studentUtilization = details?.studentUtilization ?? 0;
  const staffUtilization = details?.staffUtilization ?? 0;

  const getStatusBadge = () => {
    if (!details?.hasSubscription) {
      return <Badge variant="gray">No Active Plan</Badge>;
    }
    switch (details.status) {
      case "active":
        return <Badge variant="green">Active</Badge>;
      case "past_due":
        return <Badge variant="yellow">Past Due</Badge>;
      case "incomplete":
        return <Badge variant="red">Incomplete</Badge>;
      case "canceled":
        return <Badge variant="red">Canceled</Badge>;
      default:
        return <Badge variant="blue">{details.status || "Subscribed"}</Badge>;
    }
  };

  const getProgressBarColor = (utilization: number) => {
    if (utilization >= 100) return "bg-ember-500 shadow-ember-500/50";
    if (utilization >= 80) return "bg-amber-400 shadow-amber-400/50";
    return "bg-volt-400 shadow-volt-400/50";
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <CreditCard className="text-volt-400" size={24} />
              Subscription & Billing
            </h1>
            {getStatusBadge()}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your operational capacity quotas, billing cycles, rate cards, and payment history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <RefreshCw size={13} className={clsx(isFetching && "animate-spin")} />
            Sync
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => openModal(hasSubscription ? "upgrade" : "subscribe")}
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            <Zap size={14} />
            {hasSubscription ? "Upgrade Capacity" : "Subscribe Now"}
          </Button>
        </div>
      </div>

      {/* Active System Warnings / Alerts */}
      {details?.alerts && details.alerts.length > 0 && (
        <div className="space-y-2.5">
          {details.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={clsx(
                "p-4 rounded-xl border flex items-start justify-between gap-4 transition-all",
                alert.type === "danger"
                  ? "bg-ember-500/10 border-ember-500/30 text-ember-400 dark:text-ember-300"
                  : alert.type === "warning"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-300"
                    : "bg-blue-500/10 border-blue-500/30 text-blue-500 dark:text-blue-300"
              )}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={18}
                  className={clsx(
                    "mt-0.5 shrink-0",
                    alert.type === "danger"
                      ? "text-ember-500 dark:text-ember-400"
                      : alert.type === "warning"
                        ? "text-amber-500 dark:text-amber-400"
                        : "text-blue-500 dark:text-blue-400"
                  )}
                />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">{alert.title}</h4>
                  <p className="text-xs opacity-90 mt-0.5">{alert.message}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant={alert.type === "danger" ? "danger" : "secondary"}
                onClick={() => openModal("upgrade")}
                className="shrink-0 text-2xs uppercase font-extrabold"
              >
                Expand Capacity
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Plan & Billing Interval */}
        <div className="card p-4 rounded-xl border border-slate-200/80 dark:border-white/5 bg-white dark:bg-pitch-900/60 relative overflow-hidden shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-2xs font-bold uppercase tracking-wider">Plan Cycle</span>
            <Calendar size={15} className="text-volt-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 dark:text-white capitalize">
              {details?.billingInterval || "Monthly"}
            </span>
            <span className="text-2xs text-slate-500 dark:text-slate-400">Cadence</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-2xs">
            <span className="text-slate-500 dark:text-slate-400">Renewal in</span>
            <span className="font-mono font-bold text-volt-400">
              {details?.daysRemainingInCycle ?? 0} days
            </span>
          </div>
        </div>

        {/* Card 2: Student Roster Capacity */}
        <div className="card p-4 rounded-xl border border-slate-200/80 dark:border-white/5 bg-white dark:bg-pitch-900/60 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-2xs font-bold uppercase tracking-wider">Student Slots</span>
            <Users size={15} className="text-volt-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900 dark:text-white">{details?.activeStudentCount ?? 0}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">/ {details?.provisionedCapacity ?? 0}</span>
            </div>
            <span
              className={clsx(
                "text-2xs font-bold font-mono px-1.5 py-0.5 rounded",
                studentUtilization >= 100
                  ? "bg-ember-500/20 text-ember-500 dark:text-ember-400"
                  : studentUtilization >= 80
                    ? "bg-amber-400/20 text-amber-600 dark:text-amber-300"
                    : "bg-volt-400/10 text-volt-400"
              )}
            >
              {studentUtilization}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-pitch-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className={clsx("h-full rounded-full transition-all duration-500", getProgressBarColor(studentUtilization))}
              style={{ width: `${Math.min(100, studentUtilization)}%` }}
            />
          </div>
          <div className="mt-2 text-2xs text-slate-500 dark:text-slate-400 flex justify-between">
            <span>{details?.remainingStudentSlots ?? 0} slots remaining</span>
            <span>₹{details?.ratePerStudentPerDay ?? 1}/student/day</span>
          </div>
        </div>

        {/* Card 3: Staff & Coach Capacity */}
        <div className="card p-4 rounded-xl border border-slate-200/80 dark:border-white/5 bg-white dark:bg-pitch-900/60 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-2xs font-bold uppercase tracking-wider">Staff Quota</span>
            <UserCheck size={15} className="text-volt-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900 dark:text-white">{details?.activeStaffCount ?? 0}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">/ {details?.provisionedStaffCapacity ?? 0}</span>
            </div>
            <span
              className={clsx(
                "text-2xs font-bold font-mono px-1.5 py-0.5 rounded",
                staffUtilization >= 100
                  ? "bg-ember-500/20 text-ember-500 dark:text-ember-400"
                  : staffUtilization >= 80
                    ? "bg-amber-400/20 text-amber-600 dark:text-amber-300"
                    : "bg-volt-400/10 text-volt-400"
              )}
            >
              {staffUtilization}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-pitch-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className={clsx("h-full rounded-full transition-all duration-500", getProgressBarColor(staffUtilization))}
              style={{ width: `${Math.min(100, staffUtilization)}%` }}
            />
          </div>
          <div className="mt-2 text-2xs text-slate-500 dark:text-slate-400 flex justify-between">
            <span>{details?.remainingStaffSlots ?? 0} slots remaining</span>
            <span>₹{details?.staffRatePerStaffPerMonth ?? 10}/staff/mo</span>
          </div>
        </div>

        {/* Card 4: Estimated Cycle Renewal */}
        <div className="card p-4 rounded-xl border border-slate-200/80 dark:border-white/5 bg-white dark:bg-pitch-900/60 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-2xs font-bold uppercase tracking-wider">Est. Next Renewal</span>
            <Sparkles size={15} className="text-volt-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-volt-400 font-mono">
              ₹{(details?.estimatedRenewalRupees ?? 0).toLocaleString("en-IN")}
            </span>
            <span className="text-2xs text-slate-500 dark:text-slate-400">/ cycle</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400">
            <span>Period End:</span>
            <span className="font-mono text-slate-700 dark:text-slate-200">
              {details?.currentPeriodEnd
                ? new Date(details.currentPeriodEnd).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Active"}
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown & Pricing Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Capacity Management Details */}
        <div className="lg:col-span-2 card p-5 rounded-xl border border-slate-200/80 dark:border-white/5 bg-white dark:bg-pitch-900/40 shadow-sm dark:shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck size={16} className="text-volt-400" />
              Capacity & Automated Quota Protection
            </h3>
            <span className="text-2xs text-slate-500 dark:text-slate-400">Stripe Synchronized</span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Noxphere automatically protects your operational integrity by checking active player and staff numbers against your provisioned capacity. If you reach <strong>80%</strong> capacity, advance warning notifications are dispatched. At <strong>100%</strong>, new player enrollments are securely gated until capacity is expanded.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-pitch-800/60 border border-slate-200/80 dark:border-white/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase">Student Rate Formula</span>
                <span className="text-xs font-mono font-bold text-volt-400">₹1 / day</span>
              </div>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Calculated on provisioned student capacity. 30 days per month or 365 days per annual cycle.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-pitch-800/60 border border-slate-200/80 dark:border-white/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase">Staff Rate Formula</span>
                <span className="text-xs font-mono font-bold text-volt-400">₹10 / mo</span>
              </div>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Covers coach logins, tactical dashboard access, attendance tools, and performance tracking.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Card */}
        <div className="card p-5 rounded-xl border border-volt-400/30 dark:border-volt-400/20 bg-volt-400/[0.05] dark:bg-volt-400/[0.02] flex flex-col justify-between space-y-4 shadow-sm dark:shadow-none">
          <div>
            <div className="flex items-center gap-2 text-volt-500 dark:text-volt-400 font-bold text-xs uppercase tracking-wider mb-2">
              <Zap size={14} /> Instant Capacity Upgrade
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Need more slots for upcoming batches?</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              You can scale your student and coach capacity instantly. Prorated charges will be applied automatically via your Stripe billing account.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <Button
              variant="primary"
              onClick={() => openModal("upgrade")}
              className="w-full text-xs font-bold py-2.5"
            >
              Modify Provisioned Capacity
            </Button>
            <p className="text-center text-[11px] text-slate-500">
              Zero downtime · Instant activation
            </p>
          </div>
        </div>
      </div>

      {/* Invoice & Payment History */}
      <div className="card rounded-xl border border-slate-200/80 dark:border-white/5 bg-white dark:bg-pitch-900/40 shadow-sm dark:shadow-none overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-volt-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Payment & Billing History</h3>
          </div>
          <span className="text-2xs text-slate-500 dark:text-slate-400">
            {details?.transactions?.length ?? 0} invoices recorded
          </span>
        </div>

        {!details?.transactions || details.transactions.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Info size={28} className="mx-auto text-slate-400 dark:text-slate-500" />
            <p className="text-xs text-slate-500 dark:text-slate-400">No payment transactions recorded yet.</p>
            <p className="text-2xs text-slate-400 dark:text-slate-500">
              When subscription checkout is completed, verified Stripe invoices and tax receipts will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-2xs uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-pitch-950/60 border-b border-slate-200/80 dark:border-white/5 font-mono">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Receipt / PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                {details.transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-slate-900 dark:text-white font-medium">
                      {tx.number || tx.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-sans">
                      {new Date(tx.created).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4 text-volt-400 font-bold">
                      ₹{tx.amountPaid.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4">
                      {tx.status === "paid" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20 px-2 py-0.5 rounded">
                          <CheckCircle2 size={11} /> Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-bold uppercase text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {tx.status || "Pending"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {tx.hostedInvoiceUrl ? (
                        <a
                          href={tx.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-2xs text-volt-500 dark:text-volt-400 hover:underline font-sans font-semibold"
                        >
                          View Receipt <ExternalLink size={11} />
                        </a>
                      ) : tx.invoicePdf ? (
                        <a
                          href={tx.invoicePdf}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-2xs text-volt-500 dark:text-volt-400 hover:underline font-sans font-semibold"
                        >
                          <Download size={11} /> PDF
                        </a>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-2xs">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscription / Upgrade Modal */}
      {modalOpen && (
        <SubscriptionModal
          academyId={academyId}
          mode={modalMode}
          onClose={() => {
            setModalOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default SubscriptionManagementPage;
