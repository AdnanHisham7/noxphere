// src/features/nfc/NfcOrderSuccessPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { CheckCircle2, CreditCard, Loader2, Sparkles, ArrowRight, Package } from "lucide-react";
import { RootState } from "../../store";
import { Button } from "../../components/ui";
import { useVerifyNfcCheckoutSessionMutation } from "../../store/api/nfcCardApi";

export const NfcOrderSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const user = useSelector((s: RootState) => s.auth.user);

  const [verifySession, { isLoading: isVerifying }] = useVerifyNfcCheckoutSessionMutation();
  const [verifiedOrder, setVerifiedOrder] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      verifySession({ sessionId })
        .unwrap()
        .then((res) => {
          if (res.paid) {
            setVerifiedOrder(res.request);
          } else {
            setErrorMsg("Payment could not be verified with Stripe yet. Please check again in a few moments.");
          }
        })
        .catch((err: any) => {
          console.warn("NFC checkout verification notice:", err);
          setErrorMsg(err?.data?.message || "Payment received, finalizing confirmation.");
        });
    }
  }, [sessionId, verifySession]);

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
      <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/10 p-8 rounded-3xl shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-field-400/10 border border-field-400/30 flex items-center justify-center mx-auto text-field-500 dark:text-field-400">
          <CheckCircle2 size={32} />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1 text-2xs font-mono uppercase tracking-widest text-volt-400 bg-volt-400/10 border border-volt-400/20 px-3 py-1 rounded-full font-bold">
            <Sparkles size={11} /> Payment Successful
          </span>
          <h1 className="font-display font-extrabold text-2xl uppercase tracking-tight text-slate-900 dark:text-white">
            NFC Card Order Initiated!
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            Your payment has been confirmed via Stripe. Your physical NFC player card order is now queued for manufacturing and chip programming.
          </p>
        </div>

        {isVerifying && (
          <div className="p-3 rounded-xl bg-volt-400/10 border border-volt-400/20 text-volt-300 text-xs flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={15} />
            <span>Confirming order details with Stripe…</span>
          </div>
        )}

        {verifiedOrder && (
          <div className="p-4 rounded-xl bg-pitch-950/70 border border-white/10 text-left space-y-2 text-xs">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-slate-400">Order Reference:</span>
              <span className="font-mono text-volt-400 font-bold">
                #{String(verifiedOrder.id || verifiedOrder._id || "").slice(-6).toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-slate-400">Cards Ordered:</span>
              <span className="text-white font-semibold">
                {verifiedOrder.quantity} card{verifiedOrder.quantity > 1 ? "s" : ""} ({verifiedOrder.cardType})
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-slate-400">Total Paid:</span>
              <span className="font-mono font-bold text-white">
                ₹{verifiedOrder.totalAmount?.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="pt-1 text-2xs text-slate-400">
              Delivery to: <strong>{verifiedOrder.shippingAddress?.recipientName}</strong> &bull;{" "}
              {verifiedOrder.shippingAddress?.city}, {verifiedOrder.shippingAddress?.state}
            </div>
          </div>
        )}

        {errorMsg && !verifiedOrder && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            {errorMsg}
          </div>
        )}

        <div className="pt-2">
          <Button onClick={handleReturn} className="w-full !bg-volt-400 hover:!bg-volt-300 !text-pitch-950 font-bold">
            Continue to Dashboard <ArrowRight size={15} className="ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NfcOrderSuccessPage;
