import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Compass, ArrowRight, CalendarCheck, Wallet, TrendingUp } from "lucide-react";
import {
  useGetMyAttendanceQuery,
  useGetMyFeesQuery,
  useGetMyPerformanceQuery,
  useGetMyDashboardQuery,
} from "../../store/api/studentPortalApi";
import { NoxPageHeader, NoxSkeleton, NoxEmptyState, NoxStatusBadge, NoxStatCard } from "../../components/portal-ui";

type Tab = "attendance" | "fees" | "performance";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "fees", label: "Fees", icon: Wallet },
  { id: "performance", label: "Performance", icon: TrendingUp },
];

const StudentProgressPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("attendance");
  const { data: dashboard, isLoading: isDashLoading } = useGetMyDashboardQuery();

  if (isDashLoading) {
    return <NoxSkeleton className="h-64" />;
  }

  const isFreeAgent = dashboard && !dashboard.profile?.franchiseId;
  if (isFreeAgent) {
    return (
      <div className="space-y-6">
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
              Attendance tracking, fee plans, and coach evaluation notes become active once you join an academy squad. In the meantime, you can manage your verified public player card and privacy settings from your dashboard.
            </p>
          </div>
          <div className="pt-2">
            <Link to="/student/dashboard" className="nox-btn-primary inline-flex items-center gap-2 text-xs">
              <span>Go to Free Agent Dashboard</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <NoxPageHeader eyebrow="Student portal" title="My progress" />

      <div className="flex gap-2 border-b border-white/[0.06] mb-6">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
                active
                  ? "border-core-400 text-core-400"
                  : "border-transparent text-nox-mid hover:text-nox-high"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "attendance" && <AttendanceTab />}
      {tab === "fees" && <FeesTab />}
      {tab === "performance" && <PerformanceTab />}
    </div>
  );
};

const AttendanceTab: React.FC = () => {
  const { data, isLoading } = useGetMyAttendanceQuery();

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!data || data.records.length === 0) {
    return <NoxEmptyState title="No attendance records yet" body="Sessions will appear here once a coach marks them." />;
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <NoxStatCard label="Present" value={data.summary.present} accent="ion" />
        <NoxStatCard label="Absent" value={data.summary.absent} accent="core" />
        <NoxStatCard label="Late" value={data.summary.late} accent="plasma" />
        <NoxStatCard label="Rate" value={`${data.summary.percentage}%`} accent="ion" />
      </div>
      <div className="nox-card divide-y divide-white/[0.06]">
        {data.records.map((r) => (
          <div key={r._id} className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm text-nox-high">
                {new Date(r.sessionDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              {r.remarks && <div className="text-xs text-nox-low mt-0.5">{r.remarks}</div>}
            </div>
            <NoxStatusBadge status={r.status} />
          </div>
        ))}
      </div>
    </div>
  );
};

const FeesTab: React.FC = () => {
  const { data, isLoading } = useGetMyFeesQuery();

  if (isLoading) return <NoxSkeleton className="h-64" />;
  if (!data || data.length === 0) {
    return <NoxEmptyState title="No fee records yet" body="Fee plans set up by your academy will appear here." />;
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
                <span className="text-nox-mid">
                  Installment {inst.installmentNumber} · due {new Date(inst.dueDate).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-nox-high font-mono">
                    ₹{inst.paidAmount.toLocaleString("en-IN")} / ₹{inst.amount.toLocaleString("en-IN")}
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
        body="Assessments and coach notes will show up here as they're added."
      />
    );
  }

  return (
    <div className="space-y-6">
      {data.performance.length > 0 && (
        <div className="nox-card divide-y divide-white/[0.06]">
          {data.performance.map((p) => (
            <div key={p._id} className="px-5 py-4 flex items-center justify-between">
              <span className="text-sm text-nox-high">{new Date(p.createdAt).toLocaleDateString()}</span>
              {typeof p.overallRating === "number" && (
                <span className="font-orbital text-sm font-semibold text-core-400">
                  {p.overallRating.toFixed(1)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {data.remarks.length > 0 && (
        <div>
          <h3 className="font-orbital text-sm font-medium text-nox-high mb-3">Coach notes</h3>
          <div className="nox-card divide-y divide-white/[0.06]">
            {data.remarks.map((r) => (
              <div key={r._id} className="px-5 py-4">
                <div className="text-xs text-nox-low font-mono">{new Date(r.date).toLocaleDateString()}</div>
                <p className="text-sm text-nox-mid mt-1">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProgressPage;
