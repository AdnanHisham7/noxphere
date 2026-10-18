// src/features/franchises/FranchiseDashboardPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
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
  ArrowLeft,
  Shirt,
  CheckCircle2,
  CreditCard,
  Star,
  Building2,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Search,
  Trophy,
  Crown,
} from "lucide-react";
import {
  StatCard,
  Skeleton,
  Avatar,
  EmptyState,
  Badge,
  Modal,
  Button,
} from "../../components/ui";
import { useCurrency } from "../../hooks/useCurrency";
import { setActiveFranchise } from "../../store/slices/uiSlice";
import { useGetFranchiseByIdQuery } from "../../store/api/franchiseApi";
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
      return (
        <CheckCircle2 size={15} className="text-volt-500 dark:text-volt-400" />
      );
    case "performance":
      return (
        <TrendingUp size={15} className="text-sky-500 dark:text-ice-400" />
      );
    case "fee":
      return (
        <CreditCard
          size={15}
          className="text-emerald-500 dark:text-field-400"
        />
      );
    default:
      return <Activity size={15} className="text-slate-400" />;
  }
};

const getTeamHealthStatus = (attendance: number, performance: number) => {
  if (attendance >= 85 && performance >= 7.5) {
    return {
      label: "Optimal",
      dot: "bg-emerald-500",
      badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      barColor: "bg-emerald-500",
    };
  }
  if (attendance >= 75 || performance >= 6.5) {
    return {
      label: "Stable",
      dot: "bg-volt-400",
      badge: "bg-volt-400/10 text-volt-600 dark:text-volt-400 border-volt-400/20",
      barColor: "bg-volt-400",
    };
  }
  return {
    label: "Attention Needed",
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    barColor: "bg-amber-500",
  };
};

export const FranchiseDashboardPage: React.FC = () => {
  const params = useParams<{ franchiseId?: string; id?: string }>();
  const franchiseId = params.franchiseId || params.id;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { format: formatMoney } = useCurrency();

  useEffect(() => {
    if (franchiseId) {
      dispatch(setActiveFranchise(franchiseId));
    }
  }, [franchiseId, dispatch]);

  const { data: franchise, isLoading: franchiseLoading } =
    useGetFranchiseByIdQuery(franchiseId ?? "", { skip: !franchiseId });

  const queryParams = { franchiseId: franchiseId ?? undefined };
  const skip = !franchiseId;

  const { data: stats, isLoading: statsLoading } = useGetDashboardStatsQuery(
    queryParams,
    { skip },
  );
  const [attendanceDays, setAttendanceDays] = useState<number>(7);
  const [showAllActivityModal, setShowAllActivityModal] = useState<boolean>(false);
  const [activitySearchTerm, setActivitySearchTerm] = useState<string>("");
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");

  const handleOpenAllActivityModal = () => {
    setActivitySearchTerm("");
    setActivityTypeFilter("all");
    setShowAllActivityModal(true);
  };

  const { data: attendanceTrend, isLoading: trendLoading } =
    useGetAttendanceTrendQuery({ ...queryParams, days: attendanceDays }, { skip });

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
    { skip },
  );
  const { data: teamHealth, isLoading: teamsLoading } = useGetTeamHealthQuery(
    queryParams,
    { skip },
  );
  const { data: topPerformers, isLoading: performersLoading } =
    useGetTopPerformersQuery({ ...queryParams, limit: 5 }, { skip });
  const { data: recentActivity, isLoading: activityLoading } =
    useGetRecentActivityQuery({ ...queryParams, limit: 6 }, { skip });
  const { data: allActivity, isLoading: allActivityLoading } =
    useGetRecentActivityQuery({ ...queryParams, limit: 100 }, { skip: skip || !showAllActivityModal });

  const bestPlayer = topPerformers?.[0];
  const runnersUp = topPerformers?.slice(1, 5) ?? [];

  if (!franchiseId) {
    return (
      <EmptyState
        icon={<Building2 size={28} />}
        title="No branch selected"
        description="Go to Branches and pick one to see its dashboard."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button
            onClick={() => navigate("/franchises")}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-volt-500 dark:hover:text-volt-400 transition-colors mb-2 font-medium"
          >
            <ArrowLeft size={13} />
            All branches
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-extrabold text-slate-900 dark:text-white text-xl sm:text-2xl uppercase tracking-tight">
              {franchiseLoading ? "Loading…" : (franchise?.name ?? "Branch")}
            </h1>
            {franchise && (
              <Badge variant={franchise.isActive ? "green" : "gray"}>
                {franchise.isActive ? "Active" : "Inactive"}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {franchise?.location?.name ? ` · ${franchise.location.name}` : ""}
          </p>
        </div>
      </div>

      {/* KPI Stats Row - 2 cards per row on mobile screens, 4 on desktop */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
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
            sublabel="Overall consistency"
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
            value={stats?.avgRating ? stats.avgRating.toFixed(1) : "—"}
            sublabel="Out of 10.0 scale"
            icon={<Star className="h-5 w-5" />}
            accent="ember"
          />
        </div>
      )}

      {/* Main Content Grid: Left 2 Cols (Trends, Team Health, Activity) | Right 1 Col (Top Performer Hero, Skills Radar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-5">
          {/* 1. Attendance trend chart */}
          <div className="card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="section-title">Attendance Trend</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {attendanceDays === 7 && "Last 7 days daily — branch breakdown"}
                  {attendanceDays === 30 && "Last 30 days daily — branch trend"}
                  {attendanceDays === 365 && "Last 12 months — monthly average"}
                  {attendanceDays === 0 && "Overall historical attendance"}
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
                  <span className="text-3xs text-slate-500 dark:text-slate-400 font-mono block">
                    {activeTrendSummary
                      ? `${activeTrendSummary.present}/${activeTrendSummary.total} present`
                      : "period avg"}
                  </span>
                </div>
              </div>
            </div>
            {trendLoading ? (
              <Skeleton className="h-44 rounded-xl" />
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
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={attendanceTrend}>
                  <defs>
                    <linearGradient
                      id="voltGradFranchise"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#ccff00" stopOpacity={0.15} />
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
                    fill="url(#voltGradFranchise)"
                    dot={{ fill: "#ccff00", strokeWidth: 0, r: 3 }}
                    activeDot={{ fill: "#ccff00", r: 5, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 2. Team Health Container - Improved UI with status indicators & progress bars */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-title">Team Health & Squads</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Squad attendance consistency and performance metrics
                </p>
              </div>
              <Link
                to="/teams"
                className="text-xs text-volt-600 dark:text-volt-400 hover:underline font-semibold flex items-center gap-1"
              >
                <span>All squads</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>

            {teamsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : !teamHealth?.length ? (
              <EmptyState
                title="No teams yet"
                description="Create squads in this branch to monitor health and performance metrics."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {teamHealth.map((team) => {
                  const status = getTeamHealthStatus(team.attendance, team.performance);
                  const perfPercent = Math.min(100, Math.max(0, (team.performance / 10) * 100));
                  return (
                    <div
                      key={team.name}
                      className="p-4 rounded-xl bg-slate-50/90 dark:bg-pitch-900/60 border border-slate-200/90 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {team.name}
                          </h4>
                          <p className="text-3xs sm:text-2xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 truncate">
                            <span>{team.coach ? `Coach: ${team.coach}` : "Coach Unassigned"}</span>
                            <span>·</span>
                            <span>{team.students} {team.students === 1 ? "player" : "players"}</span>
                          </p>
                        </div>
                        <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-3xs font-bold border shrink-0 font-mono", status.badge)}>
                          <span className={clsx("w-1.5 h-1.5 rounded-full", status.dot)} />
                          {status.label}
                        </span>
                      </div>

                      {/* Dual Progress Bars */}
                      <div className="space-y-2 pt-1">
                        {/* Attendance metric */}
                        <div>
                          <div className="flex items-center justify-between text-3xs text-slate-500 dark:text-slate-400 font-mono mb-1">
                            <span>Attendance Consistency</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{team.attendance}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-pitch-700 rounded-full overflow-hidden">
                            <div
                              className={clsx("h-full rounded-full transition-all duration-500", status.barColor)}
                              style={{ width: `${Math.min(100, team.attendance)}%` }}
                            />
                          </div>
                        </div>

                        {/* Performance metric */}
                        <div>
                          <div className="flex items-center justify-between text-3xs text-slate-500 dark:text-slate-400 font-mono mb-1">
                            <span>Performance Rating</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{team.performance} / 10.0</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-pitch-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-sky-500 dark:bg-ice-400 transition-all duration-500"
                              style={{ width: `${perfPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Live Activity Feed */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-title">Live Activity</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Recent attendances, performance assessments, and payment entries
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenAllActivityModal}
                className="text-xs text-volt-600 dark:text-volt-400 hover:underline font-semibold flex items-center gap-1"
              >
                <span>View all history</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            {activityLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 rounded-lg" />
                ))}
              </div>
            ) : !recentActivity?.length ? (
              <EmptyState
                title="No recent activity"
                description="Live activity logs for sessions and payments will appear here."
              />
            ) : (
              <>
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-pitch-800 border border-slate-200 dark:border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {renderActivityIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-snug font-medium">
                          {item.message}
                        </p>
                        <p className="text-3xs text-slate-400 dark:text-slate-500 mt-1 font-mono">
                          {formatDistanceToNowStrict(new Date(item.time), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleOpenAllActivityModal}
                  className="w-full pt-3 text-center text-xs text-volt-600 dark:text-volt-400 hover:underline font-semibold border-t border-slate-100 dark:border-white/5 block"
                >
                  View full franchise activity history →
                </button>
              </>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Top Performer Hero Card + Rankings 2-5, Skill Radar */}
        <div className="lg:col-span-1 space-y-5">
          
          {/* Top Performer Showcase Card */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-title">Top Performers</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Franchise player leaderboard
                </p>
              </div>
              <Link
                to="/students"
                className="text-xs text-volt-600 dark:text-volt-400 hover:underline font-semibold flex items-center gap-1"
              >
                <span>Full roster</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>

            {performersLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-36 rounded-2xl" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-xl" />
                  ))}
                </div>
              </div>
            ) : !topPerformers?.length ? (
              <EmptyState
                title="No ratings yet"
                description="Log performance scores to rank players in this branch."
              />
            ) : (
              <div className="space-y-4">
                {/* #1 Top Performer Hero Card */}
                {bestPlayer && (
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-volt-500/5 to-transparent dark:from-amber-400/10 dark:via-volt-400/5 dark:to-pitch-900 border border-amber-400/30 dark:border-amber-400/20 p-4 sm:p-5 shadow-xs">
                    {/* Decorative glow */}
                    <div className="absolute top-0 right-0 w-28 h-28 bg-amber-400/10 dark:bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                      {/* Photo with golden crown badge */}
                      <div className="relative shrink-0">
                        <Avatar
                          name={bestPlayer.name}
                          src={bestPlayer.avatar}
                          size="xl"
                          className="w-20 h-20 sm:w-22 sm:h-22 text-2xl rounded-2xl ring-4 ring-amber-400/40 dark:ring-amber-400/30 shadow-lg object-cover"
                        />
                        <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-400 dark:bg-amber-500 text-pitch-950 flex items-center justify-center shadow-md border-2 border-white dark:border-pitch-900">
                          <Crown size={14} className="text-pitch-950 fill-pitch-950" />
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-mono">
                            <Trophy size={11} className="text-amber-500" />
                            Top Performer #1
                          </span>
                          <span className="text-3xs text-slate-500 dark:text-slate-400 font-mono">
                            {bestPlayer.position}
                          </span>
                        </div>

                        <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight truncate">
                          {bestPlayer.name}
                        </h3>

                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                          {bestPlayer.team}
                        </p>

                        <div className="pt-1 flex items-center justify-center sm:justify-start gap-2">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/80 dark:bg-pitch-800/80 border border-slate-200 dark:border-white/10 shadow-xs">
                            <Star size={13} className="text-amber-500 fill-amber-500" />
                            <span className="font-display font-extrabold text-slate-900 dark:text-white text-sm">
                              {bestPlayer.rating ? bestPlayer.rating.toFixed(1) : "—"}
                            </span>
                            <span className="text-3xs text-slate-400 font-mono">/ 10.0</span>
                          </div>
                          <Link
                            to={`/students/${bestPlayer.id}`}
                            className="text-xs text-volt-600 dark:text-volt-400 hover:underline font-semibold inline-flex items-center gap-0.5"
                          >
                            <span>Profile</span>
                            <ArrowUpRight size={12} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rankings #2 to #5 */}
                {runnersUp.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-2xs font-mono uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                      Leaderboard Rankings (#2 – #{topPerformers.length})
                    </p>
                    <div className="space-y-1.5">
                      {runnersUp.map((player, idx) => {
                        const rank = idx + 2;
                        return (
                          <Link
                            key={player.id}
                            to={`/students/${player.id}`}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/80 dark:bg-pitch-900/40 hover:bg-slate-100 dark:hover:bg-pitch-800/60 border border-slate-200/80 dark:border-white/5 transition-all group"
                          >
                            <span
                              className={clsx(
                                "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-display font-extrabold shrink-0 border",
                                rank === 2
                                  ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                                  : rank === 3
                                    ? "bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-600/20"
                                    : "bg-slate-100 dark:bg-pitch-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5"
                              )}
                            >
                              {rank}
                            </span>
                            <Avatar name={player.name} src={player.avatar} size="sm" className="rounded-lg" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-volt-500 dark:group-hover:text-volt-400 transition-colors">
                                {player.name}
                              </p>
                              <p className="text-3xs text-slate-500 dark:text-slate-400 truncate">
                                {player.team} · {player.position}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-display font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1">
                                <Star size={11} className="text-amber-500 fill-amber-500" />
                                {player.rating ? player.rating.toFixed(1) : "—"}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Skill Radar */}
          <div className="card p-5 space-y-4">
            <div>
              <p className="section-title">Franchise Avg Skills</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Technical skill parameters aggregate across players
              </p>
            </div>
            {radarLoading ? (
              <Skeleton className="h-44 rounded-xl" />
            ) : !radarData?.length ? (
              <EmptyState
                title="No performance data yet"
                description="Log a session evaluation to populate skill averages."
              />
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(100,116,139,0.2)" />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                  />
                  <Radar
                    dataKey="avg"
                    stroke="#ccff00"
                    fill="#ccff00"
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* View All Live Activity Modal */}
      {showAllActivityModal && (
        <Modal
          isOpen={showAllActivityModal}
          onClose={() => {
            setShowAllActivityModal(false);
            setActivitySearchTerm("");
            setActivityTypeFilter("all");
          }}
          title="Branch Live Activity History"
          size="lg"
        >
          <div className="space-y-4">
            {/* Filter and search bar */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter activities by message or name..."
                  value={activitySearchTerm}
                  onChange={(e) => setActivitySearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-pitch-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-volt-400"
                />
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-pitch-800 p-0.5 rounded-lg border border-slate-200 dark:border-white/5 shrink-0">
                {[
                  { id: "all", label: "All" },
                  { id: "attendance", label: "Attendance" },
                  { id: "performance", label: "Performance" },
                  { id: "fee", label: "Fees" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActivityTypeFilter(f.id)}
                    className={clsx(
                      "px-2.5 py-1 rounded text-2xs font-bold transition-all capitalize",
                      activityTypeFilter === f.id
                        ? "bg-white dark:bg-pitch-700 text-volt-600 dark:text-volt-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Activities List */}
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 custom-scrollbar pr-1">
              {allActivityLoading ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : (() => {
                const activities = allActivity || recentActivity || [];
                const filtered = activities.filter((act) => {
                  const matchesFilter = activityTypeFilter === "all" || act.type === activityTypeFilter;
                  const matchesSearch =
                    !activitySearchTerm ||
                    act.message.toLowerCase().includes(activitySearchTerm.toLowerCase());
                  return matchesFilter && matchesSearch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No activity found
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Try adjusting your search or category filter.
                      </p>
                    </div>
                  );
                }

                return filtered.map((item) => (
                  <div key={item.id} className="flex gap-3 py-3 items-start">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-pitch-800 border border-slate-200 dark:border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {renderActivityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-3xs font-mono uppercase tracking-wider font-bold text-slate-500 capitalize">
                          {item.type}
                        </span>
                        <span className="text-2xs text-slate-400 font-mono">
                          {new Date(item.time).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 mt-0.5 font-medium leading-relaxed">
                        {item.message}
                      </p>
                      <p className="text-3xs text-slate-400 mt-1 font-mono">
                        {formatDistanceToNowStrict(new Date(item.time), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-white/10">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowAllActivityModal(false);
                  setActivitySearchTerm("");
                  setActivityTypeFilter("all");
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default FranchiseDashboardPage;
