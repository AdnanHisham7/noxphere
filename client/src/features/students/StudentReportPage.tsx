// src/features/students/StudentReportPage.tsx
import React, { useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Printer,
  ArrowLeft,
  Calendar,
  Clock,
  BarChart3,
  TrendingUp,
  Award,
  CheckCircle2,
  FileText,
  Star,
  Shield,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Button, Skeleton } from "../../components/ui";
import { useGetStudentReportQuery } from "../../store/api/studentsApi";

type ReportPeriod = "daily" | "monthly" | "yearly" | "all";

const PERIOD_CONFIG: Record<
  ReportPeriod,
  { label: string; badge: string; subtitle: string; days: number }
> = {
  daily: {
    label: "Daily Session",
    badge: "Daily Session Evaluation",
    subtitle: "Most recent operational training session and immediate coach evaluations",
    days: 1,
  },
  monthly: {
    label: "Monthly Progress",
    badge: "Monthly Developmental Progress",
    subtitle: "30-day performance trends, attendance consistency, and developmental milestones",
    days: 30,
  },
  yearly: {
    label: "Annual Season",
    badge: "Annual Season Evaluation",
    subtitle: "Complete 12-month season trajectory, skill growth, and annual fee status",
    days: 365,
  },
  all: {
    label: "All-Time Dossier",
    badge: "Comprehensive Career Dossier",
    subtitle: "Full historical athletic profile, cumulative attendance, and all milestone logs",
    days: 0,
  },
};

const StudentReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activePeriod = (searchParams.get("period") as ReportPeriod) || "monthly";
  const { data: rawReport, isLoading, isError } = useGetStudentReportQuery(id ?? "", { skip: !id });

  useEffect(() => {
    if (rawReport) {
      document.title = `${rawReport.student.firstName} ${rawReport.student.lastName} — ${PERIOD_CONFIG[activePeriod].label} Report`;
    }
  }, [rawReport, activePeriod]);

  // Intentional filtering based on selected timeframe
  const filteredData = useMemo(() => {
    if (!rawReport) return null;

    const { performances = [], attendance = [], remarks = [], fees = [], student, summary } = rawReport;
    const now = new Date().getTime();
    const days = PERIOD_CONFIG[activePeriod].days;

    let periodAttendance = attendance;
    let periodPerformances = performances;
    let periodRemarks = remarks;
    let periodFees = fees;

    if (activePeriod === "daily") {
      // Find the most recent date with attendance or performance
      const dates = [
        ...attendance.map((a: any) => new Date(a.sessionDate).getTime()),
        ...performances.map((p: any) => new Date(p.sessionDate).getTime()),
      ].filter((t) => !isNaN(t));

      const latestTimestamp = dates.length > 0 ? Math.max(...dates) : now;
      const latestDateStr = new Date(latestTimestamp).toISOString().split("T")[0];

      periodAttendance = attendance.filter((a: any) => {
        const d = new Date(a.sessionDate).toISOString().split("T")[0];
        return d === latestDateStr;
      });

      periodPerformances = performances.filter((p: any) => {
        const d = new Date(p.sessionDate).toISOString().split("T")[0];
        return d === latestDateStr;
      });

      periodRemarks = remarks.filter((r: any) => {
        const d = new Date(r.date).toISOString().split("T")[0];
        return d === latestDateStr;
      });
    } else if (days > 0) {
      const cutoffTime = now - days * 24 * 60 * 60 * 1000;

      periodAttendance = attendance.filter(
        (a: any) => new Date(a.sessionDate).getTime() >= cutoffTime
      );

      periodPerformances = performances.filter(
        (p: any) => new Date(p.sessionDate).getTime() >= cutoffTime
      );

      periodRemarks = remarks.filter(
        (r: any) => new Date(r.date).getTime() >= cutoffTime
      );

      periodFees = fees.filter((f: any) => {
        const created = new Date(f.createdAt).getTime();
        return created >= cutoffTime;
      });
    }

    // Recalculate metrics
    const totalSessions = periodAttendance.length;
    const presentCount = periodAttendance.filter(
      (a: any) => a.status === "present" || a.status === "late"
    ).length;
    const lateCount = periodAttendance.filter((a: any) => a.status === "late").length;
    const absentCount = periodAttendance.filter((a: any) => a.status === "absent").length;
    const excusedCount = periodAttendance.filter((a: any) => a.status === "excused").length;

    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

    const scores = periodPerformances.map((p: any) => p.overallScore).filter((s: number) => typeof s === "number");
    const avgScore = scores.length > 0 ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : "—";

    // Build timeline chart data (chronological ascending)
    const timelineData = [...periodPerformances]
      .sort((a: any, b: any) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime())
      .map((p: any) => ({
        date: new Date(p.sessionDate).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        score: Number(p.overallScore.toFixed(1)),
      }));

    // Build skills breakdown
    const skillScoresMap: Record<string, { total: number; count: number }> = {};
    periodPerformances.forEach((p: any) => {
      if (Array.isArray(p.skillScores)) {
        p.skillScores.forEach((s: any) => {
          if (!skillScoresMap[s.parameter]) {
            skillScoresMap[s.parameter] = { total: 0, count: 0 };
          }
          skillScoresMap[s.parameter].total += s.score;
          skillScoresMap[s.parameter].count += 1;
        });
      }
    });

    const skillsBreakdown = Object.entries(skillScoresMap)
      .map(([skill, val]) => ({
        skill,
        score: Number((val.total / val.count).toFixed(1)),
      }))
      .sort((a, b) => b.score - a.score);

    // Attendance breakdown for chart
    const attendanceBreakdown = [
      { name: "Present", count: presentCount - lateCount, color: "#10b981" },
      { name: "Late", count: lateCount, color: "#f59e0b" },
      { name: "Absent", count: absentCount, color: "#ef4444" },
      { name: "Excused", count: excusedCount, color: "#06b6d4" },
    ];

    // Fees calculation
    const periodBilled = periodFees.reduce((acc: number, f: any) => acc + (f.finalAmount || 0), 0);
    const periodPaid = periodFees.reduce((acc: number, f: any) => {
      const installments = f.installments || [];
      return acc + installments.reduce((is: number, i: any) => is + (i.paidAmount || 0), 0);
    }, 0);

    return {
      student,
      summary,
      totalSessions,
      attendanceRate,
      presentCount,
      lateCount,
      absentCount,
      excusedCount,
      avgScore,
      timelineData,
      skillsBreakdown,
      attendanceBreakdown,
      periodAttendance,
      periodPerformances,
      periodRemarks,
      periodFees,
      periodBilled: periodFees.length > 0 ? periodBilled : summary.totalBilled,
      periodPaid: periodFees.length > 0 ? periodPaid : summary.totalPaid,
    };
  }, [rawReport, activePeriod]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (isError || !filteredData) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <p className="text-slate-900 font-semibold">Couldn't load this report</p>
        <p className="text-slate-500 text-sm mt-1">You may not have access, or this player doesn't exist.</p>
        <Button size="sm" className="mt-4" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  const {
    student,
    summary,
    totalSessions,
    attendanceRate,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    avgScore,
    timelineData,
    skillsBreakdown,
    attendanceBreakdown,
    periodAttendance,
    periodPerformances,
    periodRemarks,
    periodFees,
    periodBilled,
    periodPaid,
  } = filteredData;

  const currentCfg = PERIOD_CONFIG[activePeriod];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .report-section { break-inside: avoid; page-break-inside: avoid; }
          .report-card { border: 1px solid #e2e8f0 !important; box-shadow: none !important; background: white !important; }
        }
      `}</style>

      {/* Top action bar (hidden on print) */}
      <div className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} /> Back
          </button>
          <div className="h-4 w-px bg-slate-200" />
          {/* Timeframe pill tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(Object.keys(PERIOD_CONFIG) as ReportPeriod[]).map((pKey) => {
              const isSelected = activePeriod === pKey;
              return (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => setSearchParams({ period: pKey })}
                  className={`px-2.5 py-1 rounded text-2xs font-semibold transition-all ${
                    isSelected
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {PERIOD_CONFIG[pKey].label}
                </button>
              );
            })}
          </div>
        </div>

        <Button size="sm" icon={<Printer size={15} />} onClick={() => window.print()}>
          Print / Export PDF
        </Button>
      </div>

      {/* Main Report Container */}
      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Header: Athlete Branding & Report Badge */}
        <div className="report-card report-section bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
              {student.photo ? (
                <img src={student.photo} alt={student.firstName} className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-xl text-slate-400">
                  {student.firstName[0]}
                  {student.lastName[0]}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {student.firstName} {student.lastName}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-bold bg-volt-400 text-pitch-950 uppercase">
                  #{student.jerseyNumber ?? "—"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                {student.position ?? "Athlete"} · Age Group: {student.ageGroup} · DOB:{" "}
                {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString("en-IN") : "—"}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-3xs font-mono font-semibold">
                  {currentCfg.badge}
                </span>
              </div>
            </div>
          </div>

          <div className="sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100 flex flex-col justify-center">
            <span className="text-3xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
              Official Assessment Dossier
            </span>
            <span className="text-xs font-semibold text-slate-700 mt-0.5">
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <span className="text-3xs text-slate-400 mt-1 font-mono">
              Noxphere Athletic Intelligence
            </span>
          </div>
        </div>

        {/* 4 Core Metric KPI Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 report-section">
          <div className="report-card bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-2xs font-mono font-semibold uppercase tracking-wider">Attendance</span>
              <CheckCircle2 size={15} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2 font-display">{attendanceRate}%</p>
            <p className="text-3xs text-slate-500 mt-0.5 font-medium">
              {presentCount} of {totalSessions} sessions attended
            </p>
          </div>

          <div className="report-card bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-2xs font-mono font-semibold uppercase tracking-wider">Avg Rating</span>
              <Star size={15} className="text-amber-500 fill-amber-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2 font-display">{avgScore}/10</p>
            <p className="text-3xs text-slate-500 mt-0.5 font-medium">
              {periodPerformances.length} technical evaluations
            </p>
          </div>

          <div className="report-card bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-2xs font-mono font-semibold uppercase tracking-wider">Total Paid</span>
              <Award size={15} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2 font-display">
              ₹{periodPaid.toLocaleString("en-IN")}
            </p>
            <p className="text-3xs text-slate-500 mt-0.5 font-medium">Verified fee receipts</p>
          </div>

          <div className="report-card bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-2xs font-mono font-semibold uppercase tracking-wider">Outstanding</span>
              <Shield size={15} className="text-slate-400" />
            </div>
            <p
              className={`text-2xl font-black mt-2 font-display ${
                summary.totalOutstanding > 0 ? "text-rose-600" : "text-slate-900"
              }`}
            >
              ₹{(summary.totalOutstanding || 0).toLocaleString("en-IN")}
            </p>
            <p className="text-3xs text-slate-500 mt-0.5 font-medium">Current fee ledger balance</p>
          </div>
        </div>

        {/* Analytics Graphs Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 report-section">
          {/* Graph 1: Performance Rating Evolution */}
          <div className="report-card bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp size={15} className="text-volt-600" /> Performance Evolution
                </h3>
                <p className="text-3xs text-slate-500 mt-0.5 font-mono">
                  Overall match & training session ratings
                </p>
              </div>
              <span className="text-3xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                Scale 1–10
              </span>
            </div>

            {timelineData.length > 1 ? (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="reportRatingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
                    <YAxis domain={[0, 10]} ticks={[2, 4, 6, 8, 10]} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2 rounded-lg text-2xs shadow-lg font-mono">
                            <p className="font-bold">{d.date}</p>
                            <p className="text-volt-400 mt-0.5">Rating: {d.score}/10</p>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#reportRatingGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : timelineData.length === 1 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 rounded-lg">
                <Star size={24} className="text-amber-500 fill-amber-500 mb-1" />
                <p className="text-xl font-black text-slate-900">{timelineData[0].score}/10</p>
                <p className="text-xs text-slate-500 mt-0.5">Recorded on {timelineData[0].date}</p>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400 italic bg-slate-50/50 rounded-lg">
                No session ratings in this timeframe.
              </div>
            )}
          </div>

          {/* Graph 2: Technical Skill Attribute Breakdown */}
          <div className="report-card bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <BarChart3 size={15} className="text-cyan-600" /> Technical Skill Ratings
                </h3>
                <p className="text-3xs text-slate-500 mt-0.5 font-mono">
                  Drill parameters evaluated by coaches
                </p>
              </div>
              <span className="text-3xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                Avg Rating
              </span>
            </div>

            {skillsBreakdown.length > 0 ? (
              <div className="space-y-2 h-44 overflow-y-auto pr-1">
                {skillsBreakdown.slice(0, 6).map((sk) => (
                  <div key={sk.skill} className="space-y-1">
                    <div className="flex items-center justify-between text-2xs">
                      <span className="font-semibold text-slate-700 truncate">{sk.skill}</span>
                      <span className="font-mono font-bold text-slate-900">{sk.score}/10</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${(sk.score / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400 italic bg-slate-50/50 rounded-lg">
                No skill attributes recorded for this period.
              </div>
            )}
          </div>
        </div>

        {/* Detailed Performance History Log */}
        <section className="report-card report-section bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Performance Evaluation Log
              </h2>
              <p className="text-3xs text-slate-500 mt-0.5 font-mono">
                Historical session assessments and drill scores
              </p>
            </div>
            <span className="text-2xs font-mono font-semibold text-slate-500">
              {periodPerformances.length} records
            </span>
          </div>

          {periodPerformances.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center italic">
              No performance records available for this period.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="w-full min-w-[500px] text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-3xs font-mono uppercase text-slate-400 font-semibold tracking-wider">
                    <th className="py-2.5 px-2">Date</th>
                    <th className="py-2.5 px-2">Overall Score</th>
                    <th className="py-2.5 px-2">Attributes Tested</th>
                    <th className="py-2.5 px-2">Session Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {periodPerformances.slice(0, 20).map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-2 font-mono whitespace-nowrap text-slate-700">
                        {new Date(p.sessionDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-2xs">
                          {p.overallScore.toFixed(1)} / 10
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-3xs text-slate-600 font-mono">
                        {Array.isArray(p.skillScores) && p.skillScores.length > 0
                          ? p.skillScores.map((s: any) => `${s.parameter}: ${s.score}`).join(" · ")
                          : "General assessment"}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 italic">
                        {p.remarks || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Detailed Attendance Log */}
        <section className="report-card report-section bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Attendance Log
              </h2>
              <p className="text-3xs text-slate-500 mt-0.5 font-mono">
                Session presence & operational status
              </p>
            </div>
            <div className="flex items-center gap-3 text-3xs font-mono font-semibold">
              <span className="text-emerald-600">Present: {presentCount}</span>
              <span className="text-amber-600">Late: {lateCount}</span>
              <span className="text-rose-600">Absent: {absentCount}</span>
              <span className="text-cyan-600">Excused: {excusedCount}</span>
            </div>
          </div>

          {periodAttendance.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center italic">
              No attendance records found for this period.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="w-full min-w-[320px] text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-3xs font-mono uppercase text-slate-400 font-semibold tracking-wider">
                    <th className="py-2 px-2">Date</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Verification Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {periodAttendance.slice(0, 30).map((a: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-2 font-mono whitespace-nowrap text-slate-700">
                        {new Date(a.sessionDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2 px-2 capitalize whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-3xs font-mono font-bold uppercase ${
                            a.status === "present"
                              ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                              : a.status === "late"
                              ? "bg-amber-400/10 text-amber-700 border border-amber-400/20"
                              : a.status === "absent"
                              ? "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                              : "bg-cyan-500/10 text-cyan-700 border border-cyan-500/20"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-500 text-3xs italic">
                        {a.remarks || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Coach Developmental Remarks */}
        {periodRemarks.length > 0 && (
          <section className="report-card report-section bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3 border-b border-slate-100 pb-2">
              Coach Developmental Remarks
            </h2>
            <div className="space-y-2.5">
              {periodRemarks.slice(0, 15).map((r: any) => (
                <div key={r._id} className="text-xs border-l-2 border-volt-400 bg-slate-50/60 p-3 rounded-r-lg">
                  <p className="text-slate-800 font-medium leading-relaxed">"{r.text}"</p>
                  <p className="text-3xs text-slate-400 mt-1 font-mono">
                    {new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    {r.coachId ? ` · Coach ${r.coachId.firstName} ${r.coachId.lastName}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Financial & Fee Status */}
        <section className="report-card report-section bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Fee Records & Installments
            </h2>
            <span className="text-xs font-mono font-bold text-slate-700">
              Total Billed: ₹{periodBilled.toLocaleString("en-IN")}
            </span>
          </div>

          {periodFees.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center italic">
              No fee records logged for this period.
            </p>
          ) : (
            <div className="space-y-3">
              {periodFees.map((fee: any) => (
                <div key={fee._id} className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/40">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold capitalize text-slate-800">
                      {fee.feeType?.replace("_", " ") || "Academy Fee"}
                    </p>
                    <span
                      className={`text-3xs font-mono font-bold uppercase px-2 py-0.5 rounded ${
                        fee.overallStatus === "paid"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "bg-amber-400/10 text-amber-700"
                      }`}
                    >
                      {fee.overallStatus}
                    </span>
                  </div>
                  {fee.installments?.map((inst: any) => (
                    <div
                      key={inst.installmentNumber}
                      className="flex justify-between text-2xs text-slate-600 py-1 border-t border-slate-100"
                    >
                      <span>
                        Installment {inst.installmentNumber} · Due:{" "}
                        {new Date(inst.dueDate).toLocaleDateString("en-IN")}
                      </span>
                      <span className="font-mono font-medium">
                        ₹{(inst.paidAmount || 0).toLocaleString("en-IN")} / ₹
                        {(inst.amount || 0).toLocaleString("en-IN")} (
                        <span className="capitalize">{inst.status}</span>)
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer Official Certification */}
        <div className="report-card report-section border border-slate-200 rounded-xl p-4 text-center text-3xs text-slate-400 font-mono space-y-1">
          <p>© Noxphere Sports Performance Platform · Certified Academy Operational Record</p>
          <p>
            Generated on {new Date().toISOString()} · Authenticated evaluation token:{" "}
            {student.id.slice(-8).toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudentReportPage;