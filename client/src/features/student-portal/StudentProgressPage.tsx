// src/features/student-portal/StudentProgressPage.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Compass,
  ArrowRight,
  CalendarCheck,
  Wallet,
  TrendingUp,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  Award,
  UserCheck,
  Activity,
  FileText,
} from "lucide-react";
import { clsx } from "clsx";
import {
  useGetMyAttendanceQuery,
  useGetMyFeesQuery,
  useGetMyPerformanceQuery,
  useGetMySessionsQuery,
  useGetMyDashboardQuery,
} from "../../store/api/studentPortalApi";
import {
  NoxPageHeader,
  NoxSkeleton,
  NoxEmptyState,
  NoxStatusBadge,
  NoxStatCard,
} from "../../components/portal-ui";
import { Badge } from "../../components/ui";

type Tab = "attendance" | "schedule" | "fees" | "performance";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "schedule", label: "Schedule & Events", icon: Clock },
  { id: "fees", label: "Fees", icon: Wallet },
  { id: "performance", label: "Performance", icon: TrendingUp },
];

const StudentProgressPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("attendance");
  const { data: dashboard, isLoading: isDashLoading } =
    useGetMyDashboardQuery();

  if (isDashLoading) {
    return <NoxSkeleton className="h-64" />;
  }

  const isFreeAgent = dashboard && !dashboard.profile?.franchiseId;
  if (isFreeAgent) {
    return (
      <div className="space-y-6 animate-fade-in">
        <NoxPageHeader eyebrow="Student portal" title="My progress" />
        <div className="nox-card p-8 text-center max-w-xl mx-auto space-y-4 border-amber-400/20 bg-amber-400/[0.02]">
          <div className="w-12 h-12 rounded-full bg-amber-400/10 text-amber-400 flex items-center justify-center mx-auto">
            <Compass size={24} />
          </div>
          <div>
            <span className="text-2xs font-mono uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full font-semibold">
              Free Agent • Unattached
            </span>
            <h3 className="font-orbital font-semibold text-lg text-nox-high mt-2">
              Academy Progress Not Active
            </h3>
            <p className="text-xs text-nox-low mt-1 leading-relaxed">
              Attendance tracking, training schedules, fee plans, and coach
              evaluation notes become active once you join an academy squad. In
              the meantime, you can manage your verified public player card and
              privacy settings from your dashboard.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/student/dashboard"
              className="nox-btn-primary inline-flex items-center gap-2 text-xs"
            >
              <span>Go to Free Agent Dashboard</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const profile = dashboard?.profile;

  return (
    <div className="space-y-6 animate-fade-in">
      <NoxPageHeader eyebrow="Student portal" title="My progress" />

      {/* Enrolled Player Profile Header Banner */}
      {profile && (
        <div className="nox-card p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {profile.photo ? (
              <img
                src={profile.photo}
                alt={profile.firstName}
                className="w-14 h-14 rounded-full object-cover border-2 border-volt-500/30 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-core-400/15 text-core-400 font-orbital font-bold text-lg flex items-center justify-center shrink-0 border border-core-400/30">
                {profile.firstName[0]}
                {profile.lastName[0]}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-orbital text-lg font-bold text-nox-high truncate">
                {profile.firstName} {profile.lastName}
              </h2>
              <p className="text-xs text-nox-mid mt-0.5 truncate flex items-center gap-2">
                <span>
                  {profile.team?.name || profile.ageGroup || "Squad Member"}
                </span>
                {profile.position && (
                  <>
                    <span>·</span>
                    <span className="text-volt-400 font-medium">
                      {profile.position}
                    </span>
                  </>
                )}
                {profile.jerseyNumber !== undefined && (
                  <>
                    <span>·</span>
                    <span className="font-mono">#{profile.jerseyNumber}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <NoxStatCard
              label="Attendance"
              value={`${profile.attendancePercentage ?? 0}%`}
              accent="ion"
            />
            <NoxStatCard
              label="Rating"
              value={
                profile.overallRating ? profile.overallRating.toFixed(1) : "—"
              }
              accent="plasma"
            />
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] overflow-x-auto no-scrollbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap",
                active
                  ? "border-core-400 text-core-400"
                  : "border-transparent text-nox-mid hover:text-nox-high",
              )}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {tab === "attendance" && <AttendanceTab />}
      {tab === "schedule" && <ScheduleTab />}
      {tab === "fees" && <FeesTab />}
      {tab === "performance" && <PerformanceTab />}
    </div>
  );
};

const AttendanceTab: React.FC = () => {
  const { data, isLoading } = useGetMyAttendanceQuery();

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!data || data.records.length === 0) {
    return (
      <NoxEmptyState
        title="No attendance records yet"
        body="Training session attendance records will appear here once marked by your coach."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <NoxStatCard
          label="Present"
          value={data.summary.present}
          accent="ion"
        />
        <NoxStatCard label="Absent" value={data.summary.absent} accent="core" />
        <NoxStatCard label="Late" value={data.summary.late} accent="plasma" />
        <NoxStatCard
          label="Attendance Rate"
          value={`${data.summary.percentage}%`}
          accent="ion"
        />
      </div>

      <div className="nox-card divide-y divide-white/[0.06] overflow-hidden">
        {data.records.map((r) => (
          <div
            key={r._id}
            className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.01] transition-colors"
          >
            <div>
              <div className="text-sm font-medium text-nox-high">
                {new Date(r.sessionDate).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              {r.remarks && (
                <div className="text-xs text-nox-low mt-0.5">{r.remarks}</div>
              )}
            </div>
            <NoxStatusBadge status={r.status} />
          </div>
        ))}
      </div>
    </div>
  );
};

const ScheduleTab: React.FC = () => {
  const { data: sessions, isLoading } = useGetMySessionsQuery();

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!sessions || sessions.length === 0) {
    return (
      <NoxEmptyState
        title="No upcoming sessions scheduled"
        body="Training schedules and match fixtures assigned to your squad will appear here."
      />
    );
  }

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));

  const isUpcoming = (s: any) => {
    // Already marked or completed sessions must never appear in upcoming sessions
    if (s.status === "completed" || s.isMarked || s.attendanceStatus) {
      return false;
    }
    return new Date(s.date) >= todayStart;
  };

  const upcomingSessions = sessions.filter(isUpcoming);
  // Past sessions: only sessions the student actually attended (have a real attendance record)
  const pastSessions = sessions.filter((s: any) => !!s.attendanceStatus);

  return (
    <div className="space-y-6">
      {upcomingSessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-orbital text-xs uppercase tracking-wider text-core-400 font-bold flex items-center gap-2">
            <Calendar size={14} /> Upcoming Training & Matches (
            {upcomingSessions.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingSessions.map((session) => {
              const sId = (session as any).id || (session as any)._id;
              const sType = session.type || "training";
              const sTitle =
                (session as any).notes ||
                session.teamName ||
                (session as any).title ||
                "Squad Practice Session";
              const sCoach =
                session.coach ||
                (typeof (session as any).coachId === "object"
                  ? `${(session as any).coachId?.firstName} ${(session as any).coachId?.lastName}`
                  : undefined);

              return (
                <div
                  key={sId}
                  className="nox-card p-4 space-y-3 hover:border-white/15 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-slate-300 capitalize">
                        {sType}
                      </span>
                      <h4 className="font-orbital font-bold text-sm text-nox-high mt-1.5">
                        {sTitle}
                      </h4>
                    </div>
                    <Badge
                      variant={sType === "match" ? "red" : "blue"}
                      className="text-2xs capitalize"
                    >
                      {sType}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-2xs text-nox-mid pt-1 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-volt-400 shrink-0" />
                      <span>
                        {new Date(session.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span>&bull;</span>
                      <Clock size={12} className="text-slate-400 shrink-0" />
                      <span>
                        {session.startTime} - {session.endTime}
                      </span>
                    </div>

                    {session.location && (
                      <div className="flex items-center gap-2">
                        <MapPin
                          size={12}
                          className="text-emerald-400 shrink-0"
                        />
                        <span>
                          {session.location}{" "}
                          {session.fieldNumber
                            ? `(Pitch #${session.fieldNumber})`
                            : ""}
                        </span>
                      </div>
                    )}

                    {sCoach && (
                      <div className="flex items-center gap-2">
                        <UserCheck
                          size={12}
                          className="text-core-400 shrink-0"
                        />
                        <span>Coach: {sCoach}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pastSessions.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="font-orbital text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-2">
            <CheckCircle2 size={13} /> Sessions I Attended ({pastSessions.length})
          </h3>
          <div className="nox-card divide-y divide-white/[0.06] overflow-hidden">
            {pastSessions.slice(0, 10).map((session) => {
              const sId = (session as any).id || (session as any)._id;
              const sTitle =
                (session as any).notes ||
                session.teamName ||
                (session as any).title ||
                "Squad Practice";
              return (
                <div
                  key={sId}
                  className="p-4 flex items-center justify-between text-xs hover:bg-white/[0.01]"
                >
                  <div>
                    <p className="font-semibold text-nox-high">{sTitle}</p>
                    <p className="text-2xs text-nox-low mt-0.5">
                      {new Date(session.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      &bull; {session.startTime} - {session.endTime}
                    </p>
                  </div>
                  <NoxStatusBadge status={(session as any).attendanceStatus} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {upcomingSessions.length === 0 && pastSessions.length === 0 && (
        <NoxEmptyState
          title="No sessions yet"
          body="Your upcoming sessions and attendance history will appear here once sessions are marked by your coach."
        />
      )}
    </div>
  );
};

const FeesTab: React.FC = () => {
  const { data, isLoading } = useGetMyFeesQuery();

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!data || data.length === 0) {
    return (
      <NoxEmptyState
        title="No fee records yet"
        body="Fee plans set up by your academy will appear here."
      />
    );
  }

  return (
    <div className="space-y-5">
      {data.map((fee) => (
        <div key={fee._id} className="nox-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-orbital text-sm font-medium text-nox-high capitalize">
                {fee.feeType.replace("_", " ")}
              </div>
              <div className="text-xs text-nox-low font-mono mt-0.5">
                ₹{fee.finalAmount.toLocaleString("en-IN")} total
              </div>
            </div>
            <NoxStatusBadge status={fee.overallStatus} />
          </div>
          <div className="space-y-2">
            {fee.installments.map((inst) => (
              <div
                key={inst.installmentNumber}
                className="flex items-center justify-between text-sm bg-white/[0.02] rounded-lg px-3 py-2.5"
              >
                <span className="text-nox-mid text-xs">
                  Installment {inst.installmentNumber} &bull; due{" "}
                  {new Date(inst.dueDate).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-nox-high font-mono text-xs">
                    ₹{inst.paidAmount.toLocaleString("en-IN")} / ₹
                    {inst.amount.toLocaleString("en-IN")}
                  </span>
                  <NoxStatusBadge status={inst.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const PerformanceTab: React.FC = () => {
  const { data, isLoading } = useGetMyPerformanceQuery();

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!data || (data.performance.length === 0 && data.remarks.length === 0)) {
    return (
      <NoxEmptyState
        title="No performance records yet"
        body="Assessments and coach remarks will show up here as your coaches review your matches and drills."
      />
    );
  }

  return (
    <div className="space-y-6">
      {data.performance.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-orbital text-xs uppercase tracking-wider text-core-400 font-bold flex items-center gap-2">
            <Award size={14} /> Performance Assessments (
            {data.performance.length})
          </h3>
          <div className="nox-card divide-y divide-white/[0.06]">
            {data.performance.map((p) => (
              <div
                key={p._id}
                className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.01]"
              >
                <div>
                  <span className="text-sm font-semibold text-nox-high block">
                    Periodic Assessment
                  </span>
                  <span className="text-2xs text-nox-low font-mono">
                    Recorded on{" "}
                    {new Date(p.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {p.notes && (
                    <p className="text-xs text-nox-mid mt-1">{p.notes}</p>
                  )}
                </div>
                {typeof p.overallRating === "number" && (
                  <div className="text-right">
                    <span className="text-2xs text-nox-low block uppercase font-mono">
                      Score
                    </span>
                    <span className="font-orbital text-lg font-bold text-core-400">
                      {p.overallRating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.remarks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-orbital text-xs uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-2">
            <Sparkles size={14} /> Coach Notes & Technical Remarks (
            {data.remarks.length})
          </h3>
          <div className="nox-card divide-y divide-white/[0.06]">
            {data.remarks.map((r) => (
              <div key={r._id} className="px-5 py-4 hover:bg-white/[0.01]">
                <div className="text-2xs text-nox-low font-mono">
                  {new Date(r.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <p className="text-sm text-nox-high mt-1 leading-relaxed">
                  {r.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProgressPage;
