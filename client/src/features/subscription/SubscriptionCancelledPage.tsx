// src/features/subscription/SubscriptionCancelledPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "../../components/ui";

const SubscriptionCancelledPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-pitch-950 text-slate-900 dark:text-slate-100 px-6 transition-colors duration-200">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 dark:bg-white/[0.04] dark:border-white/10 flex items-center justify-center mx-auto">
          <XCircle className="text-slate-500 dark:text-slate-400" size={26} />
        </div>
        <h1 className="font-display font-extrabold text-slate-900 dark:text-white text-xl uppercase tracking-tight">
          Checkout Cancelled
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No payment was made. You can try again whenever you're ready to add players.
        </p>
        <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
      </div>
    </div>
  );
};

export default SubscriptionCancelledPage;