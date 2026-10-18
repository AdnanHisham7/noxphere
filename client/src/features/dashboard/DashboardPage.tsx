import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";
import { clsx } from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Shirt,
  LayoutDashboard,
  CheckCircle2,
  CreditCard,
  Star,
  Users,
  Shield,
  CalendarClock,
  Building2,
  School,
  UserPlus,
  CalendarCheck,
  Wallet,
  Repeat2,
  Settings,
  Radio,
  TrendingUp,
  Activity,
} from "lucide-react";
import {
  StatCard,
  Skeleton,
  Avatar,
  EmptyState,
  Button,
  PageHeader,
} from "../../components/ui";
import { SuperAdminDashboardView } from "./SuperAdminDashboardView";
import { useCurrentFranchiseId } from "../../hooks/useCurrentFranchiseId";
import { useTransferWallEnabled } from "../../hooks/useTransferWallEnabled";
import { useCurrency } from "../../hooks/useCurrency";
import { RootState } from "../../store";
import { setActiveFranchise } from "../../store/slices/uiSlice";
import {
  useGetDashboardStatsQuery,
  useGetAttendanceTrendQuery,
  useGetSkillRadarQuery,
  useGetTeamHealthQuery,
  useGetTopPerformersQuery,
  useGetRecentActivityQuery,
  type AttendanceTrendPoint,
} from "../../store/api/dashboardApi";

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as AttendanceTrendPoint;
  const hasSessions = (item?.total ?? 0) > 0;
  return (
    <div className="bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs shadow-md">
      <p className="text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      {hasSessions ? (
        <div className="mt-0.5 space-y-0.5">
          <p className="text-volt-600 dark:text-volt-400 font-bold text-sm">
            {payload[0].value}%
          </p>
          <p className="text-3xs text-slate-400 font-mono">
            {item.present ?? 0} of {item.total ?? 0} present
          </p>
        </div>
      ) : (
        <p className="text-slate-400 italic mt-0.5 text-2xs">No sessions recorded</p>
      )}
    </div>
  );
};

const renderActivityIcon = (type: string) => {
  switch (type) {
    case "attendance":
      return <CheckCircle2 size={14} className="text-volt-400" />;
    case "performance":
      return <TrendingUp size={14} className="text-ice-400" />;
    case "fee":
      return <CreditCard size={14} className="text-field-400" />;
    default:
      return <Activity size={14} className="text-slate-400" />;
  }
};

const DashboardPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { format: formatMoney } = useCurrency();
  const activeFranchiseId = useCurrentFranchiseId();
  const user = useSelector((s: RootState) => s.auth.user);
  const academyId = user?.academyId;

  const isSuperAdmin = user?.role === "super_admin";
  const isOwnerManager = (user?.role === "manager" || user?.role === "operational_manager") && !user?.franchiseId;

  // The plain /dashboard route always shows the academy-wide overview for
  // an owner-manager, regardless of any franchise picked earlier while
  // browsing other pages (Students/Fees/etc. still honor that selection —
  // only this page ignores it). Franchise-specific dashboards live at
  // /franchises/:id instead, reached from the Franchises tab.
  const franchiseId = isOwnerManager
    ? undefined
    : (user?.franchiseId ?? activeFranchiseId ?? undefined);
  const isConsolidated = isOwnerManager;
  const transferWallEnabled = useTransferWallEnabled();
  const skip = !isSuperAdmin && !franchiseId && !academyId;
  const queryParams = isSuperAdmin
    ? {}
    : isConsolidated
      ? { academyId: academyId ?? undefined }
      : { franchiseId };

  const [attendanceDays, setAttendanceDays] = useState<number>(7);

  const { data: stats, isLoading: statsLoading } = useGetDashboardStatsQuery(
    queryParams,
    { skip: skip || isSuperAdmin },
  );
  const { data: attendanceTrend, isLoading: trendLoading } =
    useGetAttendanceTrendQuery(
      { ...queryParams, days: attendanceDays },
      { skip: skip || isSuperAdmin },
    );

  const activeTrendSummary = useMemo(() => {
    if (!attendanceTrend || attendanceTrend.length === 0) return null;
    const withSessions = attendanceTrend.filter((d) => (d.total ?? 0) > 0);
    if (withSessions.length === 0) return null;
    const totalPresent = withSessions.reduce((acc, d) => acc + (d.present ?? 0), 0);
    const totalSessions = withSessions.reduce((acc, d) => acc + (d.total ?? 0), 0);
    const rate = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 1000) / 10 : 0;
    return {
      rate,
      present: totalPresent,
      total: totalSessions,
      sessionDays: withSessions.length,
    };
  }, [attendanceTrend]);
  const { data: radarData, isLoading: radarLoading } = useGetSkillRadarQuery(
    queryParams,
    { skip: skip || isSuperAdmin },
  );
  const { data: teamHealth, isLoading: teamsLoading } = useGetTeamHealthQuery(
    queryParams,
    { skip: skip || isSuperAdmin },
  );
  const { data: topPerformers, isLoading: performersLoading } =
    useGetTopPerformersQuery(
      { ...queryParams, limit: 5 },
      { skip: skip || isSuperAdmin },
    );
  const { data: recentActivity, isLoading: activityLoading } =
    useGetRecentActivityQuery(
      { ...queryParams, limit: 8 },
      { skip: skip || isSuperAdmin },
    );

  if (!franchiseId && !academyId && !isSuperAdmin) {
    return (
      <EmptyState
        icon={<LayoutDashboard size={28} />}
        title="No branch selected"
        description="Select a branch from the top bar or log in as an academy manager to see its dashboard."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <PageHeader
        eyebrow={
          isSuperAdmin
            ? "System Overview"
            : isConsolidated
              ? "Academy Overview"
              : "Overview"
        }
        title={
          isSuperAdmin
            ? "Super Admin Dashboard"
            : isConsolidated
              ? "Academy Dashboard"
              : "Dashboard"
        }
        subtitle={new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        actions={
          <span className="flex items-center gap-1.5 text-xs text-volt-400 bg-volt-400/10 border border-volt-400/20 rounded px-2.5 sm:px-3 py-1.5 font-bold font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-volt-400 animate-pulse-volt shrink-0" />
            {isSuperAdmin
              ? "Super Admin Active"
              : isConsolidated
                ? "Academy-wide"
                : "Branch Active"}
          </span>
        }
      />

      {/* Super Admin Master Analytics or Manager/Coach Dashboard */}
      {isSuperAdmin ? (
        <SuperAdminDashboardView />
      ) : (
        <>
          {/* KPI Stats Row - 2 cards per row on mobile screen (Total Sessions hidden on mobile) */}
          {statsLoading ? (
            <div
              className={clsx(
                "grid gap-2.5 sm:gap-4",
                isConsolidated
                  ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                  : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4",
              )}
            >
              {Array.from({ length: isConsolidated ? 5 : 4 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className={clsx(
                    "h-28 rounded-lg",
                    isConsolidated && i === 4 && "hidden sm:block",
                  )}
                />
              ))}
            </div>
          ) : isConsolidated ? (
            /* Consolidated (academy-wide) Stats Layout - Total Sessions hidden on mobile */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
              <StatCard
                label="Total Branches"
                value={stats?.franchisePerformance?.length ?? 0}
                sublabel="Operational branches"
                icon={<Building2 className="h-5 w-5" />}
                accent="field"
              />

              <StatCard
                label="Total Players"
                value={stats?.totalStudents ?? 0}
                sublabel={`${stats?.pendingEnrollment ?? 0} pending`}
                icon={<Shirt className="h-5 w-5" />}
                accent="volt"
              />

              <StatCard
                label="Total Coaches"
                value={stats?.totalCoaches ?? 0}
                sublabel="Active staff"
                icon={<Users className="h-5 w-5" />}
                accent="ice"
              />

              <StatCard
                label="Total Fees"
                value={formatMoney(stats?.feesCollected ?? 0)}
                sublabel={`${formatMoney(stats?.feesOutstanding ?? 0)} unpaid`}
                icon={<CreditCard className="h-5 w-5" />}
                accent="volt"
              />

              <StatCard
                label="Total Sessions"
                value={stats?.totalSessions ?? 0}
                sublabel="Completed & upcoming"
                icon={<CalendarClock className="h-5 w-5" />}
                accent="field"
                className="hidden sm:flex"
              />
            </div>
          ) : (
            /* Single Franchise Stats Layout - 2 cards in one row on mobile */
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              <StatCard
                label="Total Students"
                value={stats?.totalStudents ?? 0}
                sublabel={`${stats?.pendingEnrollment ?? 0} pending enrollment`}
                icon={<Shirt className="h-5 w-5" />}
                accent="volt"
              />

              <StatCard
                label="Avg Attendance"
                value={`${stats?.avgAttendance ?? 0}%`}
                sublabel="This week"
                icon={<CheckCircle2 className="h-5 w-5" />}
                accent="field"
              />

              <StatCard
                label="Fees Collected"
                value={formatMoney(stats?.feesCollected ?? 0)}
                sublabel={`${formatMoney(stats?.feesOutstanding ?? 0)} outstanding`}
                icon={<CreditCard className="h-5 w-5" />}
                accent="ice"
              />

              <StatCard
                label="Avg Rating"
                value={stats?.avgRating ?? 0}
                sublabel="Out of 10.0"
                icon={<Star className="h-5 w-5" />}
                accent="ember"
              />
            </div>
          )}

      {/* Main content grid */}
      {!isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Attendance trend chart */}
          <div className="lg:col-span-2 card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="section-title">Attendance Trend</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {attendanceDays === 7 && `Last 7 days daily — ${isConsolidated ? "consolidated academy view" : "all teams"}`}
                  {attendanceDays === 30 && `Last 30 days daily — ${isConsolidated ? "consolidated academy view" : "all teams"}`}
                  {attendanceDays === 365 && `Last 12 months — ${isConsolidated ? "consolidated academy view" : "all teams"}`}
                  {attendanceDays === 0 && `Overall historical trend — ${isConsolidated ? "consolidated academy view" : "all teams"}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-pitch-800 p-0.5 rounded-lg border border-slate-200 dark:border-white/5">
                  {[
                    { label: "7D", title: "Last 7 Days", value: 7 },
                    { label: "1M", title: "Last Month (30 Days)", value: 30 },
                    { label: "1Y", title: "Last 12 Months", value: 365 },
                    { label: "All", title: "Overall Historical", value: 0 },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setAttendanceDays(t.value)}
                      className={clsx(
                        "px-2.5 py-1 rounded text-2xs font-bold transition-all",
                        attendanceDays === t.value
                          ? "bg-white dark:bg-pitch-700 text-volt-600 dark:text-volt-400 shadow-xs"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
                      )}
                      title={t.title}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-volt-400 font-display font-extrabold text-xl block leading-tight">
                    {activeTrendSummary ? `${activeTrendSummary.rate}%` : `${stats?.avgAttendance ?? 0}%`}
                  </span>
                  <span className="text-3xs text-slate-500 font-mono block">
                    {activeTrendSummary
                      ? `${activeTrendSummary.present}/${activeTrendSummary.total} present`
                      : "period avg"}
                  </span>
                </div>
              </div>
            </div>
            {trendLoading ? (
              <Skeleton className="h-40 rounded" />
            ) : !attendanceTrend?.length ||
              attendanceTrend.every((d) => (d.total ?? 0) === 0) ? (
              <EmptyState
                title="No attendance recorded for this timeframe"
                description={
                  attendanceDays === 7
                    ? "No sessions conducted in the last 7 days. Try switching to 1M, 1Y, or All."
                    : attendanceDays === 30
                      ? "No sessions conducted in the last 30 days. Try switching to 1Y or All."
                      : "Mark attendance in sessions to populate trend data."
                }
              />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={attendanceTrend}>
                  <defs>
                    <linearGradient id="voltGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#ccff00"
                        stopOpacity={0.15}
                      />
                      <stop offset="95%" stopColor="#ccff00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    interval={
                      attendanceDays === 30
                        ? 4
                        : attendanceDays === 0 && (attendanceTrend?.length ?? 0) > 12
                          ? "preserveStartEnd"
                          : 0
                    }
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="#ccff00"
                    strokeWidth={2}
                    fill="url(#voltGrad)"
                    dot={{ fill: "#ccff00", strokeWidth: 0, r: 3 }}
                    activeDot={{ fill: "#ccff00", r: 5, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Skill radar */}
          <div className="card p-5 space-y-4">
            <div>
              <p className="section-title">
                {isConsolidated ? "Overall Avg Skills" : "Branch Avg Skills"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {isConsolidated
                  ? "All branches aggregate"
                  : "All players aggregate"}
              </p>
            </div>
            {radarLoading ? (
              <Skeleton className="h-44 rounded" />
            ) : !radarData?.length ? (
              <EmptyState
                title="No performance data yet"
                description="Log a session to populate skill averages."
              />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                  />
                  <Radar
                    dataKey="avg"
                    stroke="#ccff00"
                    fill="#ccff00"
                    fillOpacity={0.08}
                    strokeWidth={1.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Super Admin Welcome & Control Panel */}
      {isSuperAdmin && (
        <div className="card p-6 space-y-4 max-w-4xl animate-fade-in">
          <h2 className="font-display font-extrabold text-slate-900 dark:text-white text-lg uppercase tracking-wide">
            Welcome to the System Control Panel
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
            As a Super Admin, you have system-wide administration rights. You
            can onboard new football academies, manage billing/finance
            transactions, register platform managers, and inspect high-level
            statistics across all branches.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/academies">
              <Button>Manage Academies</Button>
            </Link>
            <Link to="/users">
              <Button variant="secondary">System Users</Button>
            </Link>
            <Link to="/finance">
              <Button variant="secondary">Finance & Billing</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Franchise Performance list (only on the academy-wide overview) */}
      {isConsolidated &&
        stats?.franchisePerformance &&
        stats.franchisePerformance.length > 0 && (
          <div className="card p-3.5 sm:p-5 space-y-4 animate-fade-in">
            <div>
              <p className="section-title">Branch Performance</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Consolidated overview of all operational branches
              </p>
            </div>
            <div className="table-responsive">
              <table className="w-full min-w-[680px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/5 pb-2">
                    <th className="py-2.5 px-3.5 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Branch
                    </th>
                    <th className="py-2.5 px-3 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                      Players
                    </th>
                    <th className="py-2.5 px-3 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                      Teams
                    </th>
                    <th className="py-2.5 px-3 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                      Sessions
                    </th>
                    <th className="py-2.5 px-3 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                      Collected
                    </th>
                    <th className="py-2.5 px-3 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                      Outstanding
                    </th>
                    <th className="py-2.5 px-3 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                      Status
                    </th>
                    <th className="py-2.5 px-3.5 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {stats.franchisePerformance.map((fp) => (
                    <tr
                      key={fp.id}
                      className="group transition-colors duration-150 hover:bg-slate-100/70 dark:hover:bg-pitch-700/40 dark:hover:bg-white/[0.04]"
                    >
                      <td className="py-3 px-3.5">
                        <p className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-volt-600 dark:group-hover:text-volt-400 transition-colors">
                          {fp.name}
                        </p>
                        <p className="text-2xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {fp.code} · {fp.location ?? "No location"}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-700 dark:text-slate-300 text-sm">
                        {fp.totalPlayers}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-700 dark:text-slate-300 text-sm">
                        {fp.totalTeams}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-700 dark:text-slate-300 text-sm">
                        {fp.totalSessions}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-600 dark:text-field-400 font-mono text-sm">
                        {formatMoney(fp.feesCollected)}
                      </td>
                      <td className="py-3 px-3 text-right text-amber-600 dark:text-ember-400 font-mono text-sm">
                        {formatMoney(fp.feesOutstanding)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                            fp.isActive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-field-400 border border-emerald-500/20"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                          )}
                        >
                          {fp.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <Button
                          size="sm"
                          onClick={() => {
                            dispatch(setActiveFranchise(fp.id));
                            navigate(`/franchises/${fp.id}`);
                          }}
                        >
                          View Dashboard
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Team Health + Top Performers + Activity (Visible for standard Franchise views) */}
      {!isConsolidated && !isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
          {/* Team health */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-title">Team Health</p>
              <Link
                to="/teams"
                className="text-xs text-volt-600 dark:text-volt-400 hover:underline"
              >
                View all →
              </Link>
            </div>
            {teamsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded" />
                ))}
              </div>
            ) : !teamHealth?.length ? (
              <EmptyState
                title="No teams yet"
                description="Create a team to track its health here."
              />
            ) : (
              <div className="space-y-3">
                {teamHealth.map((team) => (
                  <div
                    key={team.name}
                    className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-pitch-700 rounded border border-slate-200/80 dark:border-transparent"
                  >
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center text-xs font-display font-extrabold text-pitch-900 flex-shrink-0"
                      style={{
                        backgroundColor:
                          team.attendance > 90
                            ? "#00e676"
                            : team.attendance > 80
                              ? "#ccff00"
                              : "#ff6b35",
                      }}
                    >
                      {team.name.replace("Team ", "").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {team.name}
                        </p>
                        <span className="text-2xs text-slate-500">
                          {team.students} players
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-2xs text-slate-500">
                          Att:{" "}
                          <span className="text-volt-600 dark:text-volt-400 font-semibold">
                            {team.attendance}%
                          </span>
                        </span>
                        <span className="text-2xs text-slate-500">
                          Perf:{" "}
                          <span className="text-sky-600 dark:text-ice-400 font-semibold">
                            {team.performance}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top performers */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-title">Top Performers</p>
              <Link
                to="/students"
                className="text-xs text-volt-600 dark:text-volt-400 hover:underline"
              >
                Full rankings →
              </Link>
            </div>
            {performersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded" />
                ))}
              </div>
            ) : !topPerformers?.length ? (
              <EmptyState
                title="No ratings yet"
                description="Log performance scores to rank players."
              />
            ) : (
              <div className="space-y-3">
                {topPerformers.map((player, i) => (
                  <div key={player.id} className="flex items-center gap-3">
                    <span
                      className={clsx(
                        "font-display font-900 text-sm w-5 text-center",
                        i === 0
                          ? "text-volt-600 dark:text-volt-400"
                          : i === 1
                            ? "text-slate-400 dark:text-slate-300"
                            : "text-slate-400 dark:text-slate-500",
                      )}
                    >
                      {i + 1}
                    </span>
                    <Avatar name={player.name} src={player.avatar} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {player.name}
                      </p>
                      <p className="text-2xs text-slate-500">
                        {player.team} · {player.position}
                      </p>
                    </div>
                    <span className="font-display font-extrabold text-volt-600 dark:text-volt-400 text-sm">
                      {player.rating}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity feed */}
          <div className="card p-5 space-y-4">
            <p className="section-title">Live Activity</p>
            {activityLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded" />
                ))}
              </div>
            ) : !recentActivity?.length ? (
              <EmptyState
                title="No recent activity"
                description="Actions across the branch will show up here."
              />
            ) : (
              <div className="space-y-0">
                {recentActivity.map((item, i) => (
                  <div
                    key={item.id}
                    className={clsx(
                      "flex gap-3 py-3",
                      i < recentActivity.length - 1 &&
                        "border-b border-slate-100 dark:border-white/5",
                    )}
                  >
                    <div className="w-7 h-7 rounded bg-slate-100 dark:bg-pitch-700 flex items-center justify-center flex-shrink-0">
                      {renderActivityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-tight">
                        {item.message}
                      </p>
                      <p className="text-2xs text-slate-400 dark:text-slate-500 mt-1">
                        {formatDistanceToNowStrict(new Date(item.time), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions row */}
      {!isSuperAdmin && (
        <div className="space-y-2.5 animate-fade-in">
          <p className="text-2xs font-mono uppercase tracking-widest text-slate-500 font-bold px-1">
            Operational Shortcuts
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {[
              {
                label: "Register Player",
                icon: UserPlus,
                to: "/students",
                desc: "Add new athlete to squad",
                badgeStyle:
                  "text-volt-500 dark:text-volt-400 bg-volt-400/10 border-volt-400/25",
              },
              {
                label: "Session Roster",
                icon: CalendarCheck,
                to: "/schedule",
                desc: "Live attendance & drills",
                badgeStyle:
                  "text-field-500 dark:text-field-400 bg-field-400/10 border-field-400/25",
              },
              {
                label: "Fee Ledger",
                icon: Wallet,
                to: "/fees",
                desc: "Collect installments & dues",
                badgeStyle:
                  "text-ice-500 dark:text-ice-400 bg-ice-400/10 border-ice-400/25",
              },
              {
                label: "Squad & Teams",
                icon: Users,
                to: "/teams",
                desc: "Formation & rosters",
                badgeStyle:
                  "text-purple-400 bg-purple-500/10 border-purple-500/25",
              },
              {
                label: "Training Branches",
                icon: Building2,
                to: "/franchises",
                desc: "Centres & pitch locations",
                badgeStyle:
                  "text-amber-500 bg-amber-500/10 border-amber-500/25",
              },
              {
                label: "Transfer Wall",
                icon: Repeat2,
                to: "/transfer-wall",
                desc: "Scouting & recruitment",
                badgeStyle:
                  "text-ember-500 bg-ember-500/10 border-ember-500/25",
              },
              {
                label: "Smart NFC Passes",
                icon: Radio,
                to: "/nfc-cards",
                desc: "Order & manage ID cards",
                badgeStyle:
                  "text-emerald-500 bg-emerald-500/10 border-emerald-500/25",
              },
              {
                label: "Academy Settings",
                icon: Settings,
                to: "/settings",
                desc: "Branding & billing tier",
                badgeStyle:
                  "text-slate-400 bg-slate-500/10 border-slate-500/25",
              },
            ].filter((action) => action.to !== "/transfer-wall" || transferWallEnabled)
            .map((action) => {
              const IconComp = action.icon;
              return (
                <Link
                  key={action.label}
                  to={action.to}
                  className="card p-3.5 flex items-center gap-3 border border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-all group"
                >
                  <div
                    className={clsx(
                      "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                      action.badgeStyle,
                    )}
                  >
                    <IconComp size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate group-hover:text-volt-500 dark:group-hover:text-volt-400 transition-colors">
                      {action.label}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate block">
                      {action.desc}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default DashboardPage;
