// src/features/subscription/SubscriptionSuccessPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { CheckCircle2, UserCheck, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { RootState } from "../../store";
import { Button } from "../../components/ui";
import {
  useGetAcademySubscriptionStatusQuery,
  useVerifySubscriptionSessionMutation,
} from "../../store/api/academySubscriptionApi";
import { useCreateStudentMutation } from "../../store/api/studentsApi";

const SubscriptionSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useSelector((s: RootState) => s.auth.user);
  const academyId = user?.academyId;
  const sessionId = searchParams.get("session_id");
  const [attempts, setAttempts] = useState(0);
  const [verified, setVerified] = useState(false);

  const [verifySession, { isLoading: verifying }] = useVerifySubscriptionSessionMutation();
  const { data: status, refetch } = useGetAcademySubscriptionStatusQuery(academyId ?? "", {
    skip: !academyId,
  });

  const [createStudent, { isLoading: creatingPendingStudent }] = useCreateStudentMutation();
  const [enrolledPlayer, setEnrolledPlayer] = useState<{ name: string } | null>(null);
  const [pendingAttempted, setPendingAttempted] = useState(false);

  useEffect(() => {
    if (sessionId && !verified) {
      verifySession({ sessionId, academyId: academyId || undefined })
        .unwrap()
        .then(() => {
          setVerified(true);
          refetch();
        })
        .catch((err) => {
          console.warn("Session verification warning:", err);
        });
    }
  }, [sessionId, academyId, verified, verifySession, refetch]);

  useEffect(() => {
    if (!academyId || status?.isActive || attempts >= 8) return;
    const timer = setTimeout(() => {
      refetch();
      setAttempts((a) => a + 1);
    }, 1500);
    return () => clearTimeout(timer);
  }, [academyId, status?.isActive, attempts, refetch]);

  // Auto-enroll pending player once subscription is verified active
  useEffect(() => {
    if (!status?.isActive || pendingAttempted) return;

    const raw = sessionStorage.getItem("noxphere_pending_student_creation");
    if (!raw) return;

    setPendingAttempted(true);
    try {
      const pending = JSON.parse(raw);
      if (pending && pending.firstName && pending.lastName) {
        createStudent(pending)
          .unwrap()
          .then(() => {
            sessionStorage.removeItem("noxphere_pending_student_creation");
            setEnrolledPlayer({ name: `${pending.firstName} ${pending.lastName}` });
            toast.success(`Player ${pending.firstName} ${pending.lastName} enrolled into your squad!`, {
              duration: 6000,
            });
          })
          .catch((err: any) => {
            console.error("Auto enrollment error on success page:", err);
            toast.error(err?.data?.message || "Subscription activated, but could not auto-enroll player. You can add them from the Squad page.");
          });
      }
    } catch {
      sessionStorage.removeItem("noxphere_pending_student_creation");
    }
  }, [status?.isActive, pendingAttempted, createStudent]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-pitch-950 text-slate-900 dark:text-slate-100 px-6 transition-colors duration-200">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-field-400/10 border border-field-400/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="text-field-500 dark:text-field-400" size={26} />
        </div>

        <div>
          <h1 className="font-display font-extrabold text-slate-900 dark:text-white text-2xl uppercase tracking-tight">
            {status?.isActive ? "Subscription Active" : "Payment Received"}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            {status?.isActive
              ? `You're all set — provisioned for ${status.provisionedCapacity} players, billed ${status.billingInterval}ly.`
              : "Confirming your subscription with Stripe — this usually takes a few seconds."}
          </p>
        </div>

        {creatingPendingStudent && (
          <div className="p-4 rounded-xl bg-volt-400/10 border border-volt-400/20 text-volt-600 dark:text-volt-300 text-xs flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={16} />
            <span>Enrolling your pending player into the squad…</span>
          </div>
        )}

        {enrolledPlayer && (
          <div className="p-4 rounded-xl bg-field-500/10 border border-field-500/20 text-left flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-field-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <UserCheck className="text-field-500 dark:text-field-400" size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Player Enrolled Successfully</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                <strong className="text-slate-900 dark:text-white">{enrolledPlayer.name}</strong> has been added to your squad.
              </p>
            </div>
          </div>
        )}

        {!sessionId && (
          <p className="text-2xs text-slate-500 dark:text-slate-600">No checkout session reference found in the URL.</p>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="secondary" onClick={() => navigate("/students")}>
            Go to Squad
          </Button>
          <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSuccessPage;