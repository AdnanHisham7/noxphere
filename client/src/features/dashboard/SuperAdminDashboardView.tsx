import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { clsx } from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import {
  School,
  Building2,
  Shirt,
  Wallet,
  Radio,
  Sliders,
  HelpCircle,
  Globe,
  Layers,
  ShieldAlert,
  ArrowUpRight,
} from "lucide-react";
import {
  StatCard,
  Skeleton,
  EmptyState,
  Button,
} from "../../components/ui";
import {
  useGetSuperAdminAnalyticsQuery,
  SuperAdminActivityEvent,
} from "../../store/api/dashboardApi";

const STATUS_COLORS: Record<string, string> = {
  active: "#00e676",
  trial: "#ccff00",
  expired: "#ff6b35",
  cancelled: "#94a3b8",
  pending: "#00b4d8",
};

const CURRENCY_COLORS = [
  "#ccff00", // volt
  "#00b4d8", // ice
  "#00e676", // field
  "#a855f7", // purple
  "#f59e0b", // amber
  "#ec4899", // pink
];

const RevenueTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-pitch-800/95 border border-white/10 rounded-lg p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="text-slate-300 font-semibold mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-400 capitalize">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}:
            </span>
            <span className="font-mono font-bold text-slate-100">
              ₹{entry.value.toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SuperAdminDashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetSuperAdminAnalyticsQuery();
  const [revenueMetric, setRevenueMetric] = useState<"stacked" | "total">("stacked");

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<ShieldAlert size={32} className="text-ember-400" />}
        title="Failed to load platform analytics"
        description="Could not aggregate metrics across tenant academies. Please verify your connection."
      />
    );
  }

  const {
    kpi,
    monthlyRevenue,
    statusDistribution,
    currencyDistribution,
    topAcademies,
    activityFeed,
  } = data;

  const totalAc = kpi.totalAcademies || 1;
  const trialPercent = Math.round((kpi.trialingAcademies / totalAc) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Platform Executive Headline Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pitch-900 via-pitch-850 to-pitch-900 border border-white/10 p-5 sm:p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-volt-400/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-volt-400/10 text-volt-400 border border-volt-400/20">
                Super Admin Master View
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Globe size={12} className="text-ice-400" /> Multi-tenant Network
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
              Platform Command Center
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              High-level telemetry across {kpi.totalAcademies} registered academies, {kpi.totalFranchises} operating branches, and {kpi.totalStudents} enrolled athletes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/platform-settings")}
              className="gap-1.5 border-white/10 hover:border-volt-400/40 text-xs"
            >
              <Sliders size={14} className="text-volt-400" />
              Platform Engine
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/academies")}
              className="gap-1.5 border-white/10 hover:border-ice-400/40 text-xs"
            >
              <School size={14} className="text-ice-400" />
              Manage Academies
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/admin/support")}
              className="gap-1.5 border-white/10 hover:border-amber-400/40 text-xs"
            >
              <HelpCircle size={14} className="text-amber-400" />
              Support ({kpi.openTicketsCount})
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          label="Platform Revenue"
          value={`₹${kpi.totalPlatformRevenue.toLocaleString("en-IN")}`}
          sublabel={`Sub: ₹${kpi.subscriptionRevenue.toLocaleString("en-IN")} · NFC: ₹${kpi.nfcRevenue.toLocaleString("en-IN")}`}
          icon={<Wallet className="h-5 w-5" />}
          accent="volt"
        />

        <StatCard
          label="Active Academies"
          value={`${kpi.activeAcademies} / ${kpi.totalAcademies}`}
          sublabel={`${kpi.trialingAcademies} on trial (${trialPercent}%)`}
          icon={<School className="h-5 w-5" />}
          accent="field"
        />

        <StatCard
          label="Enrolled Players"
          value={kpi.totalStudents.toLocaleString("en-IN")}
          sublabel={`${kpi.overallCapacityUtilization}% of ${kpi.totalCapacity} capacity`}
          icon={<Shirt className="h-5 w-5" />}
          accent="ice"
        />

        <StatCard
          label="Training Branches"
          value={kpi.totalFranchises}
          sublabel={`${kpi.totalTeams} teams · ${kpi.totalCoaches} coaches`}
          icon={<Building2 className="h-5 w-5" />}
          accent="ember"
        />

        <StatCard
          label="Open Tickets"
          value={kpi.openTicketsCount}
          sublabel={kpi.openTicketsCount > 0 ? "Requires review" : "All issues resolved"}
          icon={<HelpCircle className="h-5 w-5" />}
          accent={kpi.openTicketsCount > 0 ? "ember" : "field"}
        />
      </div>

      {/* Capacity Utilization Progress Banner */}
      <div className="card p-4 bg-pitch-900 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-volt-400/10 border border-volt-400/20 flex items-center justify-center shrink-0">
            <Layers size={20} className="text-volt-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Platform Capacity Utilization
              </span>
              <span className="text-2xs font-mono font-bold text-volt-400 bg-volt-400/10 px-2 py-0.5 rounded">
                {kpi.overallCapacityUtilization}% saturated
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {kpi.totalStudents} active student slots utilized out of {kpi.totalCapacity} provisioned slots across academies.
            </p>
          </div>
        </div>
        <div className="w-full sm:w-64">
          <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-volt-400 to-field-400 transition-all duration-500"
              style={{ width: `${Math.min(kpi.overallCapacityUtilization, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>0 slots</span>
            <span>{kpi.totalCapacity} slots</span>
          </div>
        </div>
      </div>

      {/* Charts Grid 1: Revenue Trends & Academy Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Platform Revenue Trend */}
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="section-title">Platform Revenue Trend</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Past 6 months SaaS recurring subscriptions vs NFC smart card purchases
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-pitch-800 p-0.5 rounded-lg border border-slate-200 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setRevenueMetric("stacked")}
                  className={clsx(
                    "px-2.5 py-1 rounded text-2xs font-bold transition-all",
                    revenueMetric === "stacked"
                      ? "bg-white dark:bg-pitch-700 text-volt-400 shadow-xs"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Breakdown
                </button>
                <button
                  type="button"
                  onClick={() => setRevenueMetric("total")}
                  className={clsx(
                    "px-2.5 py-1 rounded text-2xs font-bold transition-all",
                    revenueMetric === "total"
                      ? "bg-white dark:bg-pitch-700 text-volt-400 shadow-xs"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Gross Inflow
                </button>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip content={<RevenueTooltip />} />
                {revenueMetric === "stacked" ? (
                  <>
                    <Bar
                      dataKey="subscriptions"
                      name="Subscriptions"
                      fill="#ccff00"
                      stackId="rev"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="nfc"
                      name="NFC Card Orders"
                      fill="#00b4d8"
                      stackId="rev"
                      radius={[4, 4, 0, 0]}
                    />
                  </>
                ) : (
                  <Bar
                    dataKey="total"
                    name="Gross Revenue"
                    fill="#ccff00"
                    radius={[4, 4, 0, 0]}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/5 text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-volt-400" />
                SaaS Subscriptions
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-ice-400" />
                NFC Smart Passes
              </span>
            </div>
            <span className="text-2xs font-mono text-slate-500">
              Currency normalized to INR equivalent
            </span>
          </div>
        </div>

        {/* Academy Status Distribution Donut */}
        <div className="card p-5 space-y-4 flex flex-col justify-between">
          <div>
            <p className="section-title">Tenant Status Spread</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Active vs Trial vs Expired academy instances
            </p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            {statusDistribution.length === 0 ? (
              <EmptyState title="No tenant status" description="Data will appear once academies onboard." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {statusDistribution.map((entry) => (
                      <Cell
                        key={`cell-${entry.status}`}
                        fill={STATUS_COLORS[entry.status.toLowerCase()] || "#64748b"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const entry = payload[0];
                      return (
                        <div className="bg-pitch-800 border border-white/10 rounded-md px-2.5 py-1.5 text-xs shadow-lg">
                          <span className="capitalize font-semibold text-white">
                            {entry.name}: {entry.value} academies
                          </span>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-white/5">
            {statusDistribution.map((item) => {
              const pct = Math.round((item.count / totalAc) * 100);
              return (
                <div key={item.status} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 capitalize text-slate-300">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: STATUS_COLORS[item.status.toLowerCase()] || "#64748b",
                      }}
                    />
                    {item.status}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400">{item.count}</span>
                    <span className="text-2xs text-slate-500 font-mono">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Grid 2: Multi-Currency Footprint & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Multi-Currency Footprint */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title">Currency Footprint</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Regional billing currencies in active use
              </p>
            </div>
            <Link
              to="/platform-settings"
              className="text-xs text-volt-400 hover:underline flex items-center gap-1"
            >
              Configure <ArrowUpRight size={12} />
            </Link>
          </div>

          <div className="space-y-3 pt-2">
            {currencyDistribution.map((item, idx) => {
              const color = CURRENCY_COLORS[idx % CURRENCY_COLORS.length];
              const pct = Math.round((item.count / totalAc) * 100);
              return (
                <div key={item.currency} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white font-mono flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      {item.currency}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {item.count} {item.count === 1 ? "academy" : "academies"} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-pitch-800/60 rounded-xl border border-white/5 text-2xs text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-200">Currency Engine Tip:</span> You can configure default trial days, monthly license rates, and exchange rates per currency in{" "}
            <Link to="/platform-settings" className="text-volt-400 hover:underline">
              Platform Engine
            </Link>.
          </div>
        </div>

        {/* Top Academies Leaderboard */}
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title">Top Academies by Student Capacity</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Highest player registrations and branch capacity satiation
              </p>
            </div>
            <Link
              to="/academies"
              className="text-xs text-volt-400 hover:underline flex items-center gap-1"
            >
              All Academies ({kpi.totalAcademies}) <ArrowUpRight size={12} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-2xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5">Academy</th>
                  <th className="py-2.5 text-center">Currency</th>
                  <th className="py-2.5 text-center">Branches</th>
                  <th className="py-2.5 text-center">Athletes / Capacity</th>
                  <th className="py-2.5 text-center">Status</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {topAcademies.slice(0, 6).map((academy) => (
                  <tr key={academy.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-2">
                      <p className="font-semibold text-white truncate max-w-[180px] sm:max-w-xs">
                        {academy.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        ID: {academy.id.slice(-8)}
                      </p>
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-slate-300">
                      {academy.currency}
                    </td>
                    <td className="py-3 text-center text-slate-300 font-mono">
                      {academy.totalFranchises}
                    </td>
                    <td className="py-3 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className="font-mono text-slate-200">
                          {academy.activeStudents} / {academy.capacity}
                        </span>
                        <div className="w-20 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={clsx(
                              "h-full rounded-full",
                              academy.utilizationPercentage > 85
                                ? "bg-ember-400"
                                : academy.utilizationPercentage > 50
                                ? "bg-volt-400"
                                : "bg-field-400"
                            )}
                            style={{ width: `${Math.min(academy.utilizationPercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          academy.isTrial
                            ? "bg-volt-400/10 text-volt-400 border border-volt-400/20"
                            : academy.status === "active"
                            ? "bg-field-400/10 text-field-400 border border-field-400/20"
                            : "bg-slate-800 text-slate-400"
                        )}
                      >
                        {academy.isTrial ? "Trial" : academy.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/academies/${academy.id}/dashboard`)}
                        className="text-[11px] h-7 px-2.5 gap-1 border-white/10 hover:border-volt-400/30"
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Activity & Operational Control Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Platform Activity Stream */}
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-volt-400 animate-pulse" />
              <p className="section-title">Platform Activity Stream</p>
            </div>
            <span className="text-2xs font-mono text-slate-500">
              Live updates across academies
            </span>
          </div>

          <div className="space-y-0 divide-y divide-white/5">
            {activityFeed.length === 0 ? (
              <EmptyState title="No recent activity" description="Platform events will appear here in real time." />
            ) : (
              activityFeed.map((act: SuperAdminActivityEvent) => (
                <div key={act.id} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                  <div
                    className={clsx(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      act.type === "academy"
                        ? "bg-volt-400/10 text-volt-400 border border-volt-400/20"
                        : act.type === "nfc"
                        ? "bg-ice-400/10 text-ice-400 border border-ice-400/20"
                        : "bg-ember-400/10 text-ember-400 border border-ember-400/20"
                    )}
                  >
                    {act.type === "academy" && <School size={16} />}
                    {act.type === "nfc" && <Radio size={16} />}
                    {act.type === "ticket" && <HelpCircle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-white truncate">
                        {act.title}
                      </p>
                      <span className="text-[11px] text-slate-500 shrink-0 font-mono">
                        {formatDistanceToNowStrict(new Date(act.time), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{act.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Super Admin Quick Commands */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <p className="section-title">Super Admin Shortcuts</p>
            <div className="space-y-2.5">
              {[
                {
                  label: "Platform Engine & Licensing",
                  desc: "Multi-currency, trials & transfer rules",
                  icon: Sliders,
                  to: "/platform-settings",
                  accent: "text-volt-400 border-volt-400/25 bg-volt-400/10",
                },
                {
                  label: "Academy Directory & Onboarding",
                  desc: "Provision & manage tenant academies",
                  icon: School,
                  to: "/academies",
                  accent: "text-ice-400 border-ice-400/25 bg-ice-400/10",
                },
                {
                  label: "NFC Smart Cards Management",
                  desc: "Card stock, global batch orders & shipments",
                  icon: Radio,
                  to: "/nfc-cards",
                  accent: "text-field-400 border-field-400/25 bg-field-400/10",
                },
                {
                  label: "Platform Support & Escalations",
                  desc: "Resolve tenant grievances & tickets",
                  icon: HelpCircle,
                  to: "/admin/support",
                  accent: "text-amber-400 border-amber-400/25 bg-amber-400/10",
                },
              ].map((item) => {
                const IconComp = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="p-3 rounded-xl bg-pitch-800/80 border border-white/5 hover:border-white/15 hover:bg-pitch-800 flex items-center gap-3 transition-all group"
                  >
                    <div
                      className={clsx(
                        "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                        item.accent
                      )}
                    >
                      <IconComp size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-white block truncate group-hover:text-volt-400 transition-colors">
                        {item.label}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate block">
                        {item.desc}
                      </span>
                    </div>
                    <ArrowUpRight size={14} className="text-slate-500 group-hover:text-white transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboardView;
