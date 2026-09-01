// src/components/layout/SubscriptionGate.tsx
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { ShieldAlert } from "lucide-react";
import { RootState } from "../../store";
import { Button } from "../ui";
import { useGetAcademySubscriptionStatusQuery } from "../../store/api/academySubscriptionApi";
import { SubscriptionModal } from "../../features/subscription/SubscriptionModal";

// Wraps the authenticated app shell. Managers and coaches are blocked
// from the whole app (not just "add player") when their academy has no
// active subscription — the manager gets a "complete payment" CTA, the
// coach sees the same message without one, since only the manager can
// act on it. super_admin and roles with no academyId (e.g. a manager
// who hasn't finished signup) are never gated here.
export const SubscriptionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useSelector((s: RootState) => s.auth.user);
  const [showModal, setShowModal] = useState(false);

  const gatedRole = user?.role === "manager" || user?.role === "coach";
  const academyId = user?.academyId;

  const { data: status, isLoading } = useGetAcademySubscriptionStatusQuery(academyId ?? "", {
    skip: !gatedRole || !academyId,
  });

  if (!gatedRole || !academyId || isLoading || !status) {
    return <>{children}</>;
  }

  // No subscription at all yet is not the same as a lapsed one — a
  // brand-new academy hasn't been asked to pay until its manager tries
  // to add a first player, so this gate only blocks once a subscription
  // exists and isn't active (past_due/canceled/unpaid), not before one
  // has ever been started.
  const isLapsed = status.hasSubscription && !status.isActive;
  if (!isLapsed) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pitch-950 px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-ember-400/10 border border-ember-400/20 flex items-center justify-center mx-auto">
          <ShieldAlert className="text-ember-400" size={26} />
        </div>
        <h1 className="font-display font-extrabold text-white text-xl uppercase tracking-tight">
          Subscription {status.status === "past_due" ? "Payment Failed" : "Inactive"}
        </h1>
        <p className="text-sm text-slate-400">
          {user?.role === "manager"
            ? "This academy's subscription needs attention before you can continue. Complete payment to restore access."
            : "This academy's subscription needs attention. Please contact your manager to resolve it."}
        </p>
        {user?.role === "manager" && (
          <Button onClick={() => setShowModal(true)}>Complete Payment</Button>
        )}
      </div>

      {showModal && academyId && (
        <SubscriptionModal academyId={academyId} onClose={() => setShowModal(false)} mode="subscribe" />
      )}
    </div>
  );
};