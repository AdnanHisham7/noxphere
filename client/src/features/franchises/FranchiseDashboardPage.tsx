// src/features/franchises/FranchiseDashboardPage.tsx
import React, { useEffect } from "react";
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
  Filter,
} from "lucide-react";
import {
  StatCard,
  Skeleton,
  Avatar,
  EmptyState,
  Badge,
  Modal,
  Button,
  Input,
} from "../../components/ui";
import { setActiveFranchise } from "../../store/slices/uiSlice";
import { useGetFranchiseByIdQuery } from "../../store/api/franchiseApi";
import {
  useGetDashboardStatsQuery,
  useGetAttendanceTrendQuery,
  useGetSkillRadarQuery,
  useGetTeamHealthQuery,
  useGetTopPerformersQuery,
  useGetRecentActivityQuery,
} from "../../store/api/dashboardApi";

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 dark:bg-pitch-800 border border-slate-700 dark:border-white/10 rounded px-3 py-2 text-xs">
      <p className="text-slate-400">{label}</p>
      <p className="text-volt-400 font-bold">{payload[0].value}%</p>
    </div>
  );
};

const renderActivityIcon = (type: string) => {
  switch (type) {
    case "attendance":
      return (
        <CheckCircle2 size={14} className="text-volt-500 dark:text-volt-400" />
      );
    case "performance":
      return (
        <TrendingUp size={14} className="text-sky-500 dark:text-ice-400" />
      );
    case "fee":
      return (
        <CreditCard
          size={14}
          className="text-emerald-500 dark:text-field-400"
        />
      );
    default:
      return <Activity size={14} className="text-slate-400" />;
  }
};

const formatCurrency = (n: number) =>
  n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : `₹${n.toLocaleString("en-IN")}`;

