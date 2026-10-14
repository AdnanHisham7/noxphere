// src/components/layout/SubscriptionGate.tsx
import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ShieldAlert, LogOut } from "lucide-react";
import { RootState } from "../../store";
import { Button } from "../ui";
import { useGetAcademySubscriptionStatusQuery } from "../../store/api/academySubscriptionApi";
import { useGetFranchiseByIdQuery } from "../../store/api/franchiseApi";
import { SubscriptionModal } from "../../features/subscription/SubscriptionModal";
import { clearCredentials } from "../../store/slices/authSlice";
import { clearActiveFranchise } from "../../store/slices/uiSlice";
import { clearNotifications } from "../../store/slices/notificationSlice";
import { baseApi } from "../../store/api/baseApi";

// Wraps the authenticated app shell. Managers, coaches, and staff employees are
// blocked from operations when their academy has no active subscription (e.g. expired or lapsed).
// The manager gets a "Renew Subscription via Razorpay" CTA, while coaches see a notice
// instructing them to contact their manager.
export const SubscriptionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const [showModal, setShowModal] = useState(false);

  const gatedRole = user?.role === "manager" || user?.role === "coach" || user?.role === "employee";
  const franchiseId = user?.franchiseId;
  const { data: franchise } = useGetFranchiseByIdQuery(franchiseId ?? "", {
    skip: !gatedRole || !franchiseId,
  });

  const academyId = user?.academyId || franchise?.academyId;

  const { data: status, isLoading } = useGetAcademySubscriptionStatusQuery(academyId ?? "", {
    skip: !gatedRole || !academyId,
  });

  const handleLogout = () => {
    dispatch(clearCredentials());
    dispatch(clearActiveFranchise());
    dispatch(clearNotifications());
    dispatch(baseApi.util.resetApiState());
  };

  if (!gatedRole || !academyId || isLoading || !status) {
    return <>{children}</>;
  }

  // A subscription exists and is no longer active (expired, past_due, canceled, unpaid, trial_expired)
  const isTrialExpired = status.isTrial && (!status.isActive || status.status === "trial_expired");
  const isLapsed = (status.hasSubscription && !status.isActive) || isTrialExpired;
  if (!isLapsed) {
    return (
      <>
        {status.isTrial && status.isActive && (
          <div className="bg-volt-400/10 border-b border-volt-400/20 px-4 py-2 text-center text-xs flex items-center justify-center gap-2 text-volt-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-volt-400 animate-pulse" />
            <span>
              <strong>Free Trial Active:</strong> You have {status.trialDaysRemaining ?? 0} days remaining ({status.activeStudentCount}/{status.provisionedCapacity} students provisioned).
            </span>
            {user?.role === "manager" && (
              <button
                onClick={() => setShowModal(true)}
                className="underline hover:text-white font-bold ml-1 transition-colors"
              >
                Upgrade to Full Plan
              </button>
            )}
          </div>
        )}
        {children}
        {showModal && academyId && (
          <SubscriptionModal
            academyId={academyId}
            onClose={() => setShowModal(false)}
            mode="subscribe"
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-pitch-950 text-slate-900 dark:text-slate-100 px-6 transition-colors duration-200">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 shadow-lg shadow-amber-500/10">
          <ShieldAlert size={32} />
        </div>
        <h1 className="font-display font-extrabold text-slate-900 dark:text-white text-xl uppercase tracking-tight">
          {isTrialExpired ? "Academy Free Trial Ended" : "Academy Subscription Expired"}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {isTrialExpired
            ? user?.role === "manager"
              ? "Your academy's free trial period has concluded. To continue adding players, managing coaching sessions, and utilizing the platform, please activate your academy subscription."
              : "Your academy's free trial period has ended and operations are currently restricted. Please contact your academy manager to activate the full subscription."
            : user?.role === "manager"
            ? "Your academy's subscription period has ended. Portal operations are currently restricted until renewed. Complete payment to restore full access immediately."
            : "Your academy's subscription period has ended and operations are currently restricted. Please contact your academy manager to renew the subscription."}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {user?.role === "manager" && (
            <Button
              variant="primary"
              onClick={() => setShowModal(true)}
              className="w-full sm:w-auto font-bold"
            >
              {isTrialExpired ? "Activate Academy Subscription" : "Renew Subscription"}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full sm:w-auto text-slate-500 hover:text-rose-500"
          >
            <LogOut size={15} className="mr-1.5" /> Sign Out
          </Button>
        </div>
      </div>

      {showModal && academyId && (
        <SubscriptionModal
          academyId={academyId}
          onClose={() => setShowModal(false)}
          mode={isTrialExpired ? "subscribe" : "renew"}
        />
      )}
    </div>
  );
};