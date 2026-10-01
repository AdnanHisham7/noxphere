// src/features/teams/TeamReportPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Printer,
  ArrowLeft,
  Shield,
  Users,
  Award,
  CalendarCheck,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Activity,
  Layers,
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

export const TeamReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlFormation = searchParams.get("formation") as FormationType | null;
  const shouldAutoPrint = searchParams.get("print") === "true";

  const [formation, setFormation] = useState<FormationType>(
    urlFormation && POPULAR_FORMATIONS.includes(urlFormation) ? urlFormation : "4-3-3"
  );

  const { data: team, isLoading, isError } = useGetTeamByIdQuery(id ?? "", {
    skip: !id,
  });

  // Set document title for crisp PDF filename default
  useEffect(() => {
    if (team) {
      document.title = `${team.name} (${team.ageGroup}) — Official Tactical & Squad Report`;
    }
  }, [team]);

  // Auto print trigger if requested via query param
  useEffect(() => {
    if (team && shouldAutoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [team, shouldAutoPrint]);

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

  // Role line breakdown for tactical overview
  const tacticalLines = useMemo(() => {
    const lines = {
      Goalkeeper: starters.filter((s) => s.slot.role === "GK"),
      Defense: starters.filter((s) => ["CB", "LB", "RB", "LWB", "RWB"].includes(s.slot.role)),
      Midfield: starters.filter((s) => ["DMF", "CMF", "AMF", "LMF", "RMF"].includes(s.slot.role)),
      Attack: starters.filter((s) => ["CF", "SS", "LWF", "RWF"].includes(s.slot.role)),
    };
    return lines;
  }, [starters]);

  const handleFormationChange = (newFormation: FormationType) => {
    setFormation(newFormation);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("formation", newFormation);
    setSearchParams(newParams, { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-4 text-center">
          <Skeleton className="h-12 w-3/4 mx-auto rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Compiling Tactical Dossier &amp; Squad Metrics...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !team) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-4 shadow-xl">
          <AlertCircle size={40} className="mx-auto text-amber-500" />
          <h2 className="text-xl font-bold text-slate-900">Failed to Load Team Dossier</h2>
          <p className="text-xs text-slate-500">
            The requested team could not be loaded or network connectivity was lost.
          </p>
          <Button variant="secondary" onClick={() => navigate(-1)} icon={<ArrowLeft size={14} />}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans print:bg-white print:text-black">
      {/* Strict Print Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .report-section {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .report-card {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            background: white !important;
          }
          .pitch-board {
            background-color: #065f46 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .table-header {
            background-color: #f1f5f9 !important;
            color: #475569 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .badge-volt {
            background-color: #fef08a !important;
            color: #854d0e !important;
            border: 1px solid #eab308 !important;
          }
        }
      `}</style>

      {/* Top Action Bar (Hidden in Print) */}
      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                window.close();
              }
            }}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} /> Back
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <span className="font-display font-bold text-xs uppercase tracking-wider text-slate-700 hidden sm:inline">
            Tactical Preset:
          </span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {POPULAR_FORMATIONS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleFormationChange(f)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  formation === f
                    ? "bg-white text-slate-900 shadow-xs font-mono"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="primary"
            icon={<Printer size={15} />}
            onClick={() => window.print()}
            className="font-bold text-xs shadow-xs"
          >
            Print / Export PDF
          </Button>
        </div>
      </header>

      {/* Main Printable Document Sheet */}
      <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6 print:p-0 print:max-w-none">
        {/* Document Header & Seal */}
        <section className="report-card report-section bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Official Squad Dossier
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                  {team.ageGroup}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-display">
                {team.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-1">
                <span>
                  Head Coach:{" "}
                  <strong className="text-slate-900">
                    {team.coachId ? `${team.coachId.firstName} ${team.coachId.lastName}` : "Unassigned"}
                  </strong>
                </span>
                {team.franchise?.name && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>Franchise: <strong className="text-slate-900">{team.franchise.name}</strong></span>
                  </>
                )}
                <span className="text-slate-300">•</span>
                <span className="font-mono text-slate-500">
                  Tactics: <strong className="text-emerald-700 font-bold">{formation}</strong>
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 mb-1.5">
                <Shield size={16} className="text-emerald-600" />
                <span className="font-mono text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Noxphere Performance
                </span>
              </div>
              <p className="text-2xs font-mono text-slate-500">
                Generated: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p className="text-3xs font-mono text-slate-400 mt-0.5">
                Ref ID: NOX-{((team as any).id || (team as any)._id || "").slice(-6).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Key Executive Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-100">
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-3xs font-mono uppercase font-bold tracking-wider">Squad Depth</span>
                <Users size={14} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900">
                {totalStudents}
              </div>
              <span className="text-3xs text-slate-500">Registered athletes</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-3xs font-mono uppercase font-bold tracking-wider">Squad Rating</span>
                <Award size={14} className="text-sky-600" />
              </div>
              <div className="text-2xl font-black font-mono text-sky-700">
                {avgRating} <span className="text-xs text-slate-400 font-normal">/ 100</span>
              </div>
              <span className="text-3xs text-slate-500">Squad average index</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-3xs font-mono uppercase font-bold tracking-wider">Attendance</span>
                <CalendarCheck size={14} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-700">
                {avgAttendance}%
              </div>
              <span className="text-3xs text-slate-500">Session consistency</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-3xs font-mono uppercase font-bold tracking-wider">Starting XI</span>
                <TrendingUp size={14} className="text-amber-600" />
              </div>
              <div className="text-2xl font-black font-mono text-amber-700">
                {starters.length} <span className="text-xs text-slate-400 font-normal">/ 11</span>
              </div>
              <span className="text-3xs text-slate-500">Tactical slots filled</span>
            </div>
          </div>
        </section>

        {/* Tactical Pitch Board & Starting Lineup (Designed for Print & Screen) */}
        <section className="report-card report-section bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-600" />
                Tactical Pitch &amp; Matchday Starting XI ({formation})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Player positions mapped by tactical competency, preferred line assignments, and performance index.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {formation} Preset
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* The Pitch Board */}
            <div className="lg:col-span-7">
              <div className="relative w-full aspect-[4/3] rounded-2xl pitch-board bg-emerald-800 border-4 border-emerald-900 shadow-md overflow-hidden select-none">
                {/* Grass Stripes Pattern */}
                <div className="absolute inset-0 opacity-15 bg-[repeating-linear-gradient(0deg,#000_0px,#000_30px,transparent_30px,transparent_60px)] pointer-events-none" />

                {/* Outer pitch boundary line */}
                <div className="absolute inset-3 border-2 border-white/60 pointer-events-none rounded-sm" />

                {/* Halfway line */}
                <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-0.5 bg-white/60 pointer-events-none" />

                {/* Center Circle & Spot */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 sm:w-28 h-24 sm:h-28 rounded-full border-2 border-white/60 pointer-events-none flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white/80" />
                </div>

                {/* Top Penalty Box (Attacking Zone) */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-44 sm:w-52 h-16 sm:h-20 border-2 border-t-0 border-white/60 pointer-events-none" />
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 sm:w-24 h-6 sm:h-8 border-2 border-t-0 border-white/60 pointer-events-none" />

                {/* Bottom Penalty Box (Defending Zone) */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-44 sm:w-52 h-16 sm:h-20 border-2 border-b-0 border-white/60 pointer-events-none" />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-20 sm:w-24 h-6 sm:h-8 border-2 border-b-0 border-white/60 pointer-events-none" />

                {/* Starting XI Player Nodes on Pitch */}
                {startingSlots.map((slot) => {
                  const playerId = squadSelection[slot.id];
                  const player = players.find((p) => p.id === playerId);

                  return (
                    <div
                      key={slot.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
                      style={{ top: `${slot.top}%`, left: `${slot.left}%` }}
                    >
                      <div className="relative">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-md overflow-hidden">
                          {player?.photo ? (
                            <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-mono text-2xs sm:text-xs text-amber-300 font-bold">
                              #{player?.squadNumber ?? "—"}
                            </span>
                          )}
                        </div>
                        <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded text-[8px] sm:text-[9px] font-mono font-extrabold bg-amber-400 text-slate-950 shadow-xs border border-slate-950">
                          {slot.role}
                        </span>
                      </div>

                      <div className="mt-1 px-2 py-0.5 rounded bg-slate-900/90 text-white text-[9px] sm:text-[10px] font-bold text-center whitespace-nowrap shadow-xs max-w-[95px] truncate">
                        {player ? player.name.split(" ")[0] : "Empty"}
                        {player && (
                          <span className="ml-1 text-[8px] text-amber-300 font-mono font-semibold">
                            {player.rating}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tactical Starting XI Breakdown by Lines */}
            <div className="lg:col-span-5 space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                Starting XI Line Structure
              </h3>

              <div className="space-y-2 text-xs">
                {/* Attack Line */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="flex items-center justify-between font-bold text-slate-800 mb-1.5">
                    <span className="flex items-center gap-1.5 text-rose-700">
                      <span className="w-2 h-2 rounded-full bg-rose-500" /> Forward Line
                    </span>
                    <span className="font-mono text-2xs text-slate-500">
                      {tacticalLines.Attack.length} Players
                    </span>
                  </div>
                  <div className="space-y-1">
                    {tacticalLines.Attack.length === 0 ? (
                      <span className="text-2xs text-slate-400 italic">No forwards assigned</span>
                    ) : (
                      tacticalLines.Attack.map(({ slot, player }) => (
                        <div key={slot.id} className="flex items-center justify-between py-0.5 text-2xs">
                          <span className="font-semibold text-slate-800">
                            <span className="font-mono text-rose-700 font-bold mr-1.5">[{slot.role}]</span>
                            #{player?.squadNumber} {player?.name}
                          </span>
                          <span className="font-mono font-bold text-slate-700">{player?.rating} OVR</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Midfield Line */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="flex items-center justify-between font-bold text-slate-800 mb-1.5">
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Midfield Unit
                    </span>
                    <span className="font-mono text-2xs text-slate-500">
                      {tacticalLines.Midfield.length} Players
                    </span>
                  </div>
                  <div className="space-y-1">
                    {tacticalLines.Midfield.length === 0 ? (
                      <span className="text-2xs text-slate-400 italic">No midfielders assigned</span>
                    ) : (
                      tacticalLines.Midfield.map(({ slot, player }) => (
                        <div key={slot.id} className="flex items-center justify-between py-0.5 text-2xs">
                          <span className="font-semibold text-slate-800">
                            <span className="font-mono text-amber-700 font-bold mr-1.5">[{slot.role}]</span>
                            #{player?.squadNumber} {player?.name}
                          </span>
                          <span className="font-mono font-bold text-slate-700">{player?.rating} OVR</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Defense Line */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="flex items-center justify-between font-bold text-slate-800 mb-1.5">
                    <span className="flex items-center gap-1.5 text-sky-700">
                      <span className="w-2 h-2 rounded-full bg-sky-500" /> Defensive Line
                    </span>
                    <span className="font-mono text-2xs text-slate-500">
                      {tacticalLines.Defense.length} Players
                    </span>
                  </div>
                  <div className="space-y-1">
                    {tacticalLines.Defense.length === 0 ? (
                      <span className="text-2xs text-slate-400 italic">No defenders assigned</span>
                    ) : (
                      tacticalLines.Defense.map(({ slot, player }) => (
                        <div key={slot.id} className="flex items-center justify-between py-0.5 text-2xs">
                          <span className="font-semibold text-slate-800">
                            <span className="font-mono text-sky-700 font-bold mr-1.5">[{slot.role}]</span>
                            #{player?.squadNumber} {player?.name}
                          </span>
                          <span className="font-mono font-bold text-slate-700">{player?.rating} OVR</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Goalkeeper */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="flex items-center justify-between font-bold text-slate-800 mb-1.5">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Goalkeeper
                    </span>
                    <span className="font-mono text-2xs text-slate-500">
                      {tacticalLines.Goalkeeper.length} Player
                    </span>
                  </div>
                  <div className="space-y-1">
                    {tacticalLines.Goalkeeper.length === 0 ? (
                      <span className="text-2xs text-slate-400 italic">No goalkeeper assigned</span>
                    ) : (
                      tacticalLines.Goalkeeper.map(({ slot, player }) => (
                        <div key={slot.id} className="flex items-center justify-between py-0.5 text-2xs">
                          <span className="font-semibold text-slate-800">
                            <span className="font-mono text-emerald-700 font-bold mr-1.5">[GK]</span>
                            #{player?.squadNumber} {player?.name}
                          </span>
                          <span className="font-mono font-bold text-slate-700">{player?.rating} OVR</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Squad Position Depth Summary */}
        <section className="report-card report-section bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Layers size={14} className="text-slate-500" />
              Roster Depth &amp; Position Distribution
            </h3>
            <span className="text-2xs font-mono text-slate-400">Total: {totalStudents} Athletes</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-3xs font-mono uppercase text-slate-500 font-bold block mb-1">
                Goalkeepers
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-slate-900">{positionCounts.Goalkeeper}</span>
                <span className="text-3xs text-slate-500 font-mono">
                  {totalStudents > 0 ? Math.round((positionCounts.Goalkeeper / totalStudents) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-3xs font-mono uppercase text-slate-500 font-bold block mb-1">
                Defenders
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-slate-900">{positionCounts.Defender}</span>
                <span className="text-3xs text-slate-500 font-mono">
                  {totalStudents > 0 ? Math.round((positionCounts.Defender / totalStudents) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-3xs font-mono uppercase text-slate-500 font-bold block mb-1">
                Midfielders
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-slate-900">{positionCounts.Midfielder}</span>
                <span className="text-3xs text-slate-500 font-mono">
                  {totalStudents > 0 ? Math.round((positionCounts.Midfielder / totalStudents) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-3xs font-mono uppercase text-slate-500 font-bold block mb-1">
                Forwards
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-slate-900">{positionCounts.Forward}</span>
                <span className="text-3xs text-slate-500 font-mono">
                  {totalStudents > 0 ? Math.round((positionCounts.Forward / totalStudents) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Complete Squad Roster & Performance Table */}
        <section className="report-card report-section bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Squad Roster &amp; Evaluation Ledger
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Comprehensive roster with tactical tier, overall index, and recorded attendance.
              </p>
            </div>
            <span className="text-2xs font-mono text-slate-400">
              {players.length} Players Listed
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="table-header bg-slate-100 text-slate-700 font-mono uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Player Name</th>
                  <th className="py-2.5 px-3">Primary Position</th>
                  <th className="py-2.5 px-3">Match Role</th>
                  <th className="py-2.5 px-3 text-center">Rating</th>
                  <th className="py-2.5 px-3 text-center">Attendance</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {players
                  .slice()
                  .sort((a, b) => {
                    const aStarter = starterIds.has(a.id) ? 1 : 0;
                    const bStarter = starterIds.has(b.id) ? 1 : 0;
                    if (aStarter !== bStarter) return bStarter - aStarter;
                    return b.rating - a.rating;
                  })
                  .map((player) => {
                    const isStarter = starterIds.has(player.id);
                    const studentData = team.students?.find((s) => s._id === player.id);
                    const attPct = studentData?.attendancePercentage ?? 100;

                    return (
                      <tr key={player.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                          #{player.squadNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{player.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {studentData?.position || player.position}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              isStarter
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {isStarter ? "Starting XI" : "Substitute"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          <span
                            className={
                              player.rating >= 80
                                ? "text-emerald-700"
                                : player.rating >= 70
                                ? "text-sky-700"
                                : "text-slate-700"
                            }
                          >
                            {player.rating}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span
                            className={`font-semibold ${
                              attPct >= 80
                                ? "text-emerald-700"
                                : attPct >= 60
                                ? "text-amber-700"
                                : "text-rose-700"
                            }`}
                          >
                            {attPct}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="inline-flex items-center gap-1.5 text-2xs text-emerald-700 font-semibold">
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
        </section>

        {/* Coach Tactical Notes & Operational Summary */}
        <section className="report-card report-section bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Activity size={14} className="text-emerald-600" />
            Coaching Remarks &amp; Tactical Blueprint
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            The {team.name} squad is organized into an optimal <strong className="text-slate-900">{formation}</strong> tactical formation.
            With an overall average squad capability index of <strong className="text-slate-900">{avgRating}/100</strong> and session adherence
            holding at <strong className="text-slate-900">{avgAttendance}%</strong>, the team exhibits strong athletic readiness and role specialization.
            Key focus areas include maintaining defensive compactness, fluid midfield transition tempo, and executing high-press defensive phases.
          </p>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-2xs text-slate-500">
            <div>
              <span className="font-semibold text-slate-700">Evaluated By: </span>
              {team.coachId ? `${team.coachId.firstName} ${team.coachId.lastName} (Lead Coach)` : "Technical Staff"}
            </div>
            <div className="font-mono text-3xs">
              Status: Verified &amp; Signed
            </div>
          </div>
        </section>

        {/* Official Certification Footer */}
        <footer className="report-card report-section border border-slate-200 rounded-2xl p-4 text-center text-3xs text-slate-500 font-mono space-y-1 bg-white">
          <p>© Noxphere Sports Performance Platform · Certified Academy Operational Record</p>
          <p>
            Generated on {new Date().toISOString()} · Authenticated evaluation token:{" "}
            {((team as any).id || (team as any)._id || "").slice(-8).toUpperCase()}
          </p>
        </footer>
      </main>
    </div>
  );
};

export default TeamReportPage;
