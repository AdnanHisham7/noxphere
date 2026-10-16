// src/features/guardian/GuardianDashboardPage.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  AlertTriangle,
  Wallet,
  Calendar,
  Clock,
  ArrowRight,
  CreditCard,
  CheckCircle,
  MapPin,
  User,
  ExternalLink,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Activity,
  Compass,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import {
  useGetGuardianDashboardQuery,
  type GuardianFeeUrgencyItem,
  type GuardianDashboardSession,
} from "../../store/api/guardianApi";
import {
  NoxPageHeader,
  NoxStatCard,
  NoxSkeleton,
  NoxEmptyState,
  NoxStatusBadge,
} from "../../components/portal-ui";
import { getMapsLink } from "../../components/ui";
import { PayFeeModal } from "./PayFeeModal";

const GuardianDashboardPage: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const { data, isLoading, isError, refetch } = useGetGuardianDashboardQuery();

  const [paymentModalFee, setPaymentModalFee] =
    useState<GuardianFeeUrgencyItem | null>(null);

  const attendanceByStudent = new Map(
    (data?.todayAttendance ?? []).map((a) => [a.studentId, a.status]),
  );

  const lateFees = data?.lateFees ?? data?.overdueFees ?? [];
  const pendingFees = data?.pendingFees ?? [];
  const upcomingFees = data?.upcomingFees ?? [];
  const verificationPendingFees = data?.verificationPendingFees ?? [];

  const [activeSessionTab, setActiveSessionTab] = useState<
    "today" | "tomorrow" | "upcoming" | "completed"
  >("today");

  const sessionsToday = data?.sessions?.today ?? [];
  const sessionsTomorrow = data?.sessions?.tomorrow ?? [];
  const sessionsUpcoming = data?.sessions?.upcoming ?? [];
  const sessionsCompleted = data?.sessions?.recentCompleted ?? [];

  const liveSession = sessionsToday.find((s) => s.isLive);
  const hasLiveSession = Boolean(liveSession);

  const displayedSessions =
    activeSessionTab === "today"
      ? sessionsToday
      : activeSessionTab === "tomorrow"
        ? sessionsTomorrow
        : activeSessionTab === "upcoming"
          ? sessionsUpcoming
          : sessionsCompleted;

  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Welcome & Executive Date Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pitch-200/60 dark:border-white/[0.06] pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-core-400/10 text-core-600 dark:text-core-400 text-2xs font-mono font-semibold uppercase tracking-wider mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-core-500 animate-pulse"></span>
            Guardian Portal · Active Roster
          </div>
          <h1 className="font-orbital text-xl sm:text-2xl font-bold text-slate-900 dark:text-nox-high">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-nox-mid mt-0.5">
            Real-time player monitoring, training schedules, and fee records.
          </p>
        </div>

        {/* Date & Live Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-xs font-mono text-slate-700 dark:text-slate-300">
            <Calendar size={13} className="text-core-500 shrink-0" />
            <span className="font-medium">{todayFormatted}</span>
          </div>
          {hasLiveSession && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-field-400 text-xs font-mono font-bold animate-pulse">
              <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-field-400"></span>
              LIVE ON PITCH
            </span>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <NoxSkeleton className="h-32 rounded-2xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <NoxSkeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <NoxSkeleton className="h-64 rounded-2xl" />
        </div>
      )}

      {isError && (
        <NoxEmptyState
          title="Couldn't load your guardian dashboard"
          body="Please refresh the page, or check your internet connection."
        />
      )}

      {data && (
        <>
          {/* ========================================================================= */}
          {/* 1. IMMEDIATE SPOTLIGHT: ACTION REQUIRED & TODAY'S LIVE BRIEFING */}
          {/* Directly visible above the fold on mobile & desktop without scrolling */}
          {/* ========================================================================= */}
          <div className="space-y-3">
            {/* A. CRITICAL URGENCY: OVERDUE FEE ALERT (TOP ACTION ITEM) */}
            {lateFees.length > 0 && (
              <div className="rounded-2xl p-4 sm:p-5 border-2 border-rose-500/60 bg-gradient-to-r from-rose-500/[0.08] via-rose-500/[0.03] to-transparent dark:from-rose-950/[0.3] dark:via-rose-950/[0.15] dark:to-transparent shadow-lg shadow-rose-950/10 transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldAlert size={22} className="animate-bounce" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-2xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300">
                          Immediate Action Required
                        </span>
                        <span className="text-2xs font-mono text-rose-600 dark:text-rose-400 font-semibold">
                          {lateFees.length} Overdue Installment{lateFees.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <h3 className="font-orbital text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                        Overdue Fee Payment Pending
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                        <strong className="text-slate-900 dark:text-white font-semibold">
                          {lateFees[0].studentName}
                        </strong>{" "}
                        has an overdue milestone of{" "}
                        <strong className="text-rose-600 dark:text-rose-400 font-bold font-mono">
                          {lateFees[0].currency === "INR" ? "₹" : lateFees[0].currency}
                          {lateFees[0].amount.toLocaleString("en-IN")}
                        </strong>{" "}
                        (Installment #{lateFees[0].installmentNumber} · overdue by{" "}
                        {Math.abs(lateFees[0].daysDiff || 0)} days).
                      </p>
                    </div>
                  </div>

                  {/* Immediate One-Tap Action Button */}
                  <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPaymentModalFee(lateFees[0])}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-volt-400 hover:bg-volt-300 text-pitch-950 font-bold dark:text-pitch-950 text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                    >
                      <CreditCard size={16} className="text-pitch-950 stroke-[2.5]" />
                      <span className="text-pitch-950 font-bold">Pay Overdue Fee Now</span>
                    </button>
                    {lateFees.length > 1 && (
                      <a
                        href="#fees-section"
                        className="text-center sm:text-left text-2xs text-rose-600 dark:text-rose-400 hover:underline px-2 py-1"
                      >
                        +{lateFees.length - 1} more overdue
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* B. LIVE SESSION HAPPENING RIGHT NOW */}
            {hasLiveSession && liveSession && (
              <div className="rounded-2xl p-4 sm:p-5 border-2 border-emerald-500/60 bg-gradient-to-r from-emerald-500/[0.1] via-emerald-500/[0.04] to-transparent dark:from-emerald-950/[0.35] dark:via-emerald-950/[0.15] dark:to-transparent shadow-lg shadow-emerald-950/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-field-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Activity size={22} className="animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-field-300 text-2xs font-mono font-bold uppercase tracking-wider">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          Session In Progress
                        </span>
                        {liveSession.teamName && (
                          <span className="text-2xs font-mono uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold">
                            {liveSession.teamName}
                          </span>
                        )}
                      </div>
                      <h3 className="font-orbital text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {liveSession.title || `${liveSession.type} Training Session`}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 mt-1">
                        <span className="flex items-center gap-1 font-mono font-semibold text-slate-900 dark:text-white">
                          <Clock size={12} className="text-emerald-500" />
                          {liveSession.startTime} - {liveSession.endTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-emerald-500" />
                          {liveSession.venue || liveSession.location || "Academy Grounds"}
                          {liveSession.fieldNumber && ` (Field ${liveSession.fieldNumber})`}
                        </span>
                        {liveSession.coachName && (
                          <span>Coach: <strong>{liveSession.coachName}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const mapsUrl = getMapsLink({
                      googleMapsUrl: liveSession.googleMapsUrl,
                      latitude: liveSession.latitude,
                      longitude: liveSession.longitude,
                      location: liveSession.location || liveSession.venue,
                      fieldNumber: liveSession.fieldNumber,
                    });
                    return mapsUrl ? (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all shrink-0 cursor-pointer"
                      >
                        <Compass size={16} />
                        <span>Live Directions (Google Maps)</span>
                        <ExternalLink size={12} />
                      </a>
                    ) : null;
                  })()}
                </div>
              </div>
            )}

            {/* C. PAYMENT UNDER VERIFICATION NOTICE */}
            {verificationPendingFees.length > 0 && (
              <div className="rounded-2xl p-4 border border-blue-500/40 bg-blue-500/[0.05] dark:bg-blue-950/[0.2] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-orbital text-sm font-semibold text-blue-600 dark:text-blue-400">
                        Payment Under Academy Verification
                      </span>
                      <span className="text-2xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300">
                        {verificationPendingFees.length} Pending Approval
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Your payment proof has been submitted. Academy managers are reviewing it. An official receipt will be generated upon approval.
                    </p>
                  </div>
                </div>
                <a
                  href="#fees-section"
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 self-start sm:self-center shrink-0"
                >
                  <span>View Details</span>
                  <ChevronRight size={13} />
                </a>
              </div>
            )}

            {/* D. ALL CLEAR REASSURANCE BANNER (When no overdue fees and no live session) */}
            {lateFees.length === 0 && !hasLiveSession && (
              <div className="rounded-2xl p-4 border border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.02] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-core-400/15 text-core-600 dark:text-core-400 flex items-center justify-center shrink-0">
                    <Sparkles size={18} />
                  </span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      All Caught Up · No Overdue Dues
                      <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-field-400 font-bold">
                        Good Standing
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {sessionsToday.length > 0
                        ? `You have ${sessionsToday.length} training session${sessionsToday.length === 1 ? "" : "s"} scheduled for today.`
                        : sessionsTomorrow.length > 0
                          ? `Next training is scheduled for tomorrow at ${sessionsTomorrow[0].startTime}.`
                          : sessionsUpcoming.length > 0
                            ? `Next upcoming session is on ${new Date(sessionsUpcoming[0].date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at ${sessionsUpcoming[0].startTime}.`
                            : "Your children are up to date on all training registrations and fee schedules."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <a
                    href="#sessions-section"
                    className="text-xs font-semibold text-core-600 dark:text-core-400 hover:underline flex items-center gap-1"
                  >
                    <span>View Schedule</span>
                    <ChevronRight size={13} />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 2. CHILDREN'S TRAINING & SESSION SCHEDULE (HIGH PRIORITY ON MOBILE) */}
          {/* ========================================================================= */}
          <div
            id="sessions-section"
            className="nox-card p-4 sm:p-6 border-slate-200 dark:border-white/[0.08] shadow-sm space-y-5"
          >
            {/* Header + Tabs Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pitch-200/60 dark:border-white/[0.06] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-core-400/10 text-core-500 border border-core-400/20 shrink-0">
                  <Calendar size={20} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-orbital text-base sm:text-lg font-bold text-slate-900 dark:text-nox-high">
                      Children's Training &amp; Session Schedule
                    </h2>
                    {hasLiveSession && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-field-400 text-2xs font-mono font-bold animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-nox-mid mt-0.5">
                    Match fixtures, weekly pitch locations, and Google Maps navigation.
                  </p>
                </div>
              </div>

              {/* Touch-Friendly Horizontal Pill Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl overflow-x-auto no-scrollbar border border-slate-200/80 dark:border-white/[0.06] shrink-0">
                {(
                  [
                    { id: "today", label: "Today", count: sessionsToday.length, isLive: hasLiveSession },
                    { id: "tomorrow", label: "Tomorrow", count: sessionsTomorrow.length },
                    { id: "upcoming", label: "Upcoming", count: sessionsUpcoming.length },
                    { id: "completed", label: "Recent", count: sessionsCompleted.length },
                  ] as const
                ).map((t) => {
                  const active = activeSessionTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveSessionTab(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        active
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      <span>{t.label}</span>
                      {t.count > 0 && (
                        <span
                          className={`text-2xs font-mono px-1.5 py-0.2 rounded-full font-bold ${
                            active
                              ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                              : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {t.count}
                        </span>
                      )}
                      {"isLive" in t && t.isLive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Session Cards Grid */}
            {displayedSessions.length === 0 ? (
              <div className="py-8 sm:py-10 text-center bg-slate-50/60 dark:bg-white/[0.01] rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.08] px-4">
                <div className="w-10 h-10 rounded-full bg-slate-200/70 dark:bg-white/5 flex items-center justify-center mx-auto mb-2 text-slate-400">
                  <Calendar size={18} />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {activeSessionTab === "today"
                    ? "No training sessions scheduled for today."
                    : activeSessionTab === "tomorrow"
                      ? "No training sessions scheduled for tomorrow."
                      : activeSessionTab === "upcoming"
                        ? "No upcoming training sessions scheduled at this moment."
                        : "No recently completed training sessions found."}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Academy coaches update and publish training schedules on a regular basis.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedSessions.map((s) => {
                  const sessionTitle =
                    s.title ||
                    s.notes ||
                    (s.type
                      ? `${s.type.charAt(0).toUpperCase() + s.type.slice(1)} Session`
                      : "Training Session");

                  const venueText =
                    s.venue ||
                    s.location ||
                    (s.fieldNumber ? `Field ${s.fieldNumber}` : "Academy Grounds");

                  const pitchText =
                    s.pitch ||
                    (s.fieldNumber && !venueText.includes(s.fieldNumber)
                      ? `Field ${s.fieldNumber}`
                      : undefined);

                  const mapsUrl = getMapsLink({
                    googleMapsUrl: s.googleMapsUrl,
                    latitude: s.latitude,
                    longitude: s.longitude,
                    location: s.location || s.venue,
                    fieldNumber: s.fieldNumber,
                  });

                  return (
                    <div
                      key={s.id}
                      className={`rounded-2xl p-4 sm:p-5 border transition-all space-y-3.5 ${
                        s.isLive
                          ? "bg-emerald-500/[0.06] border-emerald-500/50 dark:bg-field-500/[0.09] dark:border-field-400/50 shadow-md ring-1 ring-emerald-500/20"
                          : "bg-white dark:bg-white/[0.025] border-slate-200 dark:border-white/[0.08] hover:border-core-400/40 shadow-xs hover:shadow"
                      }`}
                    >
                      {/* Row 1: Badges & Tags */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Child Identifier */}
                          {s.children && s.children.length > 0 ? (
                            s.children.map((child) => (
                              <span
                                key={child.id}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-core-400/10 text-core-700 dark:text-core-300 border border-core-400/25 text-2xs font-semibold"
                              >
                                <User size={11} className="text-core-500" />
                                <span>{child.name}</span>
                              </span>
                            ))
                          ) : s.studentName ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-core-400/10 text-core-700 dark:text-core-300 border border-core-400/25 text-2xs font-semibold">
                              <User size={11} className="text-core-500" />
                              <span>{s.studentName}</span>
                            </span>
                          ) : null}

                          {/* Live Beacon */}
                          {s.isLive && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-field-300 text-2xs font-mono font-bold animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              LIVE NOW
                            </span>
                          )}

                          {/* Team / Category */}
                          {s.teamName && (
                            <span className="text-2xs font-mono uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200/50 dark:border-transparent">
                              {s.teamName}
                            </span>
                          )}
                        </div>

                        {/* Status badge */}
                        <NoxStatusBadge status={s.status} />
                      </div>

                      {/* Row 2: Session Title */}
                      <div>
                        <h4 className="font-orbital text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                          {sessionTitle}
                        </h4>
                        {s.type && (
                          <span className="text-2xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5 block">
                            {s.type} Session
                          </span>
                        )}
                      </div>

                      {/* Row 3: Visual Metadata Grid (Responsive 2-col on mobile) */}
                      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.06] text-xs">
                        {/* Date & Time */}
                        <div className="bg-slate-50 dark:bg-white/[0.02] p-2.5 rounded-xl border border-slate-200/60 dark:border-white/[0.04]">
                          <span className="text-2xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                            Date &amp; Time
                          </span>
                          <div className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                            {new Date(s.date).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                          <div className="flex items-center gap-1 font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                            <Clock size={11} className="text-core-500 shrink-0" />
                            <span>{s.startTime} - {s.endTime}</span>
                          </div>
                        </div>

                        {/* Venue & Pitch */}
                        <div className="bg-slate-50 dark:bg-white/[0.02] p-2.5 rounded-xl border border-slate-200/60 dark:border-white/[0.04]">
                          <span className="text-2xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                            Pitch Location
                          </span>
                          <div className="font-semibold text-slate-900 dark:text-white text-xs truncate">
                            {venueText}
                          </div>
                          {pitchText && (
                            <span className="text-2xs text-slate-500 dark:text-slate-400 font-mono block truncate">
                              {pitchText}
                            </span>
                          )}
                          {s.coachName && (
                            <span className="text-2xs text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                              Coach: <strong className="text-slate-700 dark:text-slate-300 font-medium">{s.coachName}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Row 4: Google Maps Navigation Button (Full width on mobile for thumb tap) */}
                      {mapsUrl && (
                        <div className="pt-2">
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-volt-400/15 hover:bg-volt-400/25 border border-volt-400/35 text-volt-800 dark:text-volt-300 text-xs font-semibold transition-all cursor-pointer"
                            title="Open directions in Google Maps"
                          >
                            <MapPin size={13} className="text-volt-600 dark:text-volt-400" />
                            <span>Open Directions in Google Maps</span>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 3. QUICK STATS RIBBON (COMPACT ON MOBILE) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <NoxStatCard
              label="Children Linked"
              value={data.children.length}
              icon={<Users size={16} />}
              accent="ion"
            />
            <NoxStatCard
              label="Overdue Fees"
              value={lateFees.length}
              icon={<AlertTriangle size={16} />}
              accent={lateFees.length ? "core" : "ion"}
            />
            <NoxStatCard
              label="Due Soon (≤14d)"
              value={pendingFees.length}
              icon={<Wallet size={16} />}
              accent={pendingFees.length ? "plasma" : "ion"}
            />
            <NoxStatCard
              label="Upcoming Installments"
              value={upcomingFees.length}
              icon={<Calendar size={16} />}
              accent="ion"
            />
          </div>

          {/* ========================================================================= */}
          {/* 4. YOUR CHILDREN ROSTER */}
          {/* ========================================================================= */}
          {data.children.length === 0 ? (
            <NoxEmptyState
              title="No children linked yet"
              body="Once your academy links a student to your account, they'll show up here."
              icon={<Users size={28} />}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-orbital text-base sm:text-lg font-bold text-slate-900 dark:text-nox-high">
                    Your Children
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-nox-low">
                    Tap any child to review full attendance history, coach evaluations, and fee schedules.
                  </p>
                </div>
                <span className="text-xs text-slate-500 dark:text-nox-low font-mono">
                  {data.children.length} player{data.children.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.children.map((child) => {
                  const todayStatus = attendanceByStudent.get(child.id);
                  return (
                    <Link
                      key={child.id}
                      to={`/guardian/children/${child.id}`}
                      className="nox-card p-4 sm:p-5 block hover:border-core-400/50 transition-all hover:shadow-md cursor-pointer group rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-11 h-11 rounded-full bg-core-400/15 text-core-600 dark:text-core-400 font-orbital font-bold text-sm shrink-0">
                          {child.firstName.charAt(0)}
                          {child.lastName.charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-orbital text-sm sm:text-base font-bold text-slate-900 dark:text-nox-high truncate group-hover:text-core-500 transition-colors">
                            {child.firstName} {child.lastName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-nox-low font-mono flex items-center gap-2 mt-0.5">
                            <span>{child.attendancePercentage}% attendance</span>
                            {typeof (child as any).ageGroup === "string" && (
                              <span>· {(child as any).ageGroup}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-400 group-hover:text-core-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>

                      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 dark:text-nox-mid">Today:</span>
                          {todayStatus ? (
                            <NoxStatusBadge status={todayStatus} />
                          ) : (
                            <span className="text-2xs font-mono text-slate-400 dark:text-nox-low">
                              Not marked yet
                            </span>
                          )}
                        </div>
                        <span className="text-2xs font-mono text-core-600 dark:text-core-400 font-semibold group-hover:underline">
                          Profile &amp; Fees &rarr;
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. FEE INVOICING & PAYMENT HUB */}
          {/* ========================================================================= */}
          <div id="fees-section" className="space-y-6 pt-2">
            {/* LATE / OVERDUE FEES */}
            {lateFees.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-rose-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                      <AlertTriangle size={16} />
                    </span>
                    <div>
                      <h3 className="font-orbital text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                        Late &amp; Overdue Fees
                        <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold">
                          {lateFees.length} Action Required
                        </span>
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lateFees.map((fee) => {
                    const daysOverdue = Math.abs(fee.daysDiff || 0);
                    const currSymbol = fee.currency === "INR" ? "₹" : fee.currency;
                    return (
                      <div
                        key={`${fee.feeId}-${fee.installmentNumber}`}
                        className="nox-card p-4 sm:p-5 border-rose-500/40 bg-rose-500/[0.04] dark:bg-rose-950/[0.15] flex flex-col justify-between hover:border-rose-500/60 transition-all space-y-4 rounded-2xl"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-orbital text-sm font-bold text-slate-900 dark:text-white truncate">
                                {fee.studentName}
                              </span>
                              <span className="text-2xs font-mono uppercase px-2 py-0.5 rounded bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold shrink-0">
                                {fee.feeType.replace("_", " ")}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Installment #{fee.installmentNumber}
                            </div>
                            <div className="text-xs text-rose-600 dark:text-rose-400 font-mono font-semibold mt-1 flex items-center gap-1.5">
                              <AlertTriangle size={13} />
                              Overdue by {daysOverdue} {daysOverdue === 1 ? "day" : "days"} (Due {new Date(fee.dueDate).toLocaleDateString()})
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-2xs font-mono uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold">
                              Overdue
                            </span>
                            <div className="font-orbital text-lg font-bold text-rose-600 dark:text-rose-400 mt-1.5">
                              {currSymbol}
                              {fee.amount.toLocaleString("en-IN")}
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            Online payment enabled
                          </span>
                          <button
                            type="button"
                            onClick={() => setPaymentModalFee(fee)}
                            className="w-full sm:w-auto nox-btn-primary !bg-volt-400 hover:!bg-volt-300 !text-pitch-950 font-bold dark:!text-pitch-950 text-xs flex items-center justify-center gap-1.5 py-2 px-4 shadow-md transition-all cursor-pointer rounded-xl"
                          >
                            <CreditCard size={14} className="text-pitch-950" />
                            <span className="text-pitch-950 font-bold">Pay Overdue Fee</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PENDING FEES (Due within 14 Days) */}
            {pendingFees.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      <Clock size={16} />
                    </span>
                    <div>
                      <h3 className="font-orbital text-base font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        Pending Fees (Due Soon)
                        <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                          {pendingFees.length} Due in ≤14d
                        </span>
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingFees.map((fee) => {
                    const daysLeft = fee.daysDiff;
                    const currSymbol = fee.currency === "INR" ? "₹" : fee.currency;
                    return (
                      <div
                        key={`${fee.feeId}-${fee.installmentNumber}`}
                        className="nox-card p-4 sm:p-5 border-amber-500/40 bg-amber-500/[0.04] dark:bg-amber-950/[0.12] flex flex-col justify-between hover:border-amber-500/60 transition-all space-y-4 rounded-2xl"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-orbital text-sm font-bold text-slate-900 dark:text-white truncate">
                                {fee.studentName}
                              </span>
                              <span className="text-2xs font-mono uppercase px-2 py-0.5 rounded bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold shrink-0">
                                {fee.feeType.replace("_", " ")}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Installment #{fee.installmentNumber}
                            </div>
                            <div className="text-xs text-amber-600 dark:text-amber-400 font-mono mt-1 flex items-center gap-1.5 font-medium">
                              <Clock size={13} />
                              Due {daysLeft === 0 ? "today" : `in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`} ({new Date(fee.dueDate).toLocaleDateString()})
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-2xs font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                              Due Soon
                            </span>
                            <div className="font-orbital text-lg font-bold text-amber-600 dark:text-amber-400 mt-1.5">
                              {currSymbol}
                              {fee.amount.toLocaleString("en-IN")}
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            Online payment enabled
                          </span>
                          <button
                            type="button"
                            onClick={() => setPaymentModalFee(fee)}
                            className="w-full sm:w-auto nox-btn-primary !bg-volt-400 hover:!bg-volt-300 !text-pitch-950 font-bold dark:!text-pitch-950 text-xs flex items-center justify-center gap-1.5 py-2 px-4 shadow-md transition-all cursor-pointer rounded-xl"
                          >
                            <CreditCard size={14} className="text-pitch-950" />
                            <span className="text-pitch-950 font-bold">Pay Now</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PAYMENTS UNDER ACADEMY VERIFICATION */}
            {verificationPendingFees.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-blue-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      <CheckCircle size={16} />
                    </span>
                    <div>
                      <h3 className="font-orbital text-base font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        Under Academy Verification
                        <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold">
                          {verificationPendingFees.length} Pending Approval
                        </span>
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {verificationPendingFees.map((fee) => {
                    const currSymbol = fee.currency === "INR" ? "₹" : fee.currency;
                    return (
                      <div
                        key={`verif-${fee.feeId}-${fee.installmentNumber}`}
                        className="nox-card p-4 sm:p-5 border-blue-500/30 bg-blue-500/[0.04] dark:bg-blue-950/[0.15] space-y-3 rounded-2xl"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-orbital text-sm font-bold text-slate-900 dark:text-white truncate">
                                {fee.studentName}
                              </span>
                              <span className="text-2xs font-mono uppercase px-2 py-0.5 rounded bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold shrink-0">
                                {fee.feeType.replace("_", " ")}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Installment #{fee.installmentNumber} · Due {new Date(fee.dueDate).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-2xs font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold">
                              Under Review
                            </span>
                            <div className="font-orbital text-base font-bold text-blue-600 dark:text-blue-400 mt-1">
                              {currSymbol}
                              {fee.amount.toLocaleString("en-IN")}
                            </div>
                          </div>
                        </div>
                        <div className="text-2xs font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-blue-500/15 flex items-center justify-between">
                          <span>Proof Submitted</span>
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">Awaiting Manager Approval</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* UPCOMING INSTALLMENTS */}
            {upcomingFees.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-core-400/10 text-core-500 border border-core-400/20">
                      <Calendar size={16} />
                    </span>
                    <div>
                      <h3 className="font-orbital text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Upcoming Installments
                        <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-semibold">
                          {upcomingFees.length} Scheduled
                        </span>
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="nox-card divide-y divide-slate-100 dark:divide-white/[0.06] overflow-hidden rounded-2xl">
                  {upcomingFees.map((fee) => {
                    const currSymbol = fee.currency === "INR" ? "₹" : fee.currency;
                    return (
                      <div
                        key={`${fee.feeId}-${fee.installmentNumber}`}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {fee.studentName}
                            </span>
                            <span className="text-2xs font-mono uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                              {fee.feeType.replace("_", " ")}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2">
                            <span>Installment #{fee.installmentNumber}</span>
                            <span>·</span>
                            <span>Due {new Date(fee.dueDate).toLocaleDateString()}</span>
                            {fee.daysDiff > 0 && (
                              <span className="text-slate-400 font-medium">
                                (in {fee.daysDiff} days)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0">
                          <div className="text-left sm:text-right">
                            <div className="font-orbital text-base font-bold text-slate-900 dark:text-white">
                              {currSymbol}
                              {fee.amount.toLocaleString("en-IN")}
                            </div>
                            <span className="text-2xs font-mono text-core-500 font-medium">
                              Upcoming
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPaymentModalFee(fee)}
                            className="nox-btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-xl cursor-pointer"
                          >
                            <span>Pay in Advance</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Pay Fee Modal */}
          {paymentModalFee && (
            <PayFeeModal
              feeId={paymentModalFee.feeId}
              installmentNumber={paymentModalFee.installmentNumber}
              studentId={paymentModalFee.studentId}
              studentName={paymentModalFee.studentName}
              feeType={paymentModalFee.feeType}
              amount={paymentModalFee.amount}
              dueDate={paymentModalFee.dueDate}
              currency={paymentModalFee.currency}
              onClose={() => setPaymentModalFee(null)}
              onSuccess={() => {
                refetch();
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default GuardianDashboardPage;

