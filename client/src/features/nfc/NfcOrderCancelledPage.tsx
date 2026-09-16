// src/features/nfc/NfcOrderCancelledPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { XCircle, ArrowLeft } from "lucide-react";
import { RootState } from "../../store";
import { Button } from "../../components/ui";

export const NfcOrderCancelledPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.auth.user);

  const handleReturn = () => {
    if (user?.role === "student") {
      navigate("/student/dashboard");
    } else if (user?.role === "manager" || user?.role === "super_admin") {
      navigate("/nfc-cards");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-pitch-950 text-slate-900 dark:text-slate-100 px-6 transition-colors duration-200">
      <div className="max-w-md w-full text-center space-y-5 bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/10 p-8 rounded-3xl shadow-2xl">
        <div className="w-14 h-14 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto text-amber-500">
          <XCircle size={28} />
        </div>

        <div>
          <h1 className="font-display font-extrabold text-2xl uppercase tracking-tight text-slate-900 dark:text-white">
            Payment Cancelled
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Your Stripe checkout session was cancelled. No charges were made. Your request remains approved and you can complete payment anytime from your dashboard.
          </p>
        </div>

        <div className="pt-2">
          <Button variant="secondary" onClick={handleReturn} className="w-full font-semibold">
            <ArrowLeft size={15} className="mr-1.5" /> Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NfcOrderCancelledPage;
