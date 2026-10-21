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
  useGetPlatformDefaultRateQuery,
  useGetPlatformDefaultStaffRateQuery,
  type BillingAlert,
  type BillingTransaction,
} from "../../store/api/academySubscriptionApi";
import { Button, Badge, Skeleton, EmptyState, PageHeader, Card } from "../../components/ui";
import { useCurrency } from "../../hooks/useCurrency";
import { formatCurrency } from "../../utils/currency";
import { SubscriptionModal } from "./SubscriptionModal";
import { clsx } from "clsx";

const formatCleanPrice = (val: number): string => {
  const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
  // toFixed(2) then strip trailing zeros and optional trailing dot
  return rounded.toFixed(2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
};

export const SubscriptionManagementPage: React.FC = () => {
  const { user } = useSelector((s: RootState) => s.auth);
  const academyId = user?.academyId;
  const { currency, currencySymbol } = useCurrency();

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

  const { data: platformStudentRate } = useGetPlatformDefaultRateQuery();
  const { data: platformStaffRate } = useGetPlatformDefaultStaffRateQuery();

  const effectiveStudentRate =
    details?.ratePerStudentPerDay ??
    platformStudentRate ??
    details?.platformDefaultRate ??
    1;

  const effectiveStaffRate =
    details?.staffRatePerStaffPerMonth ??
    platformStaffRate ??
    details?.platformDefaultStaffRate ??
    10;

  const sym = details?.currencySymbol || currencySymbol || "₹";

  const openModal = (mode: "subscribe" | "upgrade") => {
    setModalMode(mode);
    setModalOpen(true);
  };

  if (!academyId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <EmptyState
          icon={<CreditCard size={28} />}
          title="No Academy Linked"
          description="No academy is associated with your account to manage subscription & billing."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        eyebrow="Platform Plan & Licensing"
        title="Subscription & Billing"
        badge={getStatusBadge()}
        subtitle="Manage your operational capacity quotas, billing cycles, rate cards, and payment history."
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs"
            >
              <RefreshCw size={13} className={clsx(isFetching && "animate-spin")} />
              Sync
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => openModal(hasSubscription ? "upgrade" : "subscribe")}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs font-bold"
            >
              <Zap size={14} />
              {hasSubscription ? "Upgrade Capacity" : "Subscribe Now"}
            </Button>
          </div>
        }
      />

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
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-2xs font-bold uppercase tracking-wider">Plan Cycle</span>
            <Calendar size={15} className="text-volt-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 dark:text-white capitalize">
              {details?.isTrial ? "Free Trial" : (details?.billingInterval || "Monthly")}
            </span>
            <span className="text-2xs text-slate-500 dark:text-slate-400">
              {details?.isTrial ? "Evaluation" : "Cadence"}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-2xs">
            <span className="text-slate-500 dark:text-slate-400">
              {details?.isTrial ? "Trial ends in" : "Renewal in"}
            </span>
            <span className="font-mono font-bold text-volt-400">
              {details?.isTrial ? (details?.trialDaysRemaining ?? 0) : (details?.daysRemainingInCycle ?? 0)} days
            </span>
          </div>
        </Card>

        {/* Card 2: Student Roster Capacity */}
        <Card>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-2xs font-bold uppercase tracking-wider">Student Slots</span>
            <Users size={15} className="text-volt-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900 dark:text-white">{details?.activeStudentCount ?? 0}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">/ {details?.provisionedCapacity ?? 0}</span>
            </div>
            <Badge
              variant={studentUtilization >= 100 ? "red" : studentUtilization >= 80 ? "yellow" : "green"}
              size="sm"
            >
              {studentUtilization}%
            </Badge>
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
            <span>{sym}{formatCleanPrice(effectiveStudentRate)}/student/day</span>
          </div>
        </Card>

        {/* Card 3: Staff & Coach Capacity */}
        <Card>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-2xs font-bold uppercase tracking-wider">Staff Quota</span>
            <UserCheck size={15} className="text-volt-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900 dark:text-white">{details?.activeStaffCount ?? 0}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">/ {details?.provisionedStaffCapacity ?? 0}</span>
            </div>
            <Badge
              variant={staffUtilization >= 100 ? "red" : staffUtilization >= 80 ? "yellow" : "green"}
              size="sm"
            >
              {staffUtilization}%
            </Badge>
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
            <span>{sym}{details?.staffRatePerStaffPerMonth ?? 10}/staff/mo</span>
          </div>
        </Card>

        {/* Card 4: Estimated Cycle Renewal */}
        <Card>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-2xs font-bold uppercase tracking-wider">
              {details?.isTrial ? "Post-Trial Pricing" : "Est. Next Renewal"}
            </span>
            <Sparkles size={15} className="text-volt-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-volt-400 font-mono">
              {sym}{(details?.estimatedRenewalRupees ?? 0).toLocaleString()}
            </span>
            <span className="text-2xs text-slate-500 dark:text-slate-400">/ cycle</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400">
            <span>Period End:</span>
            <span className="font-mono text-slate-700 dark:text-slate-200">
              {details?.currentPeriodEnd
                ? new Date(details.currentPeriodEnd).toLocaleDateString(details?.currency === "INR" ? "en-IN" : "en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Active"}
            </span>
          </div>
        </Card>
      </div>

      {/* Breakdown & Pricing Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Capacity Management Details */}
        <Card className="lg:col-span-2 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck size={16} className="text-volt-400" />
              Capacity &amp; Automated Quota Protection
            </h3>
            <span className="text-2xs text-slate-500 dark:text-slate-400">
              Currency: {details?.currency || "INR"}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Noxphere automatically protects your operational integrity by checking active player and staff numbers against your provisioned capacity. If you reach <strong>80%</strong> capacity, advance warning notifications are dispatched. At <strong>100%</strong>, new player enrollments are securely gated until capacity is expanded.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-pitch-800/60 border border-slate-200/80 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Student Rate Formula
                </span>
                <span className="text-xs font-mono font-bold text-volt-500 dark:text-volt-400">
                  {sym}{formatCleanPrice(effectiveStudentRate)} <span className="text-[10px] font-normal text-slate-500">/ day</span>
                </span>
              </div>
              <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Calculated on provisioned student capacity. Configured for {details?.currency || "INR"}:
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-200/60 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                  {sym}{formatCleanPrice(effectiveStudentRate * 30)}/mo
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-200/60 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                  {sym}{formatCleanPrice(effectiveStudentRate * 90)}/3-mo
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-200/60 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                  {sym}{formatCleanPrice(effectiveStudentRate * 180)}/6-mo
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-200/60 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                  {sym}{formatCleanPrice(effectiveStudentRate * 365)}/yr
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-pitch-800/60 border border-slate-200/80 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Staff Rate Formula
                </span>
                <span className="text-xs font-mono font-bold text-volt-500 dark:text-volt-400">
                  {sym}{formatCleanPrice(effectiveStaffRate)} <span className="text-[10px] font-normal text-slate-500">/ mo</span>
                </span>
              </div>
              <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Covers coach logins, tactical board access, attendance tools, and performance logs:
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-200/60 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                  {sym}{formatCleanPrice(effectiveStaffRate * 1)}/mo
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-200/60 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                  {sym}{formatCleanPrice(effectiveStaffRate * 3)}/3-mo
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-200/60 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                  {sym}{formatCleanPrice(effectiveStaffRate * 6)}/6-mo
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-200/60 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                  {sym}{formatCleanPrice(effectiveStaffRate * 12)}/yr
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Right: Quick Action Card */}
        <Card className="p-5 border-volt-400/30 bg-gradient-to-br from-volt-400/[0.08] via-transparent to-transparent flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-volt-500 dark:text-volt-400 font-bold text-xs uppercase tracking-wider mb-2">
              <Zap size={14} /> Instant Capacity Upgrade
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Need more slots for upcoming batches?</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              You can scale your student and coach capacity instantly. Prorated charges will be applied automatically via your Razorpay billing account.
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
        </Card>
      </div>

      {/* Invoice & Payment History */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-volt-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Payment &amp; Billing History</h3>
          </div>
          <span className="text-2xs text-slate-500 dark:text-slate-400">
            {details?.transactions?.length ?? 0} invoices recorded
          </span>
        </div>

        {!details?.transactions || details.transactions.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={28} />}
            title="No payment transactions recorded yet"
            description="When subscription checkout is completed, verified invoices and payment receipts will appear here."
          />
        ) : (
          <div className="table-responsive">
            <table className="w-full min-w-[560px] text-xs text-left">
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
                      <div>{formatCurrency(tx.amountPaid, tx.currency || details?.currency || currency)}</div>
                      {tx.currency && tx.currency !== "INR" && (
                        <div className="text-[10px] text-slate-400 font-normal font-sans mt-0.5">
                          {tx.exchangeRateToInr ? (
                            <>
                              ≈ ₹{Number(tx.amountInInr || (tx.amountPaid * tx.exchangeRateToInr)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}{" "}
                              <span className="text-slate-500">(@ ₹{Number(tx.exchangeRateToInr).toFixed(2)})</span>
                            </>
                          ) : (
                            <span>{tx.currency}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {tx.status === "paid" ? (
                        <Badge variant="green" size="sm">
                          <CheckCircle2 size={11} className="mr-1 inline" /> Paid
                        </Badge>
                      ) : (
                        <Badge variant="gray" size="sm">
                          {tx.status || "Pending"}
                        </Badge>
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
      </Card>

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
