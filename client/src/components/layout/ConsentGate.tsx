// src/components/layout/ConsentGate.tsx
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import { ShieldCheck } from "lucide-react";
import { RootState } from "../../store";
import { Button } from "../ui";
import {
  useGetConsentNoticeQuery,
  useGetMyConsentStatusQuery,
  useGrantConsentMutation,
} from "../../store/api/consentApi";

// Guardians are the "data principal" giving consent under DPDP Act
// Section 9 — a manager ticking a box on their behalf when enrolling a
// player doesn't count as verifiable guardian consent, since it isn't
// the guardian's own action. This gate makes the guardian's own
// authenticated first action in the portal (reviewing this exact notice
// and clicking Agree) the actual consent event, logged with their IP and
// user agent server-side (see ConsentUseCases.grantConsent). It blocks
// the rest of the guardian portal — nothing else renders — until every
// linked child has an answer, one way or another.
export const ConsentGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useSelector((s: RootState) => s.auth.user);
  const isGuardian = user?.role === "guardian";

  const { data: notice, isLoading: noticeLoading } = useGetConsentNoticeQuery(undefined, { skip: !isGuardian });
  const { data: status, isLoading: statusLoading, refetch } = useGetMyConsentStatusQuery(undefined, {
    skip: !isGuardian,
  });
  const [grant, { isLoading: granting }] = useGrantConsentMutation();
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());

  if (!isGuardian || noticeLoading || statusLoading || !notice || !status) {
    return <>{children}</>;
  }

  const pending = status.filter((s) => !s.hasActiveConsent && !declinedIds.has(s.studentId));
  if (pending.length === 0) {
    return <>{children}</>;
  }

  const current = pending[0];

  const handleAgree = async () => {
    try {
      await grant(current.studentId).unwrap();
      toast.success(`Consent recorded for ${current.studentName}`);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't record consent — try again");
    }
  };

  return (
    <div className="flex items-center justify-center py-10">
      <div className="max-w-lg w-full bg-ink-900 border border-white/[0.08] rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-core-400/10 border border-core-400/20 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="text-core-400" size={18} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-wide text-nox-low">Consent required</p>
            <h1 className="text-base font-semibold text-nox-high">Before we continue for {current.studentName}</h1>
          </div>
        </div>

        <p className="text-sm text-nox-mid">
          To manage {current.studentName}'s academy profile, we need your consent to collect and use the following,
          under India's Digital Personal Data Protection Act.
        </p>

        <div>
          <p className="text-xs font-semibold text-nox-high mb-2">What we collect</p>
          <ul className="space-y-1.5">
            {notice.dataCategories.map((item) => (
              <li key={item} className="text-xs text-nox-mid flex gap-2">
                <span className="text-core-400">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold text-nox-high mb-2">Why we use it</p>
          <ul className="space-y-1.5">
            {notice.purposes.map((item) => (
              <li key={item} className="text-xs text-nox-mid flex gap-2">
                <span className="text-core-400">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-nox-low">
          You can withdraw this consent at any time from your account settings — it's just as easy as giving it. If
          you decline, you can still browse this notice again later, but some features (like fee payment or session
          alerts for {current.studentName}) will stay unavailable until you've consented.
        </p>

        <div className="flex gap-3">
          <Button className="flex-1" loading={granting} onClick={handleAgree}>
            I Agree — Grant Consent
          </Button>
          <Button
            variant="secondary"
            onClick={() => setDeclinedIds((prev) => new Set(prev).add(current.studentId))}
          >
            Not Now
          </Button>
        </div>

        {pending.length > 1 && (
          <p className="text-[11px] text-nox-low text-center">
            {pending.length - 1} more child{pending.length - 1 > 1 ? "ren" : ""} will need this too.
          </p>
        )}
      </div>
    </div>
  );
};