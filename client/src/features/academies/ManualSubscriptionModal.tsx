// src/features/academies/ManualSubscriptionModal.tsx
import React, { useState, useEffect, useMemo } from "react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import {
  Globe2,
  CheckCircle2,
  CreditCard,
  Plus,
  Clock,
  TrendingUp,
  AlertTriangle,
  Banknote,
  Calendar,
  Sparkles,
  Users,
  Shield,
  Loader2,
} from "lucide-react";
import { Button, Input, Modal, Select } from "../../components/ui";
import {
  academySubscriptionApi,
  BillingInterval,
  useGetAcademySubscriptionStatusQuery,
  useGetPlatformDefaultRateQuery,
  useGetPlatformDefaultStaffRateQuery,
} from "@/store/api/academySubscriptionApi";
import { Academy } from "./types";
import { getCurrencySymbol } from "../../utils/currency";

interface ManualSubscriptionModalProps {
  academy: Academy | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ManualSubscriptionModal: React.FC<ManualSubscriptionModalProps> = ({
  academy,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const academyId = academy?.id ?? "";

  const { data: status, isLoading: isStatusLoading, refetch: refetchStatus } = useGetAcademySubscriptionStatusQuery(
    academyId,
    { skip: !isOpen || !academyId }
  );

  const { data: platformStudentRate } = useGetPlatformDefaultRateQuery(undefined, {
    skip: !isOpen,
  });
  const { data: platformStaffRate } = useGetPlatformDefaultStaffRateQuery(undefined, {
    skip: !isOpen,
  });

  const [manualProvisionSub, { isLoading: isSubmitting }] =
    academySubscriptionApi.useManualProvisionSubscriptionMutation();

  const isAlreadyActive = Boolean(
    status?.status === "active" &&
    !status?.isTrial &&
    status?.currentPeriodEnd &&
    new Date(status.currentPeriodEnd) > new Date()
  );

  // Tab State: "topup" (prorated capacity increase), "renew" (extend cycle), "initial" (new license)
  const [activeTab, setActiveTab] = useState<"topup" | "renew" | "initial">("topup");

  // Top-Up Inputs (Additional slots)
  const [extraStudentsInput, setExtraStudentsInput] = useState("10");
  const [extraStaffInput, setExtraStaffInput] = useState("0");

  // Renewal / Initial Inputs (Total capacity)
  const [totalStudentsInput, setTotalStudentsInput] = useState("50");
  const [totalStaffInput, setTotalStaffInput] = useState("5");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [durationDaysInput, setDurationDaysInput] = useState("30");

  // Common payment fields
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "cheque" | "other" | "waived">(
    "cash"
  );
  const [customAmountPaid, setCustomAmountPaid] = useState("");
  const [referenceNote, setReferenceNote] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Sync state whenever academy or status changes
  useEffect(() => {
    if (isOpen && status && !initialized) {
      const activeCount = status.activeStudentCount || 0;
      const baseCap = status.provisionedCapacity || academy?.trialCapacity || 50;
      const baseStaff = status.provisionedStaffCapacity !== undefined ? status.provisionedStaffCapacity : (academy?.trialStaffCapacity ?? 5);

      setTotalStudentsInput(String(Math.max(activeCount, baseCap)));
      setTotalStaffInput(String(baseStaff));
      setExtraStudentsInput("10");
      setExtraStaffInput("0");
      setCustomAmountPaid("");
      setReferenceNote("");

      if (status.billingInterval) {
        setBillingInterval(status.billingInterval);
      }

      if (isAlreadyActive) {
        setActiveTab("topup");
      } else if (status.isTrial) {
        setActiveTab("initial");
      } else {
        setActiveTab("renew");
      }

      setInitialized(true);
    }
  }, [isOpen, status, initialized, isAlreadyActive, academy]);

  // Reset initialization flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      setInitialized(false);
      setCustomAmountPaid("");
      setReferenceNote("");
    }
  }, [isOpen]);

  // Currency & Rates
  const currency = (academy?.currency || status?.currency || "INR").toUpperCase();
  const currencySymbol = getCurrencySymbol(currency);

  const rate =
    (status?.ratePerStudentPerDay && Number(status.ratePerStudentPerDay) > 0 ? Number(status.ratePerStudentPerDay) : undefined) ??
    (status?.currentDefaultRate && Number(status.currentDefaultRate) > 0 ? Number(status.currentDefaultRate) : undefined) ??
    (platformStudentRate && Number(platformStudentRate) > 0 ? Number(platformStudentRate) : undefined) ??
    1;

  const staffRate =
    (status?.staffRatePerStaffPerMonth && Number(status.staffRatePerStaffPerMonth) > 0 ? Number(status.staffRatePerStaffPerMonth) : undefined) ??
    (status?.currentDefaultStaffRate && Number(status.currentDefaultStaffRate) > 0 ? Number(status.currentDefaultStaffRate) : undefined) ??
    (platformStaffRate && Number(platformStaffRate) > 0 ? Number(platformStaffRate) : undefined) ??
    10;

  // Remaining days in current cycle
  const remainingDays = useMemo(() => {
    if (!status?.currentPeriodEnd) return 0;
    const diff = new Date(status.currentPeriodEnd).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [status?.currentPeriodEnd]);

  // Baseline capacities
  const baselineCapacity = status?.provisionedCapacity ?? academy?.trialCapacity ?? 50;
  const baselineStaff = status?.provisionedStaffCapacity ?? academy?.trialStaffCapacity ?? 5;
  const activeStudentCount = status?.activeStudentCount ?? 0;
  const activeStaffCount = status?.activeStaffCount ?? 0;

  // Top-Up calculations
  const extraStudents = Math.max(0, parseInt(extraStudentsInput, 10) || 0);
  const extraStaff = Math.max(0, parseInt(extraStaffInput, 10) || 0);
  const topupTotalStudents = baselineCapacity + extraStudents;
  const topupTotalStaff = baselineStaff + extraStaff;

  const topupStudentCost = useMemo(() => {
    return Math.round((rate * extraStudents * remainingDays + Number.EPSILON) * 100) / 100;
  }, [rate, extraStudents, remainingDays]);

  const topupStaffCost = useMemo(() => {
    return Math.round((staffRate * extraStaff * (remainingDays / 30) + Number.EPSILON) * 100) / 100;
  }, [staffRate, extraStaff, remainingDays]);

  const topupCalculatedTotal = Math.max(
    0,
    Math.round((topupStudentCost + topupStaffCost + Number.EPSILON) * 100) / 100
  );

  // Renewal / Initial calculations
  const renewalStudents = Math.max(1, parseInt(totalStudentsInput, 10) || 1);
  const renewalStaff = Math.max(0, parseInt(totalStaffInput, 10) || 0);
  const durationDays = Math.max(1, parseInt(durationDaysInput, 10) || 30);

  const cycleMonths =
    billingInterval === "month"
      ? 1
      : billingInterval === "quarter"
      ? 3
      : billingInterval === "half_year"
      ? 6
      : 12;

  const renewalStudentCost = useMemo(() => {
    return Math.round((rate * renewalStudents * durationDays + Number.EPSILON) * 100) / 100;
  }, [rate, renewalStudents, durationDays]);

  const renewalStaffCost = useMemo(() => {
    return Math.round((staffRate * renewalStaff * cycleMonths + Number.EPSILON) * 100) / 100;
  }, [staffRate, renewalStaff, cycleMonths]);

  const renewalCalculatedTotal = Math.max(
    0,
    Math.round((renewalStudentCost + renewalStaffCost + Number.EPSILON) * 100) / 100
  );

  // Effective displayed & submitted amount
  const autoCalculatedAmount = activeTab === "topup" ? topupCalculatedTotal : renewalCalculatedTotal;
  const effectiveAmount =
    paymentMethod === "waived"
      ? 0
      : customAmountPaid !== ""
      ? parseFloat(customAmountPaid) || 0
      : autoCalculatedAmount;

  // New Expiry Date Previews
  const renewalExpiryPreview = useMemo(() => {
    if (activeTab === "topup") {
      return status?.currentPeriodEnd ? new Date(status.currentPeriodEnd).toLocaleDateString() : "Unchanged";
    }
    const baseDate =
      activeTab === "renew" && status?.currentPeriodEnd && new Date(status.currentPeriodEnd) > new Date()
        ? new Date(status.currentPeriodEnd)
        : new Date();
    const newEnd = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    return newEnd.toLocaleDateString();
  }, [activeTab, status?.currentPeriodEnd, durationDays]);

  const handleSubmit = async () => {
    if (!academy) return;

    try {
      if (activeTab === "topup") {
        if (extraStudents === 0 && extraStaff === 0) {
          toast.error("Please specify at least 1 additional student slot or staff seat to top up.");
          return;
        }

        await manualProvisionSub({
          academyId: academy.id,
          extraStudents,
          extraStaff,
          studentCapacity: topupTotalStudents,
          staffCapacity: topupTotalStaff,
          actionType: "upgrade",
          paymentMethod,
          amountPaid: effectiveAmount,
          referenceNote: referenceNote.trim() || undefined,
        }).unwrap();

        toast.success(
          `Top-Up applied! Added +${extraStudents} student slots & +${extraStaff} staff seats for ${academy.name}.`
        );
      } else {
        if (renewalStudents < activeStudentCount) {
          toast.error(
            `Cannot set ${renewalStudents} student slots because ${activeStudentCount} players are currently active.`
          );
          return;
        }
        if (renewalStaff < activeStaffCount) {
          toast.error(
            `Cannot set ${renewalStaff} staff seats because ${activeStaffCount} staff members are currently active.`
          );
          return;
        }

        await manualProvisionSub({
          academyId: academy.id,
          studentCapacity: renewalStudents,
          staffCapacity: renewalStaff,
          billingInterval,
          durationDays,
          actionType: activeTab === "renew" ? "renewal" : "new",
          paymentMethod,
          amountPaid: effectiveAmount,
          referenceNote: referenceNote.trim() || undefined,
        }).unwrap();

        toast.success(
          activeTab === "renew"
            ? `Subscription renewed successfully for ${academy.name}!`
            : `Initial subscription license activated for ${academy.name}!`
        );
      }

      refetchStatus();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to record payment & provision subscription");
    }
  };

  if (!academy) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Offline Payment & Slot Provisioning: ${academy.name}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Academy Context & Current Live Status Banner */}
        <div className="p-3.5 bg-pitch-900/90 rounded-xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-white text-base">{academy.name}</span>
              <span className="text-3xs font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                {academy.academyCode}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span className="flex items-center gap-1 font-mono text-volt-400">
                <Globe2 size={12} />
                {currency} ({currencySymbol})
              </span>
              <span>·</span>
              <span>Rate: {currencySymbol}{rate}/player/day</span>
              <span>·</span>
              <span>Staff: {currencySymbol}{staffRate}/staff/mo</span>
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5">
            <span
              className={clsx(
                "text-3xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border",
                isAlreadyActive
                  ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30"
                  : status?.isTrial
                  ? "bg-amber-400/10 text-amber-400 border-amber-400/30"
                  : "bg-rose-400/10 text-rose-400 border-rose-400/30"
              )}
            >
              {isAlreadyActive
                ? `Active License (${remainingDays}d left)`
                : status?.isTrial
                ? "Free Trial Mode"
                : "Subscription Lapsed / Incomplete"}
            </span>
            <p className="text-2xs text-slate-400 font-mono">
              Roster: <strong className="text-white">{activeStudentCount}</strong> / {baselineCapacity} slots
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-pitch-950/60 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab("topup")}
            className={clsx(
              "py-2.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
              activeTab === "topup"
                ? "bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            )}
          >
            <TrendingUp size={14} className={activeTab === "topup" ? "text-emerald-400" : "text-slate-500"} />
            <span>Top Up Slots</span>
            {isAlreadyActive && (
              <span className="hidden sm:inline-block text-3xs px-1.5 py-0.2 bg-emerald-400/20 text-emerald-300 rounded font-mono">
                Prorated
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("renew")}
            className={clsx(
              "py-2.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
              activeTab === "renew"
                ? "bg-volt-500/15 border border-volt-400/40 text-volt-300 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            )}
          >
            <Calendar size={14} className={activeTab === "renew" ? "text-volt-400" : "text-slate-500"} />
            <span>Renew / Extend</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("initial")}
            className={clsx(
              "py-2.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
              activeTab === "initial"
                ? "bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            )}
          >
            <CreditCard size={14} className={activeTab === "initial" ? "text-cyan-400" : "text-slate-500"} />
            <span>Initial License</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: TOP UP SLOTS (CAPACITY UPGRADE)
        ========================================================================= */}
        {activeTab === "topup" && (
          <div className="space-y-4 animate-fade-in">
            {/* Explanatory Notice */}
            <div className="p-3 bg-pitch-900/40 rounded-lg border border-emerald-500/20 text-xs text-slate-300 flex items-start gap-2.5">
              <Sparkles size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-300">
                  Instant Mid-Cycle Capacity Upgrade (In-Hand / Offline)
                </p>
                <p className="text-slate-400 text-2xs mt-0.5 leading-relaxed">
                  Adding top-up slots upgrades player and staff capacity immediately for the{" "}
                  <strong className="text-white">{remainingDays} remaining day(s)</strong> of the current cycle.
                  The billing renewal date remains unchanged (<strong className="text-white">{renewalExpiryPreview}</strong>).
                </p>
              </div>
            </div>

            {/* Inputs: Extra Students & Extra Staff */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Extra Students */}
              <div className="p-3.5 bg-pitch-900/60 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Users size={13} className="text-volt-400" />
                    Additional Student Slots
                  </label>
                  <span className="text-2xs font-mono text-slate-400">
                    Current: <strong className="text-white">{baselineCapacity}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={extraStudentsInput}
                    onChange={(e) => setExtraStudentsInput(e.target.value)}
                    placeholder="e.g. 10"
                    className="font-mono text-base font-bold text-emerald-300"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-3xs text-slate-500">Presets:</span>
                  {[5, 10, 20, 50, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setExtraStudentsInput(String(num))}
                      className={clsx(
                        "px-2 py-0.5 text-2xs rounded border transition-all font-mono",
                        extraStudents === num
                          ? "bg-emerald-400/20 text-emerald-300 border-emerald-400/40"
                          : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"
                      )}
                    >
                      +{num}
                    </button>
                  ))}
                </div>

                <p className="text-2xs text-slate-400 pt-1 border-t border-white/5">
                  New Total: <strong className="text-emerald-400">{topupTotalStudents}</strong> student slots
                </p>
              </div>

              {/* Extra Staff */}
              <div className="p-3.5 bg-pitch-900/60 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Shield size={13} className="text-cyan-400" />
                    Additional Staff Seats
                  </label>
                  <span className="text-2xs font-mono text-slate-400">
                    Current: <strong className="text-white">{baselineStaff}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={extraStaffInput}
                    onChange={(e) => setExtraStaffInput(e.target.value)}
                    placeholder="e.g. 2"
                    className="font-mono text-base font-bold text-cyan-300"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-3xs text-slate-500">Presets:</span>
                  {[0, 1, 2, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setExtraStaffInput(String(num))}
                      className={clsx(
                        "px-2 py-0.5 text-2xs rounded border transition-all font-mono",
                        extraStaff === num
                          ? "bg-cyan-400/20 text-cyan-300 border-cyan-400/40"
                          : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"
                      )}
                    >
                      +{num}
                    </button>
                  ))}
                </div>

                <p className="text-2xs text-slate-400 pt-1 border-t border-white/5">
                  New Total: <strong className="text-cyan-400">{topupTotalStaff}</strong> staff seats
                </p>
              </div>
            </div>

            {/* Prorated Math Breakdown Card */}
            <div className="p-3.5 bg-emerald-950/20 rounded-xl border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-300 border-b border-emerald-500/20 pb-1.5">
                <span>Prorated Math Breakdown ({remainingDays} days remaining)</span>
                <span>Subtotal</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
                <span>
                  Students: +{extraStudents} × {currencySymbol}{rate}/day × {remainingDays} days
                </span>
                <span className="font-bold text-white">{currencySymbol}{topupStudentCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
                <span>
                  Staff: +{extraStaff} × {currencySymbol}{staffRate}/mo × ({remainingDays}/30)
                </span>
                <span className="font-bold text-white">{currencySymbol}{topupStaffCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-emerald-400 pt-1 border-t border-emerald-500/20">
                <span>Total Prorated Offline Amount:</span>
                <span className="text-base font-extrabold">{currencySymbol}{topupCalculatedTotal.toFixed(2)} {currency}</span>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2 & 3: RENEWAL OR INITIAL LICENSE
        ========================================================================= */}
        {(activeTab === "renew" || activeTab === "initial") && (
          <div className="space-y-4 animate-fade-in">
            {/* Explanatory Notice */}
            <div className="p-3 bg-pitch-900/40 rounded-lg border border-white/10 text-xs text-slate-300 flex items-start gap-2.5">
              <Calendar size={16} className="text-volt-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">
                  {activeTab === "renew" ? "Plan Renewal & Cycle Extension" : "Initial Full License Activation"}
                </p>
                <p className="text-slate-400 text-2xs mt-0.5 leading-relaxed">
                  {activeTab === "renew"
                    ? `Extends the academy's operational cycle by the selected duration. New expiry date will be ${renewalExpiryPreview}.`
                    : `Converts the trial or unassigned academy to an official paid subscription starting today until ${renewalExpiryPreview}.`}
                </p>
              </div>
            </div>

            {/* Total Student Capacity & Staff Capacity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-white block mb-1">
                  Total Student Capacity
                </label>
                <Input
                  type="number"
                  min={Math.max(1, activeStudentCount)}
                  value={totalStudentsInput}
                  onChange={(e) => setTotalStudentsInput(e.target.value)}
                  required
                />
                <span className="text-3xs text-slate-400 mt-1 block">
                  Active roster floor: {activeStudentCount} students
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-white block mb-1">
                  Total Staff Capacity
                </label>
                <Input
                  type="number"
                  min={activeStaffCount}
                  value={totalStaffInput}
                  onChange={(e) => setTotalStaffInput(e.target.value)}
                  required
                />
                <span className="text-3xs text-slate-400 mt-1 block">
                  Active staff floor: {activeStaffCount} members
                </span>
              </div>
            </div>

            {/* Billing Interval & Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-white block mb-1">Billing Interval</label>
                <Select
                  value={billingInterval}
                  onChange={(e) => {
                    const intv = e.target.value as BillingInterval;
                    setBillingInterval(intv);
                    const daysMap: Record<BillingInterval, number> = {
                      month: 30,
                      quarter: 90,
                      half_year: 180,
                      year: 365,
                    };
                    setDurationDaysInput(String(daysMap[intv] || 30));
                  }}
                >
                  <option value="month">Monthly (30 days)</option>
                  <option value="quarter">Quarterly (90 days)</option>
                  <option value="half_year">Half-Yearly (180 days)</option>
                  <option value="year">Annual (365 days)</option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-white block mb-1">Duration (Days)</label>
                <Input
                  type="number"
                  min="1"
                  value={durationDaysInput}
                  onChange={(e) => setDurationDaysInput(e.target.value)}
                />
              </div>
            </div>

            {/* Price Preview Card */}
            <div className="p-3 bg-pitch-900/60 rounded-xl border border-white/10 flex items-center justify-between text-xs">
              <div>
                <p className="text-slate-400 text-2xs font-mono">Calculated Term Cost</p>
                <p className="text-volt-400 font-extrabold text-sm">
                  {currencySymbol}{renewalCalculatedTotal.toFixed(2)} {currency}
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-2xs font-mono">Valid Until</p>
                <p className="text-white font-bold">{renewalExpiryPreview}</p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            COMMON SECTION: PAYMENT METHOD, AMOUNT, & REFERENCE
        ========================================================================= */}
        <div className="pt-2 border-t border-white/5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Payment Method */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Offline Payment Method
              </label>
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
              >
                <option value="cash">In-Hand Cash</option>
                <option value="bank_transfer">Bank Wire / IBAN / UPI</option>
                <option value="cheque">Cheque</option>
                <option value="waived">Waived / Free Deal (₹0)</option>
                <option value="other">Other Offline Method</option>
              </Select>
            </div>

            {/* Actual Amount Collected */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Amount Collected ({currency})
              </label>
              <Input
                type="number"
                placeholder={`Auto: ${autoCalculatedAmount.toFixed(2)}`}
                value={customAmountPaid}
                onChange={(e) => setCustomAmountPaid(e.target.value)}
                disabled={paymentMethod === "waived"}
              />
              <span className="text-3xs text-slate-500 mt-1 block">
                Leave blank to record exact auto-calculated amount ({currencySymbol}{autoCalculatedAmount.toFixed(2)})
              </span>
            </div>
          </div>

          {/* Reference / Notes */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Payment Reference / Notes
            </label>
            <Input
              placeholder={
                paymentMethod === "cash"
                  ? "e.g. Cash received by super admin at stadium / office"
                  : "e.g. Wire transfer ref #12345, cheque #9876"
              }
              value={referenceNote}
              onChange={(e) => setReferenceNote(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-white/5 flex gap-3">
          <Button
            variant="primary"
            className="flex-1 font-bold bg-emerald-500 hover:bg-emerald-600 text-black border-none"
            onClick={handleSubmit}
            loading={isSubmitting}
            icon={<CheckCircle2 size={16} />}
          >
            {activeTab === "topup"
              ? "Record Payment & Top Up Slots"
              : activeTab === "renew"
              ? "Record Payment & Renew Subscription"
              : "Record Payment & Activate Subscription"}
          </Button>

          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