// Franchise-specific dashboard — reached by clicking a franchise card on
// the Franchises tab. The academy-wide /dashboard route no longer offers
// a way to drill into a single franchise, so this page owns that view.
const FranchiseDashboardPage: React.FC = () => {
  const { franchiseId } = useParams<{ franchiseId: string }>();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (franchiseId) dispatch(setActiveFranchise(franchiseId));
  }, [franchiseId, dispatch]);

  const { data: franchise, isLoading: franchiseLoading } =
    useGetFranchiseByIdQuery(franchiseId ?? "", { skip: !franchiseId });

  const queryParams = { franchiseId: franchiseId ?? undefined };
  const skip = !franchiseId;

  const { data: stats, isLoading: statsLoading } = useGetDashboardStatsQuery(
    queryParams,
    { skip },
  );
  const [attendanceDays, setAttendanceDays] = React.useState<number>(7);
  const [showAllActivityModal, setShowAllActivityModal] = React.useState<boolean>(false);
  const [activitySearchTerm, setActivitySearchTerm] = React.useState<string>("");
  const [activityTypeFilter, setActivityTypeFilter] = React.useState<string>("all");

  const { data: attendanceTrend, isLoading: trendLoading } =
    useGetAttendanceTrendQuery({ ...queryParams, days: attendanceDays }, { skip });
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
    useGetRecentActivityQuery({ ...queryParams, limit: 8 }, { skip });
  const { data: allActivity, isLoading: allActivityLoading } =
    useGetRecentActivityQuery({ ...queryParams, limit: 100 }, { skip: skip || !showAllActivityModal });

  if (!franchiseId) {
    return (
      <EmptyState
        icon={<Building2 size={28} />}
        title="No franchise selected"
        description="Go to Franchises and pick one to see its dashboard."
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
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-volt-400 transition-colors mb-2"
          >
            <ArrowLeft size={13} />
            All franchises
          </button>
          <p className="section-title mb-1">Franchise Dashboard</p>
          <h1 className="font-display font-extrabold text-slate-900 dark:text-white text-xl sm:text-2xl uppercase tracking-tight">
            {franchiseLoading ? "Loading…" : (franchise?.name ?? "Franchise")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {franchise && (
            <Badge variant={franchise.isActive ? "green" : "gray"}>
              {franchise.isActive ? "Active" : "Inactive"}
            </Badge>
          )}
        </div>
      </div>

      {/* KPI Stats Row */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
            value={formatCurrency(stats?.feesCollected ?? 0)}
            sublabel={`${formatCurrency(stats?.feesOutstanding ?? 0)} outstanding`}
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

      {/* Attendance trend + skill radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="section-title">Attendance Trend</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {attendanceDays === 7 && "Last 7 days — daily breakdown"}
                {attendanceDays === 30 && "Last 30 days (Month) — daily trend"}
                {attendanceDays === 365 && "Last 12 months (Year) — monthly average"}
                {attendanceDays === 0 && "Overall historical attendance"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-pitch-800 p-0.5 rounded-lg border border-slate-200 dark:border-white/5">
                {[
                  { label: "7D", title: "Last 7 Days", value: 7 },
                  { label: "1M", title: "Last Month", value: 30 },
                  { label: "1Y", title: "Last Year", value: 365 },
                  { label: "All", title: "Overall", value: 0 },
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
              <span className="text-volt-400 font-display font-extrabold text-xl">
                {stats?.avgAttendance ?? 0}%
              </span>
            </div>
          </div>
          {trendLoading ? (
            <Skeleton className="h-40 rounded" />
          ) : !attendanceTrend?.length ||
            attendanceTrend.every((d) => d.rate === 0) ? (
            <EmptyState
              title="No attendance recorded yet"
              description="Mark attendance to see the trend here."
            />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
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

        <div className="card p-5 space-y-4">
          <div>
            <p className="section-title">Franchise Avg Skills</p>
            <p className="text-xs text-slate-500 mt-0.5">
              All players aggregate
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

      {/* Team Health + Top Performers + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="section-title">Team Health</p>
            <Link to="/teams" className="text-xs text-volt-400 hover:underline">
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
                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-pitch-700 border border-slate-200 dark:border-white/5 rounded"
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

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="section-title">Top Performers</p>
            <Link
              to="/students"
              className="text-xs text-volt-500 dark:text-volt-400 hover:underline"
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
                        ? "text-volt-500 dark:text-volt-400"
                        : i === 1
                          ? "text-slate-500 dark:text-slate-300"
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
                  <span className="font-display font-extrabold text-volt-500 dark:text-volt-400 text-sm">
                    {player.rating}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="section-title">Live Activity</p>
            <button
              type="button"
              onClick={() => setShowAllActivityModal(true)}
              className="text-xs text-volt-600 dark:text-volt-400 hover:underline font-semibold flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowUpRight size={13} />
            </button>
          </div>
          {activityLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))}
            </div>
          ) : !recentActivity?.length ? (
            <EmptyState
              title="No recent activity"
              description="Actions across the franchise will show up here."
            />
          ) : (
            <>
              <div className="space-y-0">
                {recentActivity.map((item, i) => (
                  <div
                    key={item.id}
                    className={clsx(
                      "flex gap-3 py-3",
                      i < recentActivity.length - 1 &&
                        "border-b border-slate-100 dark:border-white/4",
                    )}
                  >
                    <div className="w-7 h-7 rounded bg-slate-100 dark:bg-pitch-700 flex items-center justify-center flex-shrink-0">
                      {renderActivityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-tight">
                        {item.message}
                      </p>
                      <p className="text-2xs text-slate-500 dark:text-slate-600 mt-1">
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
                onClick={() => setShowAllActivityModal(true)}
                className="w-full pt-2 text-center text-xs text-volt-600 dark:text-volt-400 hover:underline font-semibold border-t border-slate-100 dark:border-white/5 block"
              >
                View all franchise activity →
              </button>
            </>
          )}
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
          title="Franchise Live Activity History"
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
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-pitch-800 border border-slate-200 dark:border-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
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

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-white/5">
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
