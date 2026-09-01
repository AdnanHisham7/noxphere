// src/features/subscription/SubscriptionCancelledPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "../../components/ui";

const SubscriptionCancelledPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-pitch-950 px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto">
          <XCircle className="text-slate-400" size={26} />
        </div>
        <h1 className="font-display font-extrabold text-white text-xl uppercase tracking-tight">
          Checkout Cancelled
        </h1>
        <p className="text-sm text-slate-400">
          No payment was made. You can try again whenever you're ready to add players.
        </p>
        <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
      </div>
    </div>
  );
};

export default SubscriptionCancelledPage;