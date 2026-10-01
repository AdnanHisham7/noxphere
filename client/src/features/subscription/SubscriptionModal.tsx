// src/features/subscription/SubscriptionModal.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import { Modal, Button } from "../../components/ui";
import {
  useGetAcademySubscriptionStatusQuery,
  useCreateRazorpaySubscriptionOrderMutation,
  useVerifyRazorpaySubscriptionPaymentMutation,
  useUpgradeSubscriptionCapacityMutation,
  type BillingInterval,
} from "../../store/api/academySubscriptionApi";
import { openRazorpayCheckout } from "../../utils/razorpay";
import { RootState } from "../../store";

interface SubscriptionModalProps {
  academyId: string;
  onClose: () => void;
  onSuccess?: () => void;
  // When the modal was triggered by hitting an existing subscription's
  // capacity (rather than having none at all), we skip straight to the
  // upgrade flow instead of offering to pick a billing interval again.
  mode?: "subscribe" | "upgrade" | "renew";
}

const formatCurrency = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ academyId, onClose, onSuccess, mode }) => {
  const user = useSelector((s: RootState) => s.auth.user);
  const { data: status, isLoading } = useGetAcademySubscriptionStatusQuery(academyId);
  const [createRazorpayOrder, { isLoading: creatingOrder }] = useCreateRazorpaySubscriptionOrderMutation();
  const [verifyRazorpayPayment, { isLoading: verifyingPayment }] = useVerifyRazorpaySubscriptionPaymentMutation();
  const [upgrade, { isLoading: upgrading }] = useUpgradeSubscriptionCapacityMutation();

  const isRenewal = mode === "renew" || (status?.hasSubscription && !status?.isActive);
  const isUpgrade = mode === "upgrade" || (status?.isActive && !isRenewal);
  const [capacity, setCapacity] = useState(20);
  const [staffCapacity, setStaffCapacity] = useState(0);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (status && !initialized) {
      setCapacity(Math.max(status.activeStudentCount || 10, status.provisionedCapacity || 10));
      setStaffCapacity(status.provisionedStaffCapacity || 0);
      if (status.billingInterval) setBillingInterval(status.billingInterval);
      setInitialized(true);
    }
  }, [status, initialized]);

  const rate = status?.ratePerStudentPerDay ?? status?.currentDefaultRate ?? 1;
  const staffRate = status?.staffRatePerStaffPerMonth ?? status?.currentDefaultStaffRate ?? 10;
  const days = billingInterval === "month" ? 30 : 365;
  const staffMonths = billingInterval === "year" ? 12 : 1;
  const studentTotal = useMemo(() => rate * capacity * days, [rate, capacity, days]);
  const staffTotal = useMemo(() => staffRate * staffCapacity * staffMonths, [staffRate, staffCapacity, staffMonths]);
  const total = studentTotal + staffTotal;

  const handleRazorpayPayment = async () => {
    try {
      const orderData = await createRazorpayOrder({
        academyId,
        capacity,
        staffCapacity,
        billingInterval,
        isRenewal,
      }).unwrap();

      const paymentResponse = await openRazorpayCheckout({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Noxphere",
        description: `${isRenewal ? "Renew" : "Subscribe"} — ${capacity} Students (${billingInterval}ly)`,
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

      toast.success(isRenewal ? "Subscription renewed successfully!" : "Subscription activated successfully!");
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

  const handleUpgrade = async () => {
    try {
      await upgrade({ academyId, capacity, staffCapacity }).unwrap();
      toast.success("Subscription capacity updated");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't upgrade capacity — try again");
    }
  };

  const modalTitle = isRenewal
    ? "Renew Academy Subscription"
    : isUpgrade
      ? "Increase Capacity"
      : "Subscribe to Noxphere";


  return (
    <Modal isOpen={true} onClose={onClose} title={modalTitle} size="sm">
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          {isRenewal ? (
            <p className="text-sm text-slate-300">
              Your subscription has expired. Confirm your desired student & staff capacity and renew securely via Razorpay.
            </p>
          ) : isUpgrade ? (
            <p className="text-sm text-slate-300">
              You're subscribed for <strong>{status?.provisionedCapacity}</strong> students (
              {status?.activeStudentCount} active) and <strong>{status?.provisionedStaffCapacity}</strong> staff
              seats ({status?.activeStaffCount} active). Choose new capacity for either.
            </p>
          ) : (
            <p className="text-sm text-slate-300">
              Adding a player or a staff account requires an active subscription. Choose capacity for each and your
              billing cycle — you'll complete payment securely via Razorpay.
            </p>
          )}

          <div>
            <label className="label">Student capacity</label>
            <input
              type="number"
              min={isUpgrade ? status?.provisionedCapacity ?? 1 : 1}
              value={capacity}
              onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))}
              className="input !w-full"
            />
          </div>

          <div>
            <label className="label">Staff capacity (software-managing employees)</label>
            <input
              type="number"
              min={isUpgrade ? status?.provisionedStaffCapacity ?? 0 : 0}
              value={staffCapacity}
              onChange={(e) => setStaffCapacity(Math.max(0, Number(e.target.value) || 0))}
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
              <span>Students ({capacity} × {formatCurrency(rate)}/day × {days}d)</span>
              <span>{formatCurrency(studentTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Staff ({staffCapacity} × {formatCurrency(staffRate)}/mo × {staffMonths}mo)</span>
              <span>{formatCurrency(staffTotal)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-white/10 mt-1">
              <span>{isUpgrade ? "New total (prorated this cycle)" : "Total due now"}</span>
              <span className="text-volt-400">{formatCurrency(total)}</span>
            </div>
          </div>

          <Button
            className="w-full"
            loading={creatingOrder || verifyingPayment || upgrading}
            onClick={isUpgrade ? handleUpgrade : handleRazorpayPayment}
          >
            {isRenewal
              ? "Renew Subscription via Razorpay"
              : isUpgrade
                ? "Confirm Upgrade"
                : "Pay via Razorpay"}
          </Button>
        </div>
      )}
    </Modal>
  );
};