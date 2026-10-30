// src/features/subscription/SubscriptionModal.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import { Zap, RefreshCw, Calendar, Users, Info, ShieldCheck } from "lucide-react";
import { clsx } from "clsx";
import { Modal, Button, Input, Card } from "../../components/ui";
import {
  useGetAcademySubscriptionStatusQuery,
  useGetPlatformDefaultRateQuery,
  useGetPlatformDefaultStaffRateQuery,
  useCreateRazorpaySubscriptionOrderMutation,
  useVerifyRazorpaySubscriptionPaymentMutation,
  type BillingInterval,
} from "../../store/api/academySubscriptionApi";
import { openRazorpayCheckout } from "../../utils/razorpay";
import { RootState } from "../../store";
import { useCurrency } from "../../hooks/useCurrency";
import { formatCurrency as formatMoney } from "../../utils/currency";

interface SubscriptionModalProps {
  academyId: string;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: "subscribe" | "upgrade" | "renew";
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  academyId,
  onClose,
  onSuccess,
  mode = "upgrade",
}) => {
  const user = useSelector((s: RootState) => s.auth.user);
  const { currency: defaultCurrency, currencySymbol: defaultSymbol } = useCurrency();
  const { data: status, isLoading } = useGetAcademySubscriptionStatusQuery(academyId);
  const { data: platformStudentRate } = useGetPlatformDefaultRateQuery();
  const { data: platformStaffRate } = useGetPlatformDefaultStaffRateQuery();

  const curr = status?.currency || defaultCurrency || "INR";
  const formatCurrency = (n: number) => formatMoney(n, curr);

  const [createRazorpayOrder, { isLoading: creatingOrder }] = useCreateRazorpaySubscriptionOrderMutation();
  const [verifyRazorpayPayment, { isLoading: verifyingPayment }] = useVerifyRazorpaySubscriptionPaymentMutation();

  const isAlreadyActive = Boolean(
    status?.isActive &&
    !status?.isTrial &&
    status?.currentPeriodEnd &&
    new Date(status.currentPeriodEnd) > new Date()
  );

  // Tab state: "topup" (prorated capacity increase) or "renew" (plan extension / cycle change)
  const [activeTab, setActiveTab] = useState<"topup" | "renew">(
    isAlreadyActive && mode === "upgrade" ? "topup" : "renew"
  );

  const [capacity, setCapacity] = useState(20);
  const [staffCapacity, setStaffCapacity] = useState(0);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (status && !initialized) {
      setCapacity(Math.max(status.activeStudentCount || 10, status.provisionedCapacity || 10));
      setStaffCapacity(status.provisionedStaffCapacity || 0);
      if (status.billingInterval) setBillingInterval(status.billingInterval);
      if (isAlreadyActive && mode === "upgrade") {
        setActiveTab("topup");
      } else {
        setActiveTab("renew");
      }
      setInitialized(true);
    }
  }, [status, initialized, isAlreadyActive, mode]);

  const rate =
    status?.currentDefaultRate ??
    platformStudentRate ??
    status?.ratePerStudentPerDay ??
    1;

  const staffRate =
    status?.currentDefaultStaffRate ??
    platformStaffRate ??
    status?.staffRatePerStaffPerMonth ??
    10;

  // Remaining days in active cycle
  const remainingDays = useMemo(() => {
    if (!status?.currentPeriodEnd) return 0;
    const diff = new Date(status.currentPeriodEnd).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [status?.currentPeriodEnd]);

  // Delta for mid-cycle topup
  const baselineCapacity = status?.provisionedCapacity ?? 0;
  const baselineStaff = status?.provisionedStaffCapacity ?? 0;
  const extraStudents = Math.max(0, capacity - baselineCapacity);
  const extraStaff = Math.max(0, staffCapacity - baselineStaff);

  // Prorated Top-Up calculation
  const topupStudentCost = useMemo(
    () => Math.round((rate * extraStudents * remainingDays + Number.EPSILON) * 100) / 100,
    [rate, extraStudents, remainingDays]
  );
  const topupStaffCost = useMemo(
    () => Math.round((staffRate * extraStaff * (remainingDays / 30) + Number.EPSILON) * 100) / 100,
    [staffRate, extraStaff, remainingDays]
  );
  const topupTotal = Math.max(0, Math.round((topupStudentCost + topupStaffCost + Number.EPSILON) * 100) / 100);

  // Full Renewal calculation
  const cycleDays =
    billingInterval === "month"
      ? 30
      : billingInterval === "quarter"
      ? 90
      : billingInterval === "half_year"
      ? 180
      : 365;
  const cycleMonths =
    billingInterval === "month"
      ? 1
      : billingInterval === "quarter"
      ? 3
      : billingInterval === "half_year"
      ? 6
      : 12;

  const renewalStudentCost = useMemo(
    () => Math.round((rate * capacity * cycleDays + Number.EPSILON) * 100) / 100,
    [rate, capacity, cycleDays]
  );
  const renewalStaffCost = useMemo(
    () => Math.round((staffRate * staffCapacity * cycleMonths + Number.EPSILON) * 100) / 100,
    [staffRate, staffCapacity, cycleMonths]
  );
  const renewalTotal = Math.round((renewalStudentCost + renewalStaffCost + Number.EPSILON) * 100) / 100;

  const handlePayment = async () => {
    try {
      const isTopup = isAlreadyActive && activeTab === "topup";
      const isRenewal = !isTopup && (isAlreadyActive || (status?.hasSubscription && !status?.isActive));

      if (isTopup && extraStudents === 0 && extraStaff === 0) {
        toast.error("Please specify additional students or staff to top up.");
        return;
      }

      const orderData = await createRazorpayOrder({
        academyId,
        capacity,
        staffCapacity,
        billingInterval: isTopup ? undefined : billingInterval,
        isRenewal,
        isTopup,
      }).unwrap();

      const description = isTopup
        ? `Prorated Top-Up: +${extraStudents} Students, +${extraStaff} Staff (${remainingDays} days)`
        : `${isRenewal ? "Renew" : "Subscribe"} Plan: ${capacity} Students (${billingInterval})`;

      const paymentResponse = await openRazorpayCheckout({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Noxphere",
        description,
        order_id: orderData.orderId,
        prefill: {
          name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email,
          email: user?.email || "",
        },
        theme: {
          color: "#10b981",
        },
      });

      await verifyRazorpayPayment({
        academyId,
        orderId: paymentResponse.razorpay_order_id,
        paymentId: paymentResponse.razorpay_payment_id,
        signature: paymentResponse.razorpay_signature,
      }).unwrap();

      toast.success(
        isTopup
          ? "Capacity topped up successfully!"
          : isRenewal
          ? "Subscription renewed successfully!"
          : "Subscription activated successfully!"
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      if (err?.message === "Payment cancelled by user") {
        toast("Payment cancelled");
      } else {
        toast.error(err?.data?.message || err?.message || "Payment failed — please try again");
      }
    }
  };

  const modalTitle = !isAlreadyActive
    ? status?.hasSubscription
      ? "Renew Academy Plan"
      : "Subscribe to Noxphere"
    : activeTab === "topup"
    ? "Top Up Capacity (Mid-Cycle)"
    : "Renew / Change Billing Cycle";

  return (
    <Modal isOpen={true} onClose={onClose} title={modalTitle} size="md">
      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading plan details…</div>
      ) : (
        <div className="space-y-5">
          {/* Active Subscription Mode Tabs */}
          {isAlreadyActive && (
            <div className="flex rounded-lg bg-slate-100 dark:bg-pitch-800 p-1 border border-slate-200 dark:border-white/5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("topup");
                  setCapacity(Math.max(status?.activeStudentCount || 10, baselineCapacity));
                  setStaffCapacity(baselineStaff);
                }}
                className={clsx(
                  "flex-1 py-2 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5",
                  activeTab === "topup"
                    ? "bg-volt-400 text-pitch-900 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Zap size={13} />
                Top Up Slots (Prorated)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("renew")}
                className={clsx(
                  "flex-1 py-2 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5",
                  activeTab === "renew"
                    ? "bg-volt-400 text-pitch-900 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <RefreshCw size={13} />
                Renew / Change Cycle
              </button>
            </div>
          )}

          {/* Context Banner */}
          {isAlreadyActive && activeTab === "topup" ? (
            <div className="p-3 bg-volt-400/10 border border-volt-400/20 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                <span>Active Cycle: {remainingDays} days remaining</span>
                <span className="font-mono text-volt-500 dark:text-volt-400">
                  Ends {new Date(status!.currentPeriodEnd!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Add extra slots for your ongoing batches. You are only billed for the <strong>extra slots</strong> for the <strong>remaining {remainingDays} days</strong>. Your cycle end date stays the same.
              </p>
            </div>
          ) : isAlreadyActive && activeTab === "renew" ? (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                <span>Stack Renewal to Current Expiration</span>
                <span className="font-mono text-indigo-400">
                  Starts {new Date(status!.currentPeriodEnd!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Renew now to secure your capacity or change your cadence. The new period will automatically begin when your current period concludes. Zero active days are lost.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Select your required player &amp; coaching staff quota along with your billing cycle.
            </p>
          )}

          {/* Inputs Section */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {isAlreadyActive && activeTab === "topup" ? "New Total Student Capacity" : "Student Capacity"}
                </label>
                {isAlreadyActive && activeTab === "topup" && (
                  <span className="text-2xs text-slate-500 dark:text-slate-400 font-mono">
                    Current: {baselineCapacity} slots {extraStudents > 0 && <span className="text-emerald-500 font-bold">(+{extraStudents} extra)</span>}
                  </span>
                )}
              </div>
              <Input
                type="number"
                min={isAlreadyActive && activeTab === "topup" ? baselineCapacity : 1}
                value={capacity}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  const min = isAlreadyActive && activeTab === "topup" ? baselineCapacity : 1;
                  setCapacity(Math.max(min, val));
                }}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {isAlreadyActive && activeTab === "topup" ? "New Total Staff Seats (Coaches/Ops)" : "Staff Seats"}
                </label>
                {isAlreadyActive && activeTab === "topup" && (
                  <span className="text-2xs text-slate-500 dark:text-slate-400 font-mono">
                    Current: {baselineStaff} seats {extraStaff > 0 && <span className="text-emerald-500 font-bold">(+{extraStaff} extra)</span>}
                  </span>
                )}
              </div>
              <Input
                type="number"
                min={isAlreadyActive && activeTab === "topup" ? baselineStaff : 0}
                value={staffCapacity}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  const min = isAlreadyActive && activeTab === "topup" ? baselineStaff : 0;
                  setStaffCapacity(Math.max(min, val));
                }}
              />
            </div>

            {/* Cycle Selection: Hidden during mid-cycle topup, visible for renewals and new subscriptions */}
            {(!isAlreadyActive || activeTab === "renew") && (
              <div className="space-y-1.5 pt-1">
                <label className="label">Select Billing Cycle</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    { id: "month", label: "Monthly", sub: "30 days" },
                    { id: "quarter", label: "3 Months", sub: "90 days" },
                    { id: "half_year", label: "6 Months", sub: "180 days" },
                    { id: "year", label: "Yearly", sub: "365 days" },
                  ] as const).map((cycle) => (
                    <button
                      key={cycle.id}
                      type="button"
                      onClick={() => setBillingInterval(cycle.id)}
                      className={`rounded-lg px-2.5 py-2 text-xs font-semibold border transition-all text-center ${
                        billingInterval === cycle.id
                          ? "bg-volt-400 border-volt-400 text-pitch-900 shadow-sm"
                          : "bg-slate-100 dark:bg-pitch-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                      }`}
                    >
                      <div>{cycle.label}</div>
                      <div
                        className={`text-[10px] ${
                          billingInterval === cycle.id ? "text-pitch-900/80 font-medium" : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {cycle.sub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pricing & Math Transparency Breakdown */}
          <Card className="p-3.5 bg-slate-50 dark:bg-pitch-900/60 border-slate-200/80 dark:border-white/5 space-y-2">
            {isAlreadyActive && activeTab === "topup" ? (
              <>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Extra Students ({extraStudents} × {formatCurrency(rate)}/day × {remainingDays}d)
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{formatCurrency(topupStudentCost)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Extra Staff ({extraStaff} × {formatCurrency(staffRate)}/mo × {Number(remainingDays / 30).toFixed(2)}mo)
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{formatCurrency(topupStaffCost)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-white/10 mt-1">
                  <span>Prorated Top-Up Due Now</span>
                  <span className="text-volt-500 dark:text-volt-400 font-mono font-black">{formatCurrency(topupTotal)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Students ({capacity} × {formatCurrency(rate)}/day × {cycleDays}d)
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{formatCurrency(renewalStudentCost)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Staff ({staffCapacity} × {formatCurrency(staffRate)}/mo × {cycleMonths}mo)
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{formatCurrency(renewalStaffCost)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-white/10 mt-1">
                  <span>Total Amount for {cycleDays} Days</span>
                  <span className="text-volt-500 dark:text-volt-400 font-mono font-black">{formatCurrency(renewalTotal)}</span>
                </div>
              </>
            )}
          </Card>

          {/* Action CTA */}
          <Button
            variant="primary"
            className="w-full font-bold uppercase tracking-wide justify-center py-2.5"
            loading={creatingOrder || verifyingPayment}
            disabled={isAlreadyActive && activeTab === "topup" && extraStudents === 0 && extraStaff === 0}
            onClick={handlePayment}
          >
            {isAlreadyActive && activeTab === "topup"
              ? extraStudents === 0 && extraStaff === 0
                ? "Enter Additional Slots Above"
                : `Pay ${formatCurrency(topupTotal)} & Add Slots`
              : `Pay ${formatCurrency(renewalTotal)} & Confirm Plan`}
          </Button>
        </div>
      )}
    </Modal>
  );
};
