import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, Save, Zap, Star } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  Button,
  Badge,
  Avatar,
  Skeleton,
  EmptyState,
} from "../../components/ui";
import {
  useGetSessionRosterQuery,
  useMarkSessionAttendanceMutation,
  useLogSessionPerformanceMutation,
  type RosterPlayer,
} from "../../store/api/scheduleApi";

const ATTENDANCE_OPTIONS = [
  {
    value: "present",
    label: "P",
    fullLabel: "Present",
    activeBg: "bg-emerald-500 text-pitch-900 font-bold",
  },
  {
    value: "late",
    label: "L",
    fullLabel: "Late",
    activeBg: "bg-amber-400 text-pitch-900 font-bold",
  },
  {
    value: "absent",
    label: "A",
    fullLabel: "Absent",
    activeBg: "bg-ember-500 text-white font-bold",
  },
  {
    value: "excused",
    label: "E",
    fullLabel: "Excused",
    activeBg: "bg-ice-400 text-pitch-900 font-bold",
  },
] as const;

const SCORE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const getScoreBadgeStyle = (score?: number) => {
  if (score === undefined || score === null) {
    return "bg-slate-50 dark:bg-pitch-900 border-slate-200 dark:border-white/10 text-slate-400";
  }
  if (score >= 9)
    return "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400";
  if (score >= 7)
    return "bg-volt-400/10 border-volt-400/30 text-volt-600 dark:text-volt-400";
  if (score >= 5)
    return "bg-amber-400/10 border-amber-400/30 text-amber-600 dark:text-amber-400";
  return "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400";
};

const getOverallScoreBadgeStyle = (score: number) => {
  if (score >= 8.5)
    return "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400";
  if (score >= 7.0)
    return "bg-volt-400/15 border-volt-400/30 text-volt-600 dark:text-volt-400";
  if (score >= 5.0)
    return "bg-amber-400/15 border-amber-400/30 text-amber-600 dark:text-amber-400";
  return "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400";
};

const SessionRosterPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  // 1. ALL HOOKS MUST BE DECLARED FIRST
  const { data, isLoading, isError } = useGetSessionRosterQuery(
    sessionId ?? "",
    { skip: !sessionId },
  );
  const [markAttendance, { isLoading: savingAttendance }] =
    useMarkSessionAttendanceMutation();
  const [logPerformance, { isLoading: savingPerformance }] =
    useLogSessionPerformanceMutation();

  const [attendancePending, setAttendancePending] = useState<
    Record<string, string>
  >({});
  const [scoresPending, setScoresPending] = useState<
    Record<string, Record<string, number>>
  >({});
  const [remarksPending, setRemarksPending] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    if (!data) return;
    setScoresPending((prev) => {
      const next = { ...prev };
      for (const p of data.roster) {
        if (next[p.studentId]) continue;
        if (p.skillScores && p.skillScores.length > 0) {
          next[p.studentId] = Object.fromEntries(
            p.skillScores.map((s) => [s.parameter, s.score]),
          );
        }
      }
      return next;
    });
  }, [data]);

  // Safe fallback arrays before checks
  const roster = data?.roster ?? [];
  const skillParameters = data?.skillParameters ?? [];

  // attendanceMetrics hook moved BEFORE any early returns
  const attendanceMetrics = useMemo(() => {
    let present = 0,
      late = 0,
      absent = 0,
      excused = 0,
      unmarked = 0;

    roster.forEach((p) => {
      const status = attendancePending[p.studentId] ?? p.attendanceStatus ?? "";
      if (status === "present") present++;
      else if (status === "late") late++;
      else if (status === "absent") absent++;
      else if (status === "excused") excused++;
      else unmarked++;
    });

    return { present, late, absent, excused, unmarked };
  }, [roster, attendancePending]);

  // Helper functions
  const getAttendanceStatus = (p: RosterPlayer) =>
    attendancePending[p.studentId] ?? p.attendanceStatus ?? "";

  const setScore = (studentId: string, parameter: string, value: number) => {
    setScoresPending((prev) => {
      const current =
        prev[studentId] ??
        Object.fromEntries(skillParameters.map((p) => [p, 7]));
      return {
        ...prev,
        [studentId]: {
          ...current,
          [parameter]: value,
        },
      };
    });
  };

  const handleQuickSetPlayerScores = (studentId: string, value: number) => {
    setScoresPending((prev) => ({
      ...prev,
      [studentId]: Object.fromEntries(skillParameters.map((p) => [p, value])),
    }));
  };

  const handleBulkSetAllScores = (value: number) => {
    setScoresPending((prev) => {
      const next = { ...prev };
      roster.forEach((p) => {
        const status = getAttendanceStatus(p);
        if (status === "present" || status === "late" || !status) {
          next[p.studentId] = Object.fromEntries(
            skillParameters.map((param) => [param, value]),
          );
        }
      });
      return next;
    });
    toast.success(`Set active athletes' skills to ${value}/10`);
  };

  const getPlayerOverallScore = (studentId: string): number | null => {
    const scores = scoresPending[studentId];
    if (scores && skillParameters.length > 0) {
      const values = skillParameters
        .map((p) => scores[p])
        .filter((v) => typeof v === "number");
      if (values.length > 0) {
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        return Math.round(avg * 10) / 10;
      }
    }
    const player = roster.find((p) => p.studentId === studentId);
    return player?.overallScore ?? null;
  };

  const averageRosterScore = useMemo(() => {
    const scored = roster
      .map((p) => getPlayerOverallScore(p.studentId))
      .filter((s): s is number => s !== null);
    if (scored.length === 0) return null;
    const avg = scored.reduce((a, b) => a + b, 0) / scored.length;
    return Math.round(avg * 10) / 10;
  }, [roster, scoresPending, skillParameters]);

  // Bulk operation: Mark all unmarked as Present
  const handleMarkAllPresent = () => {
    const updated = { ...attendancePending };
    roster.forEach((p) => {
      if (!getAttendanceStatus(p)) {
        updated[p.studentId] = "present";
      }
    });
    setAttendancePending(updated);
    toast.success("Marked all unmarked athletes as Present");
  };

  // Unified Save Workflow
  const handleSaveAll = async () => {
    if (!sessionId) return;
    try {
      // 1. Submit Attendance
      const attendanceRecords = roster
        .filter((p) => getAttendanceStatus(p))
        .map((p) => ({
          studentId: p.studentId,
          status: getAttendanceStatus(p) as any,
          remarks: remarksPending[p.studentId] || undefined,
        }));

      if (attendanceRecords.length > 0) {
        await markAttendance({
          id: sessionId,
          records: attendanceRecords,
        }).unwrap();
      }

      // 2. Submit Performance Evaluation
      const performanceRecords = roster
        .filter((p) => scoresPending[p.studentId])
        .map((p) => ({
          studentId: p.studentId,
          skillScores: skillParameters.map((parameter) => ({
            parameter,
            score: scoresPending[p.studentId][parameter] ?? 7,
          })),
          remarks: remarksPending[p.studentId] || undefined,
        }));

      if (performanceRecords.length > 0) {
        await logPerformance({
          id: sessionId,
          records: performanceRecords,
        }).unwrap();
      }

      toast.success("Session roster and evaluations saved");
    } catch (err: any) {
      toast.error(
        err?.data?.message || "Couldn't save roster changes — try again",
      );
    }
  };

  // 2. EARLY RETURNS ARE SAFELY PLACED NOW
  if (!sessionId) return <Navigate to="/schedule" replace />;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<CalendarDays size={28} />}
        title="Session not found"
        description="This session may have been removed or relocated."
        action={
          <Link
            to="/schedule"
            className="text-volt-400 hover:underline text-xs"
          >
            ← Return to Schedule
          </Link>
        }
      />
    );
  }

  const { session } = data;
  const isCancelled = session.status === "cancelled";

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
        <div>
          <Link
            to="/schedule"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors mb-2"
          >
            <ArrowLeft size={14} /> Back to Schedule
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-xl text-slate-900 dark:text-white uppercase tracking-wide">
              {session.targetType === "category"
                ? session.categories && session.categories.length > 0
                  ? session.categories.join(", ")
                  : (session.category ?? "Category")
                : (session.teamName ?? "Team")}
            </h1>
            <Badge variant="gray" size="sm">
              {session.type}
            </Badge>
            <Badge
              variant={
                session.status === "completed"
                  ? "green"
                  : session.status === "cancelled"
                    ? "red"
                    : "blue"
              }
              size="sm"
            >
              {session.status}
            </Badge>
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 font-mono mt-1">
            {session.startDate &&
            session.endDate &&
            session.startDate !== session.endDate
              ? `${new Date(session.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(session.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
              : new Date(session.date).toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
            {" · "}
            {session.dailyStartTime || session.startTime}–
            {session.dailyEndTime || session.endTime}
            {" · "}
            {session.location}
            {session.coaches &&
              session.coaches.length > 0 &&
              ` · Coaches: ${session.coaches.join(", ")}`}
          </p>
        </div>

        {!isCancelled && (
          <Button
            loading={savingAttendance || savingPerformance}
            onClick={handleSaveAll}
            icon={<Save size={15} />}
            className="text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-pitch-900"
          >
            Save All Updates
          </Button>
        )}
      </div>

      {isCancelled ? (
        <EmptyState
          title="Session Cancelled"
          description="Attendance and skill evaluations are locked for cancelled operational sessions."
        />
      ) : roster.length === 0 ? (
        <EmptyState
          title="No athletes assigned"
          description="Assign players to this team to log roster operational data."
        />
      ) : (
        <>
          {/* Operational Metrics & Quick Actions Bar */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 sm:gap-4 font-mono flex-wrap">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                P: {attendanceMetrics.present}
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                L: {attendanceMetrics.late}
              </span>
              <span className="text-ember-600 dark:text-ember-400 font-semibold">
                A: {attendanceMetrics.absent}
              </span>
              <span className="text-cyan-600 dark:text-ice-400 font-semibold">
                E: {attendanceMetrics.excused}
              </span>
              <span className="text-slate-400 dark:text-slate-500">
                Unmarked: {attendanceMetrics.unmarked}
              </span>
              {averageRosterScore !== null && (
                <span className="text-volt-600 dark:text-volt-400 font-bold border-l border-slate-200 dark:border-white/10 pl-3 sm:pl-4 inline-flex items-center gap-1">
                  <Star size={12} className="fill-current" /> Avg Rating: {averageRosterScore.toFixed(1)}/10
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {skillParameters.length > 0 && (
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-2xs">
                  <span className="hidden sm:inline">Bulk Rating:</span>
                  {[6, 7, 8, 9].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleBulkSetAllScores(val)}
                      className="px-2 py-1 rounded bg-slate-100 dark:bg-pitch-900 hover:bg-volt-400/20 hover:text-volt-600 dark:hover:text-volt-400 font-mono text-2xs font-semibold border border-slate-200 dark:border-white/10 transition-all"
                      title={`Set all active athletes to ${val}/10`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-volt-400/10 hover:bg-volt-400/20 text-volt-600 dark:text-volt-400 font-semibold border border-volt-400/20 transition-all text-xs"
              >
                <Zap size={14} /> Quick Mark Present
              </button>
            </div>
          </div>

          {/* Unified Operational Grid - Spreadsheet Matrix */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-pitch-800/50 shadow-sm dark:shadow-none overflow-hidden">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-pitch-900/80 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 font-mono uppercase text-2xs tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 sticky left-0 z-20 bg-slate-50 dark:bg-pitch-900 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] min-w-[170px]">
                      Athlete Details
                    </th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap min-w-[125px]">
                      Attendance
                    </th>
                    {skillParameters.map((param) => (
                      <th
                        key={param}
                        className="py-2.5 px-2 text-center whitespace-nowrap min-w-[68px]"
                        title={param}
                      >
                        <span className="truncate max-w-[85px] inline-block font-mono text-2xs">
                          {param}
                        </span>
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-center whitespace-nowrap min-w-[130px]">
                      Overall (1–10)
                    </th>
                    <th className="py-2.5 px-3 text-left whitespace-nowrap min-w-[160px]">
                      Session Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {roster.map((player) => {
                    const currentStatus = getAttendanceStatus(player);
                    const isAbsentOrExcused =
                      currentStatus === "absent" || currentStatus === "excused";
                    const playerScores = scoresPending[player.studentId];
                    const overallScore = getPlayerOverallScore(player.studentId);

                    return (
                      <tr
                        key={player.studentId}
                        className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors ${
                          isAbsentOrExcused ? "opacity-60 bg-slate-50/30 dark:bg-pitch-900/20" : ""
                        }`}
                      >
                        {/* Athlete Identification (Sticky Left) */}
                        <td className="py-2 px-3 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-pitch-800 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              name={`${player.firstName} ${player.lastName}`}
                              src={player.photo}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {player.firstName} {player.lastName}
                              </p>
                              <p className="text-2xs font-mono text-slate-400 dark:text-slate-500 truncate">
                                #{player.jerseyNumber || "—"} ·{" "}
                                {player.position || "Athlete"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* High-Touch Attendance Toggles */}
                        <td className="py-2 px-3 whitespace-nowrap text-center">
                          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-pitch-900 p-0.5 border border-slate-200 dark:border-white/10 gap-0.5">
                            {ATTENDANCE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() =>
                                  setAttendancePending((p) => ({
                                    ...p,
                                    [player.studentId]: opt.value,
                                  }))
                                }
                                className={`w-6 h-6 rounded text-2xs font-semibold transition-all ${
                                  currentStatus === opt.value
                                    ? opt.activeBg
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5"
                                }`}
                                title={opt.fullLabel}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </td>

                        {/* Dynamic Skill Columns (1-10 Dropdown Selectors) */}
                        {skillParameters.map((param) => {
                          const val = playerScores?.[param];
                          return (
                            <td
                              key={param}
                              className="py-2 px-2 text-center whitespace-nowrap"
                            >
                              <select
                                value={val ?? ""}
                                onChange={(e) =>
                                  setScore(
                                    player.studentId,
                                    param,
                                    Number(e.target.value),
                                  )
                                }
                                disabled={isAbsentOrExcused}
                                className={`w-12 h-7 text-xs font-mono font-bold text-center rounded-md border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-volt-400 ${getScoreBadgeStyle(val)}`}
                                title={`${param} rating (1-10)`}
                              >
                                <option
                                  value=""
                                  disabled
                                  className="bg-white dark:bg-pitch-900 text-slate-400"
                                >
                                  —
                                </option>
                                {SCORE_OPTIONS.map((scoreVal) => (
                                  <option
                                    key={scoreVal}
                                    value={scoreVal}
                                    className="bg-white dark:bg-pitch-900 text-slate-900 dark:text-white font-mono"
                                  >
                                    {scoreVal}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })}

                        {/* Calculated Overall Performance Score (1-10) + Quick Set */}
                        <td className="py-2 px-3 whitespace-nowrap text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {overallScore !== null ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${getOverallScoreBadgeStyle(overallScore)}`}
                                title={`Calculated Average: ${overallScore.toFixed(1)} / 10`}
                              >
                                <Star size={11} className="fill-current" />
                                {overallScore.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-2xs font-mono text-slate-400 dark:text-slate-500 italic">
                                Unrated
                              </span>
                            )}

                            {/* Quick-Set all skills for this player */}
                            {skillParameters.length > 0 && !isAbsentOrExcused && (
                              <select
                                title="Quick-set all skills for player"
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleQuickSetPlayerScores(
                                      player.studentId,
                                      Number(e.target.value),
                                    );
                                    e.target.value = "";
                                  }
                                }}
                                className="w-5 h-6 text-2xs rounded bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer px-0.5"
                              >
                                <option value="" disabled>⚡</option>
                                {SCORE_OPTIONS.map((val) => (
                                  <option
                                    key={val}
                                    value={val}
                                    className="bg-white dark:bg-pitch-900 text-slate-900 dark:text-white font-mono"
                                  >
                                    Set all: {val}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>

                        {/* Operational Remarks */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={
                              remarksPending[player.studentId] ??
                              player.performanceRemarks ??
                              ""
                            }
                            onChange={(e) =>
                              setRemarksPending((r) => ({
                                ...r,
                                [player.studentId]: e.target.value,
                              }))
                            }
                            placeholder="Optional notes..."
                            className="w-full min-w-[130px] h-7 px-2.5 rounded-md bg-slate-50 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-volt-400"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SessionRosterPage;
