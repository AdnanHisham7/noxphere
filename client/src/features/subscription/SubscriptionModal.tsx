// src/features/subscription/SubscriptionModal.tsx
import React, { useState, useMemo, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Modal, Button } from "../../components/ui";
import {
  useGetAcademySubscriptionStatusQuery,
  useCreateSubscriptionCheckoutMutation,
  useUpgradeSubscriptionCapacityMutation,
  type BillingInterval,
} from "../../store/api/academySubscriptionApi";

interface SubscriptionModalProps {
  academyId: string;
  onClose: () => void;
  // When the modal was triggered by hitting an existing subscription's
  // capacity (rather than having none at all), we skip straight to the
  // upgrade flow instead of offering to pick a billing interval again.
  mode?: "subscribe" | "upgrade";
}

const formatCurrency = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ academyId, onClose, mode }) => {
  const { data: status, isLoading } = useGetAcademySubscriptionStatusQuery(academyId);
  const [checkout, { isLoading: checkingOut }] = useCreateSubscriptionCheckoutMutation();
  const [upgrade, { isLoading: upgrading }] = useUpgradeSubscriptionCapacityMutation();

  const isUpgrade = mode === "upgrade" || status?.isActive;
  const [capacity, setCapacity] = useState(20);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (status && !initialized) {
      setCapacity(Math.max(status.activeStudentCount + 10, status.provisionedCapacity + 10));
      if (status.billingInterval) setBillingInterval(status.billingInterval);
      setInitialized(true);
    }
  }, [status, initialized]);

  const rate = status?.ratePerStudentPerDay ?? status?.currentDefaultRate ?? 1;
  const days = billingInterval === "month" ? 30 : 365;
  const total = useMemo(() => rate * capacity * days, [rate, capacity, days]);

  const handleSubscribe = async () => {
    try {
      const { url } = await checkout({ academyId, capacity, billingInterval }).unwrap();
      window.location.href = url;
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't start checkout — try again");
    }
  };

  const handleUpgrade = async () => {
    try {
      await upgrade({ academyId, capacity }).unwrap();
      toast.success(`Capacity increased to ${capacity} students`);
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't upgrade capacity — try again");
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isUpgrade ? "Increase Student Capacity" : "Subscribe to Noxphere"} size="sm">
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          {isUpgrade ? (
            <p className="text-sm text-slate-300">
              You're subscribed for <strong>{status?.provisionedCapacity}</strong> students and currently have{" "}
              <strong>{status?.activeStudentCount}</strong>. Choose a new capacity to keep adding players.
            </p>
          ) : (
            <p className="text-sm text-slate-300">
              Adding a player requires an active subscription. Choose how many students to provision for and your
              billing cycle — you'll be redirected to Stripe to complete payment.
            </p>
          )}

          <div>
            <label className="label">Student capacity</label>
            <input
              type="number"
              min={isUpgrade ? (status?.provisionedCapacity ?? 1) + 1 : 1}
              value={capacity}
              onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))}
              className="input !w-full"
            />
          </div>

          {!isUpgrade && (
            <div>
              <label className="label">Billing cycle</label>
              <div className="flex gap-2">
                {(["month", "year"] as BillingInterval[]).map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    onClick={() => setBillingInterval(interval)}
                    className={`flex-1 rounded px-3 py-2 text-sm font-semibold border transition-colors ${
                      billingInterval === interval
                        ? "bg-volt-400 border-volt-400 text-pitch-900"
                        : "bg-pitch-800 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {interval === "month" ? "Monthly" : "Yearly"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 bg-pitch-800 border border-white/10 rounded space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Rate</span>
              <span>{formatCurrency(rate)}/student/day</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Billing period</span>
              <span>{days} days</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-white/10 mt-1">
              <span>{isUpgrade ? "New total (prorated this cycle)" : "Total due now"}</span>
              <span className="text-volt-400">{formatCurrency(total)}</span>
            </div>
          </div>

          <Button
            className="w-full"
            loading={checkingOut || upgrading}
            onClick={isUpgrade ? handleUpgrade : handleSubscribe}
          >
            {isUpgrade ? "Confirm Upgrade" : "Proceed to Payment"}
          </Button>
        </div>
      )}
    </Modal>
  );
};