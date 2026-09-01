// src/features/subscription/SubscriptionSuccessPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { CheckCircle2 } from "lucide-react";
import { RootState } from "../../store";
import { Button } from "../../components/ui";
import { useGetAcademySubscriptionStatusQuery } from "../../store/api/academySubscriptionApi";

// Stripe redirects here after checkout completes. The subscription
// itself is only confirmed active once the checkout.session.completed
// webhook lands (usually near-instant, but not guaranteed to beat this
// redirect), so this polls status briefly instead of assuming success
// the moment the user arrives.
const SubscriptionSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useSelector((s: RootState) => s.auth.user);
  const academyId = user?.academyId;
  const sessionId = searchParams.get("session_id");
  const [attempts, setAttempts] = useState(0);

  const { data: status, refetch } = useGetAcademySubscriptionStatusQuery(academyId ?? "", {
    skip: !academyId,
  });

  useEffect(() => {
    if (!academyId || status?.isActive || attempts >= 8) return;
    const timer = setTimeout(() => {
      refetch();
      setAttempts((a) => a + 1);
    }, 1500);
    return () => clearTimeout(timer);
  }, [academyId, status?.isActive, attempts, refetch]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-pitch-950 px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-field-400/10 border border-field-400/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="text-field-400" size={26} />
        </div>
        <h1 className="font-display font-extrabold text-white text-xl uppercase tracking-tight">
          {status?.isActive ? "Subscription Active" : "Payment Received"}
        </h1>
        <p className="text-sm text-slate-400">
          {status?.isActive
            ? `You're all set — provisioned for ${status.provisionedCapacity} students, billed ${status.billingInterval}ly.`
            : "Confirming your subscription with Stripe — this usually takes a few seconds."}
        </p>
        {!sessionId && (
          <p className="text-2xs text-slate-600">No checkout session reference found in the URL.</p>
        )}
        <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
      </div>
    </div>
  );
};

export default SubscriptionSuccessPage;