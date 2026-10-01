// src/features/teams/TeamReportModal.tsx
import React, { useState, useMemo } from "react";
import {
  Printer,
  X,
  Shield,
  Users,
  Award,
  CalendarCheck,
  TrendingUp,
  Download,
  AlertCircle,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useGetTeamByIdQuery } from "../../store/api/teamsApi";
import { Button, Skeleton } from "../../components/ui";
import {
  type Player,
  type Position,
  type FormationType,
  FORMATION_PRESETS,
  autopickSquad,
} from "./tactics/types";

interface TeamReportModalProps {
  teamId: string;
  isOpen: boolean;
  onClose: () => void;
}

function toTacticalPosition(position?: string): Position {
  switch (position) {
    case "Goalkeeper":
      return "GK";
    case "Defender":
      return "CB";
    case "Midfielder":
      return "CMF";
    case "Forward":
      return "CF";
    default:
      return "CMF";
  }
}

function toCardRating(overallRating: number): number {
  return Math.max(50, Math.round(overallRating * 10));
}

const POPULAR_FORMATIONS: FormationType[] = [
  "4-3-3",
  "4-2-3-1",
  "4-4-2",
  "3-4-3",
  "5-3-2",
];

export const TeamReportModal: React.FC<TeamReportModalProps> = ({
  teamId,
  isOpen,
  onClose,
}) => {
  const { data: team, isLoading, isError } = useGetTeamByIdQuery(teamId, {
    skip: !isOpen || !teamId,
  });

  const [formation, setFormation] = useState<FormationType>("4-3-3");

  const players: Player[] = useMemo(() => {
    if (!team?.students) return [];
    return team.students.map((s, idx) => ({
      id: s._id,
      name: `${s.firstName} ${s.lastName}`,
      rating: toCardRating(s.overallRating ?? 0),
      position: toTacticalPosition(s.position),
      squadNumber: s.jerseyNumber ?? idx + 1,
      photo: s.photo,
    }));
  }, [team]);

  const squadSelection = useMemo(() => {
    return autopickSquad(formation, players);
  }, [formation, players]);

  // Derived statistics
  const totalStudents = team?.students?.length ?? 0;
  const avgRating = useMemo(() => {
    if (players.length === 0) return 0;
    const sum = players.reduce((acc, p) => acc + p.rating, 0);
    return Math.round(sum / players.length);
  }, [players]);

  const avgAttendance = useMemo(() => {
    if (!team?.students || team.students.length === 0) return 0;
    const sum = team.students.reduce((acc, s) => acc + (s.attendancePercentage ?? 0), 0);
    return Math.round(sum / team.students.length);
  }, [team]);

  const positionCounts = useMemo(() => {
    const counts = { Goalkeeper: 0, Defender: 0, Midfielder: 0, Forward: 0, Other: 0 };
    team?.students?.forEach((s) => {
      const pos = s.position || "Other";
      if (pos in counts) counts[pos as keyof typeof counts]++;
      else counts.Other++;
    });
    return counts;
  }, [team]);

  const startingSlots = FORMATION_PRESETS[formation] || [];
  const starterIds = new Set(Object.values(squadSelection));
  const starters = startingSlots
    .map((slot) => {
      const playerId = squadSelection[slot.id];
      const player = players.find((p) => p.id === playerId);
      return { slot, player };
    })
    .filter((item) => item.player !== undefined);

  const substitutes = players.filter((p) => !starterIds.has(p.id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="relative w-full max-w-5xl bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden print:border-none print:shadow-none print:w-full print:max-w-none">
        {/* Top Control Bar (Hidden on print) */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-pitch-950/60 print:hidden">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-volt-500" />
            <span className="font-display font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              Official Team Report Dossier
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              icon={<Download size={14} />}
              onClick={() => {
                window.open(`/teams/${teamId}/report?formation=${formation}&print=true`, "_blank");
              }}
              className="font-bold text-xs shadow-xs"
            >
              Export as PDF
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<ExternalLink size={14} />}
              onClick={() => {
                window.open(`/teams/${teamId}/report?formation=${formation}`, "_blank");
              }}
              className="font-semibold text-xs hidden sm:inline-flex"
            >
              Full Dossier
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body / Printable Document */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-6 bg-white dark:bg-pitch-900 text-slate-900 dark:text-slate-100">
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          )}

          {isError && (
            <div className="p-8 text-center space-y-3">
              <AlertCircle size={32} className="mx-auto text-amber-500" />
              <h3 className="text-base font-bold">Failed to load team data</h3>
              <p className="text-xs text-slate-500">
                Please check your network connection or try again shortly.
              </p>
            </div>
          )}

          {team && (
            <>
              {/* Report Header */}
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-pitch-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-display">
                      {team.name}
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-volt-400/20 text-volt-700 dark:text-volt-300 border border-volt-400/30">
                      {team.ageGroup}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Coach: <strong className="text-slate-700 dark:text-slate-200">{team.coachId ? `${team.coachId.firstName} ${team.coachId.lastName}` : "Unassigned"}</strong>
                    {team.franchise?.name ? ` · Franchise: ${team.franchise.name}` : ""}
                  </p>
                  <p className="text-2xs text-slate-400 font-mono">
                    Generated on {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>

                {/* Formation Picker (interactive on screen, badge in print) */}
                <div className="flex flex-col items-start md:items-end gap-1.5">
                  <span className="text-2xs font-mono uppercase text-slate-400 font-semibold">
                    Tactical Setup
                  </span>
                  <div className="flex items-center gap-1 bg-white dark:bg-pitch-800 p-1 rounded-xl border border-slate-200 dark:border-white/10 print:hidden">
                    {POPULAR_FORMATIONS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormation(f)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                          formation === f
                            ? "bg-volt-400 text-pitch-950 shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-bold font-mono text-volt-600 dark:text-volt-400 hidden print:block">
                    Formation: {formation}
                  </span>
                </div>
              </div>

              {/* Key Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-pitch-800/60 shadow-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-2xs uppercase tracking-wider font-mono font-semibold">Squad Size</span>
                    <Users size={14} className="text-volt-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                    {totalStudents}
                  </div>
                  <span className="text-2xs text-slate-500">Enrolled athletes</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-pitch-800/60 shadow-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-2xs uppercase tracking-wider font-mono font-semibold">Squad Rating</span>
                    <Award size={14} className="text-ice-400" />
                  </div>
                  <div className="text-2xl font-black text-ice-500 dark:text-ice-400 font-mono">
                    {avgRating} <span className="text-xs text-slate-400">/ 100</span>
                  </div>
                  <span className="text-2xs text-slate-500">Overall average rating</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-pitch-800/60 shadow-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-2xs uppercase tracking-wider font-mono font-semibold">Attendance</span>
                    <CalendarCheck size={14} className="text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {avgAttendance}%
                  </div>
                  <span className="text-2xs text-slate-500">Average match & drill rate</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-pitch-800/60 shadow-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-2xs uppercase tracking-wider font-mono font-semibold">Formation</span>
                    <TrendingUp size={14} className="text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-amber-500 font-mono">
                    {formation}
                  </div>
                  <span className="text-2xs text-slate-500">Preferred match structure</span>
                </div>
              </div>

              {/* Tactical Pitch Visual & Starting XI */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-volt-500" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                      Tactical Formation & Starting Lineup ({formation})
                    </h2>
                  </div>
                  <span className="text-2xs font-mono text-slate-500">
                    {starters.length} starters mapped
                  </span>
                </div>

                <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] max-h-[500px] rounded-2xl bg-emerald-800 dark:bg-emerald-950 border-4 border-emerald-900 shadow-inner overflow-hidden select-none">
                  {/* Pitch pattern grass stripes */}
                  <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(0deg,#000_0px,#000_40px,transparent_40px,transparent_80px)] pointer-events-none" />

                  {/* Pitch Markings (White lines) */}
                  {/* Outer boundary */}
                  <div className="absolute inset-3 border-2 border-white/40 pointer-events-none" />
                  {/* Halfway line */}
                  <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-0.5 bg-white/40 pointer-events-none" />
                  {/* Center circle */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-white/40 pointer-events-none flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                  </div>
                  {/* Top penalty box (attacking goal) */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-52 h-20 border-2 border-t-0 border-white/40 pointer-events-none" />
                  {/* Top goal box */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-8 border-2 border-t-0 border-white/40 pointer-events-none" />
                  {/* Bottom penalty box (defending goal) */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-52 h-20 border-2 border-b-0 border-white/40 pointer-events-none" />
                  {/* Bottom goal box */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-24 h-8 border-2 border-b-0 border-white/40 pointer-events-none" />

                  {/* Player Nodes on Pitch */}
                  {startingSlots.map((slot) => {
                    const playerId = squadSelection[slot.id];
                    const player = players.find((p) => p.id === playerId);

                    return (
                      <div
                        key={slot.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto transition-transform hover:scale-105"
                        style={{ top: `${slot.top}%`, left: `${slot.left}%` }}
                      >
                        <div className="relative">
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-white bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-md overflow-hidden">
                            {player?.photo ? (
                              <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-mono text-2xs sm:text-xs text-volt-300">
                                #{player?.squadNumber ?? "—"}
                              </span>
                            )}
                          </div>
                          <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-volt-400 text-pitch-950 shadow-xs border border-pitch-950">
                            {slot.role}
                          </span>
                        </div>

                        <div className="mt-1 px-2 py-0.5 rounded bg-black/75 backdrop-blur-xs text-white text-[10px] font-semibold text-center whitespace-nowrap shadow-xs max-w-[100px] truncate">
                          {player ? player.name.split(" ")[0] : "Empty"}
                          {player && (
                            <span className="ml-1 text-[9px] text-volt-300 font-mono">
                              ({player.rating})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Squad Roster Table */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                    Complete Squad Roster &amp; Player Metrics
                  </h2>
                  <span className="text-2xs text-slate-500 font-mono">
                    Sorted by performance rating
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-pitch-950/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-pitch-950/80 text-slate-500 font-mono uppercase text-2xs border-b border-slate-200 dark:border-white/10">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Player</th>
                        <th className="py-2.5 px-3">Position</th>
                        <th className="py-2.5 px-3">Squad Role</th>
                        <th className="py-2.5 px-3 text-center">Rating</th>
                        <th className="py-2.5 px-3 text-center">Attendance</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {players
                        .slice()
                        .sort((a, b) => b.rating - a.rating)
                        .map((player) => {
                          const isStarter = starterIds.has(player.id);
                          const studentData = team.students.find((s) => s._id === player.id);
                          const attPct = studentData?.attendancePercentage ?? 0;

                          return (
                            <tr
                              key={player.id}
                              className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                            >
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                                #{player.squadNumber}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-pitch-800 overflow-hidden flex items-center justify-center shrink-0">
                                    {player.photo ? (
                                      <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-500">
                                        {player.name[0]}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-semibold text-slate-900 dark:text-white">
                                    {player.name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                {studentData?.position || player.position}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                    isStarter
                                      ? "bg-volt-400/20 text-volt-700 dark:text-volt-300 border border-volt-400/30"
                                      : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400"
                                  }`}
                                >
                                  {isStarter ? "Starting XI" : "Substitute"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`font-mono font-bold text-xs ${
                                    player.rating >= 80
                                      ? "text-volt-500"
                                      : player.rating >= 70
                                      ? "text-ice-500"
                                      : "text-slate-600 dark:text-slate-400"
                                  }`}
                                >
                                  {player.rating}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">
                                <span
                                  className={`${
                                    attPct >= 80
                                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                      : attPct >= 60
                                      ? "text-amber-500 font-medium"
                                      : "text-red-500 font-medium"
                                  }`}
                                >
                                  {attPct}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Match Ready
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Position Distribution & Depth Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-pitch-950/30">
                  <span className="text-2xs font-mono uppercase text-slate-400 font-semibold block mb-0.5">
                    Goalkeepers
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {positionCounts.Goalkeeper}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-pitch-950/30">
                  <span className="text-2xs font-mono uppercase text-slate-400 font-semibold block mb-0.5">
                    Defenders
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {positionCounts.Defender}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-pitch-950/30">
                  <span className="text-2xs font-mono uppercase text-slate-400 font-semibold block mb-0.5">
                    Midfielders
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {positionCounts.Midfielder}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-pitch-950/30">
                  <span className="text-2xs font-mono uppercase text-slate-400 font-semibold block mb-0.5">
                    Forwards
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {positionCounts.Forward}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
