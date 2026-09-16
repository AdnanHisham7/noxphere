// src/features/academies/AcademyDashboardPage.tsx
import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart,
  Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import {
  ArrowLeft, Shirt, CheckCircle2, CreditCard, Star,
  School, MapPin,
} from "lucide-react";
import { StatCard, Skeleton, Avatar, EmptyState, Badge, Button } from "../../components/ui";
import { academyApi } from "../../store/api/academyApi";
import {
  useGetDashboardStatsQuery,
  useGetAttendanceTrendQuery,
  useGetSkillRadarQuery,
  useGetTeamHealthQuery,
  useGetTopPerformersQuery,
} from "../../store/api/dashboardApi";

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-pitch-800 border border-white/10 rounded px-3 py-2 text-xs">
      <p className="text-slate-400">{label}</p>
      <p className="text-volt-400 font-bold">{payload[0].value}%</p>
    </div>
  );
};

const formatCurrency = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;

export const AcademyDashboardPage: React.FC = () => {
  const { academyId } = useParams<{ academyId: string }>();
  const navigate = useNavigate();

  const { data: academy, isLoading: academyLoading } = academyApi.useGetAcademyByIdQuery(
    academyId ?? "",
    { skip: !academyId }
  );

  const queryParams = { academyId: academyId ?? undefined };
  const skip = !academyId;

  const { data: stats, isLoading: statsLoading } = useGetDashboardStatsQuery(queryParams, { skip });
  const { data: attendanceTrend, isLoading: trendLoading } = useGetAttendanceTrendQuery(
    { ...queryParams, days: 7 },
    { skip }
  );
  const { data: radarData, isLoading: radarLoading } = useGetSkillRadarQuery(queryParams, { skip });
  const { data: teamHealth, isLoading: teamsLoading } = useGetTeamHealthQuery(queryParams, { skip });
  const { data: topPerformers, isLoading: performersLoading } = useGetTopPerformersQuery(
    { ...queryParams, limit: 5 },
    { skip }
  );

  if (!academyId) {
    return (
      <EmptyState
        icon={<School size={28} />}
        title="No academy selected"
        description="Go to Academies Management and pick one to view its overview."
      />
    );
  }

  const manager = academy?.manager;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate("/academies")}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-volt-400 transition-colors mb-2 group"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Academies
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display font-extrabold text-white text-2xl uppercase tracking-tight">
              {academyLoading ? "Loading…" : (academy?.name ?? "Academy Dashboard")}
            </h1>
            {academy && (
              <Badge variant={academy.isActive ? "green" : "red"}>
                {academy.isActive ? "Active Operations" : "Offline"}
              </Badge>
            )}
            {academy?.academyCode && (
              <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                {academy.academyCode}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            {manager ? (
              <span>Manager: <strong className="text-slate-300">{manager.firstName} {manager.lastName}</strong> ({manager.email})</span>
            ) : (
              <span>No manager assigned</span>
            )}
            {academy?.location?.name && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1"><MapPin size={12} /> {academy.location.name}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate("/academies")}
          >
            All Academies
          </Button>
        </div>
      </div>

      {/* KPI Stats Row */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            sublabel="Across all branches"
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
            value={stats?.avgRating ? stats.avgRating.toFixed(1) : "—"}
            sublabel={`${stats?.totalTeams ?? 0} squads · ${stats?.totalCoaches ?? 0} coaches`}
            icon={<Star className="h-5 w-5" />}
            accent="ember"
          />
        </div>
      )}

      {/* Franchise Branches Performance Breakdown */}
      {stats?.franchisePerformance && stats.franchisePerformance.length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-white text-base uppercase tracking-wide">
                Academy Branches / Franchises
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Performance and enrollment per operational centre</p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {stats.franchisePerformance.length} Active {stats.franchisePerformance.length === 1 ? "Branch" : "Branches"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.franchisePerformance.map((fp) => (
              <div
                key={fp.id}
                className="p-4 rounded-xl bg-pitch-800/80 border border-white/5 hover:border-white/15 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-white text-sm">{fp.name}</h4>
                    <p className="text-2xs font-mono text-slate-500">{fp.code} {fp.location ? `· ${fp.location}` : ""}</p>
                  </div>
                  <Badge variant={fp.isActive ? "green" : "gray"} size="sm">
                    {fp.isActive ? "Active" : "Offline"}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center">
                  <div>
                    <p className="text-2xs text-slate-500 uppercase">Players</p>
                    <p className="text-sm font-bold text-white mt-0.5">{fp.totalPlayers}</p>
                  </div>
                  <div>
                    <p className="text-2xs text-slate-500 uppercase">Squads</p>
                    <p className="text-sm font-bold text-white mt-0.5">{fp.totalTeams}</p>
                  </div>
                  <div>
                    <p className="text-2xs text-slate-500 uppercase">Collected</p>
                    <p className="text-sm font-bold text-volt-400 mt-0.5">{formatCurrency(fp.feesCollected)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance trend + skill radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title">Attendance Trend</p>
              <p className="text-xs text-slate-500 mt-0.5">Last 7 days — academy-wide aggregate</p>
            </div>
            <span className="text-volt-400 font-display font-extrabold text-xl">
              {stats?.avgAttendance ?? 0}%
            </span>
          </div>
          {trendLoading ? (
            <Skeleton className="h-44 rounded" />
          ) : !attendanceTrend?.length || attendanceTrend.every((d) => d.rate === 0) ? (
            <EmptyState title="No attendance recorded yet" description="Records will populate as sessions are conducted." />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={attendanceTrend}>
                <defs>
                  <linearGradient id="voltGradAcademy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ccff00" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ccff00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone" dataKey="rate"
                  stroke="#ccff00" strokeWidth={2}
                  fill="url(#voltGradAcademy)"
                  dot={{ fill: "#ccff00", strokeWidth: 0, r: 3 }}
                  activeDot={{ fill: "#ccff00", r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5 space-y-4">
          <div>
            <p className="section-title">Academy Skill Radar</p>
            <p className="text-xs text-slate-500 mt-0.5">Aggregate performance parameters</p>
          </div>
          {radarLoading ? (
            <Skeleton className="h-44 rounded" />
          ) : !radarData?.length ? (
            <EmptyState title="No performance data yet" description="Skill evaluations will appear here." />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Radar name="Academy Average" dataKey="avg" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Team Health & Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Squad Health */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title">Squad Overview</p>
              <p className="text-xs text-slate-500 mt-0.5">Team rosters and health status</p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {teamHealth?.length ?? 0} Squads
            </span>
          </div>

          {teamsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : !teamHealth?.length ? (
            <EmptyState title="No teams formed yet" description="Academy has not created teams yet." />
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {teamHealth.map((team, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{team.name}</p>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {team.students} players · Coach: {team.coach || "Unassigned"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-mono font-bold text-volt-400">{team.attendance}%</p>
                      <p className="text-[10px] text-slate-500">attendance</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Performers */}
        <div className="card p-5 space-y-4">
          <div>
            <p className="section-title">Top Rated Players</p>
            <p className="text-xs text-slate-500 mt-0.5">Highest rated athletes across the academy</p>
          </div>

          {performersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : !topPerformers?.length ? (
            <EmptyState title="No player evaluations yet" description="Top performers will appear here after coaches submit ratings." />
          ) : (
            <div className="space-y-2.5">
              {topPerformers.map((player) => (
                <div key={player.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={player.name} src={player.avatar} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{player.name}</p>
                      <p className="text-[10px] text-slate-500">{player.position || "Player"} · {player.team || "Squad"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-bold text-volt-400 text-xs shrink-0">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span>{player.rating.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcademyDashboardPage;
