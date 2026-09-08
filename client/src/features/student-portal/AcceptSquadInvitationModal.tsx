// src/features/student-portal/AcceptSquadInvitationModal.tsx
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  SquadInvitation,
  useSendGuardianOtpMutation,
  useRespondToSquadInvitationMutation,
} from "@/store/api/squadInvitationApi";
import {
  X,
  ShieldCheck,
  Mail,
  KeyRound,
  User,
  Phone,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  Shield,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";

interface AcceptSquadInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  invitation: SquadInvitation | null;
  onSuccess: () => void;
}

export const AcceptSquadInvitationModal: React.FC<AcceptSquadInvitationModalProps> = ({
  isOpen,
  onClose,
  invitation,
  onSuccess,
}) => {
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const [sendGuardianOtp, { isLoading: isSendingOtp }] = useSendGuardianOtpMutation();
  const [respondToInvitation, { isLoading: isResponding }] = useRespondToSquadInvitationMutation();

  // Form states
  const [guardianEmail, setGuardianEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isExistingGuardian, setIsExistingGuardian] = useState(false);
  const [otp, setOtp] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianPassword, setGuardianPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  // Reset state when invitation or modal changes
  useEffect(() => {
    if (isOpen) {
      setGuardianEmail("");
      setOtpSent(false);
      setIsExistingGuardian(false);
      setOtp("");
      setGuardianName("");
      setGuardianPhone("");
      setGuardianPassword("");
      setConfirmPassword("");
      setResendCountdown(0);
    }
  }, [isOpen, invitation]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  if (!isOpen || !invitation) return null;

  const inviteId = invitation.id || (invitation as any)._id;
  const academyName =
    typeof invitation.academyId === "object" && invitation.academyId
      ? invitation.academyId.name
      : "Academy";
  const franchiseName =
    typeof invitation.franchiseId === "object" && invitation.franchiseId
      ? invitation.franchiseId.name
      : "";
  const teamName =
    typeof invitation.teamId === "object" && invitation.teamId
      ? invitation.teamId.name
      : "Main Roster";

  const isSelfEmail =
    !!currentUser?.email &&
    !!guardianEmail.trim() &&
    currentUser.email.toLowerCase() === guardianEmail.trim().toLowerCase();

  const handleSendOtp = async () => {
    if (!guardianEmail.trim()) {
      toast.error("Please enter your parent or guardian's email address");
      return;
    }

    if (isSelfEmail) {
      toast.error("Guardian email cannot be the same as your student login email.");
      return;
    }

    try {
      const res = await sendGuardianOtp({
        invitationId: inviteId,
        guardianEmail: guardianEmail.trim().toLowerCase(),
      }).unwrap();

      setOtpSent(true);
      setIsExistingGuardian(res.isExistingGuardian);
      setResendCountdown(60);
      toast.success(res.message || `Verification code sent to ${guardianEmail}`);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to send verification code to guardian email");
    }
  };

  const handleAcceptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otpSent) {
      await handleSendOtp();
      return;
    }

    if (!otp.trim() || otp.trim().length !== 6) {
      toast.error("Please enter the 6-digit verification code sent to the guardian email");
      return;
    }

    if (!isExistingGuardian) {
      if (!guardianName.trim()) {
        toast.error("Please enter guardian's full name");
        return;
      }
      if (!guardianPhone.trim()) {
        toast.error("Please enter guardian's phone number");
        return;
      }
      if (guardianPassword.length < 6) {
        toast.error("Guardian password must be at least 6 characters long");
        return;
      }
      if (guardianPassword !== confirmPassword) {
        toast.error("Guardian passwords do not match");
        return;
      }
    }

    try {
      await respondToInvitation({
        id: inviteId,
        action: "accept",
        guardianEmail: guardianEmail.trim().toLowerCase(),
        otp: otp.trim(),
        guardianName: isExistingGuardian ? undefined : guardianName.trim(),
        guardianPhone: isExistingGuardian ? undefined : guardianPhone.trim(),
        guardianPassword: isExistingGuardian ? undefined : guardianPassword,
      }).unwrap();

      toast.success(`🎉 Congratulations! You have officially joined ${academyName}!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to accept squad invitation");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-pitch-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header decoration bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-volt-400 via-field-400 to-sky-400" />

        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-volt-400/15 text-volt-600 dark:text-volt-400 text-xs font-mono font-semibold uppercase tracking-wider">
              <Sparkles size={12} /> Academy Recruitment
            </div>
            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
              Accept Squad Offer & Link Guardian
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Join <span className="font-semibold text-slate-900 dark:text-white">{academyName}</span> as an official academy player.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleAcceptSubmit} className="p-6 space-y-5">
          {/* Squad Details Summary */}
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-slate-400 uppercase font-mono text-[10px]">Club / Franchise</p>
              <p className="font-semibold text-slate-800 dark:text-white truncate">
                {franchiseName || academyName}
              </p>
            </div>
            <div>
              <p className="text-slate-400 uppercase font-mono text-[10px]">Squad / Team</p>
              <p className="font-semibold text-slate-800 dark:text-white truncate">{teamName}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase font-mono text-[10px]">Position & Jersey</p>
              <p className="font-semibold text-volt-600 dark:text-volt-400">
                {invitation.position || "Player"} {invitation.jerseyNumber ? `(#${invitation.jerseyNumber})` : ""}
              </p>
            </div>
          </div>

          {/* Explanation Banner */}
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-300 text-xs flex items-start gap-2.5">
            <ShieldCheck size={18} className="shrink-0 text-sky-500 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Guardian Verification Required</p>
              <p className="text-sky-700 dark:text-sky-400 text-[11px] leading-relaxed">
                Noxphere connects a parent or guardian portal account to youth academy players for attendance notifications, fee invoicing, and coach communication.
              </p>
            </div>
          </div>

          {/* STEP 1: Guardian Email */}
          <div className="space-y-1.5">
            <label className="label text-xs font-semibold">Parent / Guardian Email Address *</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="email"
                  required
                  disabled={otpSent}
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="input pl-9 text-xs sm:text-sm"
                />
                <Mail size={15} className="absolute left-3 top-3 text-slate-400" />
              </div>
              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSendingOtp || !guardianEmail.trim() || isSelfEmail}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shrink-0"
                >
                  {isSendingOtp ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      Send OTP <ArrowRight size={13} />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp("");
                  }}
                  className="btn-secondary text-xs px-3 py-2 shrink-0 text-slate-500"
                >
                  Change Email
                </button>
              )}
            </div>

            {isSelfEmail && (
              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1">
                <AlertCircle size={12} />
                Guardian email cannot be the same as your student login email ({currentUser?.email}).
              </p>
            )}
          </div>

          {/* STEP 2: OTP Input & Guardian Profile */}
          {otpSent && (
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-white/10 animate-fade-in">
              {/* Guardian Account Match Status Badge */}
              {isExistingGuardian ? (
                <div className="p-3 rounded-xl bg-field-500/10 border border-field-500/20 text-field-700 dark:text-field-300 text-xs flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-field-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Existing Guardian Account Found</p>
                    <p className="text-field-600 dark:text-field-400 text-[11px]">
                      This player will be added to your parent's existing Guardian Portal. No new password needed!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                  <User size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">New Guardian Portal Account</p>
                    <p className="text-amber-700 dark:text-amber-400 text-[11px]">
                      A new Guardian account will be created with the credentials below so your parent can log in.
                    </p>
                  </div>
                </div>
              )}

              {/* OTP Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="label text-xs font-semibold">6-Digit Verification Code (OTP) *</label>
                  {resendCountdown > 0 ? (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock size={11} /> Resend in {resendCountdown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                      className="text-[11px] text-volt-500 hover:underline font-semibold"
                    >
                      Resend Code
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit code sent to guardian email"
                    className="input pl-9 tracking-widest text-center font-mono font-bold text-base sm:text-lg"
                  />
                  <KeyRound size={15} className="absolute left-3 top-3 text-slate-400" />
                </div>
              </div>

              {/* New Guardian Credentials Form */}
              {!isExistingGuardian && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs font-semibold">Guardian Full Name *</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={guardianName}
                          onChange={(e) => setGuardianName(e.target.value)}
                          placeholder="e.g. Maria Messi"
                          className="input pl-8 text-xs"
                        />
                        <User size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                      </div>
                    </div>

                    <div>
                      <label className="label text-xs font-semibold">Guardian Phone *</label>
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          value={guardianPhone}
                          onChange={(e) => setGuardianPhone(e.target.value)}
                          placeholder="+91 9876543210"
                          className="input pl-8 text-xs"
                        />
                        <Phone size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs font-semibold">Set Guardian Password *</label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={guardianPassword}
                          onChange={(e) => setGuardianPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="input pl-8 text-xs"
                        />
                        <Lock size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                      </div>
                    </div>

                    <div>
                      <label className="label text-xs font-semibold">Confirm Password *</label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                          className="input pl-8 text-xs"
                        />
                        <Shield size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Footer Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isResponding}
              className="btn-secondary text-xs py-2.5 px-4"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isResponding || (otpSent && otp.trim().length !== 6)}
              className="btn-primary text-xs py-2.5 px-5 flex items-center gap-1.5 font-semibold"
            >
              {isResponding ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Verifying & Enrolling…
                </>
              ) : otpSent ? (
                <>
                  <CheckCircle2 size={14} /> Verify & Complete Enrollment
                </>
              ) : (
                <>
                  Continue <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
