// src/features/teams/tactics/ManageTeamView.tsx
import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { ArrowLeft, ArrowLeftRight, Sparkles, X, Palette, ChevronDown, ChevronUp, FileSpreadsheet, Trash2, UserMinus } from "lucide-react";
import {
  Player,
  FormationType,
  TeamFormat,
  FORMATION_PRESETS,
  FORMATIONS_BY_FORMAT,
  getFormatForFormation,
  SavedFormation,
  autopickSquad,
  getAptitudeMultiplier,
} from "./types";
import { TacticalCard } from "./TacticalCard";
import { Avatar } from "../../../components/ui";
import { PlayerPlaceholder } from "../../../components/ui/PlayerPlaceholder";
import mannequinPng from "../../../assets/players/mannequin.png";
import {
  useSaveFormationPresetMutation,
  useDeleteFormationPresetMutation,
} from "../../../store/api/teamsApi";

interface ManageTeamViewProps {
  teamId: string;
  teamName: string;
  players: Player[];
  coach?: { firstName: string; lastName: string } | null;
  primaryColor: string;
  secondaryColor: string;
  onBack: () => void;
  onEditColors: () => void;
  onGenerateReport?: () => void;
  initialFormationPresets?: SavedFormation[];
  initialTeamFormat?: TeamFormat;
}

export const ManageTeamView: React.FC<ManageTeamViewProps> = ({
  teamId,
  teamName,
  players,
  coach,
  primaryColor,
  secondaryColor,
  onBack,
  onEditColors,
  onGenerateReport,
  initialFormationPresets = [],
  initialTeamFormat = "11s",
}) => {
  const [teamFormat, setTeamFormat] = useState<TeamFormat>(initialTeamFormat);
  const [formation, setFormation] = useState<FormationType>(() => {
    return FORMATIONS_BY_FORMAT[initialTeamFormat]?.defaultFormation || "4-2-3-1";
  });
  const [squad, setSquad] = useState<Record<string, string>>(() =>
    autopickSquad(
      FORMATIONS_BY_FORMAT[initialTeamFormat]?.defaultFormation || "4-2-3-1",
      players,
    ),
  );
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [savedFormations, setSavedFormations] = useState<SavedFormation[]>(initialFormationPresets);
  const [labelInput, setLabelInput] = useState("Friendly Match");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [savePresetToDb, { isLoading: isSaving }] = useSaveFormationPresetMutation();
  const [deletePresetFromDb] = useDeleteFormationPresetMutation();

  // Sync from DB whenever initialFormationPresets changes (on team load)
  useEffect(() => {
    setSavedFormations(initialFormationPresets);
  }, [initialFormationPresets.length]);

  const cardBackground: React.CSSProperties = {
    backgroundImage: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
  };

  const collectiveStrength = Math.round(
    Object.entries(squad).reduce((sum, [slotId, playerId]) => {
      if (!playerId) return sum;
      const player = players.find((p) => p.id === playerId);
      const slot = (FORMATION_PRESETS[formation] || []).find((s) => s.id === slotId);
      if (!player || !slot) return sum;
      return (
        sum + player.rating * getAptitudeMultiplier(player.position, slot.role)
      );
    }, 0),
  );

  const activePitchIds = Object.values(squad).filter(Boolean);
  const reservePlayers = players.filter((p) => !activePitchIds.includes(p.id));

  const handleDragStart = (
    e: React.DragEvent,
    idOrSlot: string,
    source: "pitch" | "drawer",
  ) => {
    e.dataTransfer.setData("sourceType", source);
    e.dataTransfer.setData("payloadValue", idOrSlot);
  };

  const handleDropOnPitchSlot = (e: React.DragEvent, targetSlotId: string) => {
    e.preventDefault();
    const sourceType = e.dataTransfer.getData("sourceType");
    const payloadValue = e.dataTransfer.getData("payloadValue");

    if (sourceType === "pitch") {
      const originSlotId = payloadValue;
      if (originSlotId === targetSlotId) return;
      setSquad((prev) => {
        const next = { ...prev };
        const holder = next[originSlotId];
        next[originSlotId] = next[targetSlotId];
        next[targetSlotId] = holder;
        return next;
      });
      toast.success("Positions swapped");
    } else if (sourceType === "drawer") {
      setSquad((prev) => ({ ...prev, [targetSlotId]: payloadValue }));
      toast.success("Player substituted onto the pitch");
    }
  };

  const handleFormatChange = (fmt: TeamFormat) => {
    setTeamFormat(fmt);
    const defaultFmt = FORMATIONS_BY_FORMAT[fmt]?.defaultFormation || "4-2-3-1";
    setFormation(defaultFmt);
    const layoutSlots = FORMATION_PRESETS[defaultFmt] || [];
    const currentlyAssignedPlayers = Object.values(squad).filter(Boolean);
    const updatedSquad: Record<string, string> = {};
    layoutSlots.forEach((slot, index) => {
      if (currentlyAssignedPlayers[index]) {
        updatedSquad[slot.id] = currentlyAssignedPlayers[index];
      }
    });
    setSquad(updatedSquad);
    toast.success(`Switched to ${FORMATIONS_BY_FORMAT[fmt]?.label || fmt}`);
  };

  const saveFormationPreset = async () => {
    const preset: SavedFormation = {
      id: Date.now().toString(),
      label: labelInput,
      formationType: formation,
      teamFormat: teamFormat,
      squad: { ...squad },
    };
    try {
      await savePresetToDb({ teamId, preset: preset as any }).unwrap();
      setSavedFormations((prev) => [...prev, preset]);
      toast.success(`Saved: ${labelInput} (${teamFormat} ${formation})`);
    } catch {
      toast.error("Couldn't save formation — try again");
    }
  };

  const deleteFormationPreset = async (presetId: string) => {
    try {
      await deletePresetFromDb({ teamId, presetId }).unwrap();
      setSavedFormations((prev) => prev.filter((sf) => sf.id !== presetId));
      toast.success("Formation deleted");
    } catch {
      toast.error("Couldn't delete formation — try again");
    }
  };

  const applyPreset = (preset: SavedFormation) => {
    const fmt = preset.teamFormat || getFormatForFormation(preset.formationType);
    setTeamFormat(fmt);
    setFormation(preset.formationType);
    setSquad(preset.squad);
    toast.success(`Loaded: ${preset.label} (${fmt} ${preset.formationType})`);
  };

  const applyFormationReset = (type: FormationType) => {
    setFormation(type);
    const layoutSlots = FORMATION_PRESETS[type] || [];
    const currentlyAssignedPlayers = Object.values(squad).filter(Boolean);
    const updatedSquad: Record<string, string> = {};

    layoutSlots.forEach((slot, index) => {
      // Only carry over players already on the pitch; keep remaining slots completely empty
      if (currentlyAssignedPlayers[index]) {
        updatedSquad[slot.id] = currentlyAssignedPlayers[index];
      }
    });
    setSquad(updatedSquad);
  };

  const handleClearPitch = () => {
    setSquad({});
    setSelectedPlayer(null);
    toast.success("Pitch cleared — all slots are now empty");
  };

  const handleDropOnBench = (e: React.DragEvent) => {
    e.preventDefault();
    const sourceType = e.dataTransfer.getData("sourceType");
    const payloadValue = e.dataTransfer.getData("payloadValue");
    if (sourceType === "pitch") {
      const originSlotId = payloadValue;
      setSquad((prev) => {
        const next = { ...prev };
        delete next[originSlotId];
        return next;
      });
      toast.success("Player moved to bench (slot emptied)");
    }
  };

  const handleAutopick = () => {
    setSquad(autopickSquad(formation, players));
    toast.success("Squad optimized for peak strength", {
      icon: <Sparkles size={16} className="text-volt-400" />,
    });
  };

  return (
    <div className="h-full text-slate-800 dark:text-slate-100 font-sans relative flex flex-col gap-3">
      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 z-10">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider px-3 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-1.5 shrink-0"
          >
            <ArrowLeft size={13} /> Back
          </button>
          <h2
            className="text-sm sm:text-base font-black uppercase text-slate-900 dark:text-white tracking-wide truncate min-w-0 flex-1"
            title={`${teamName} Management Console`}
          >
            <span className="truncate">{teamName}</span>{" "}
            <span className="text-slate-400 font-normal hidden sm:inline">Management Console</span>
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Sidebar toggle — mobile only */}
          <button
            onClick={() => setIsSidebarOpen((v) => !v)}
            className="lg:hidden bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase px-3 py-1.5 rounded flex items-center gap-1.5"
          >
            {isSidebarOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Controls
          </button>
          {/* Substitutes drawer trigger */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase px-3 py-1.5 rounded flex items-center gap-1.5 shadow-sm shadow-cyan-900/30"
          >
            <ArrowLeftRight size={13} /> Subs ({reservePlayers.length})
          </button>
          {onGenerateReport && (
            <button
              onClick={onGenerateReport}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase px-3 py-1.5 rounded flex items-center gap-1.5 shadow-sm shadow-emerald-900/30"
              title="Generate Team Report and Export PDF"
            >
              <FileSpreadsheet size={13} /> Report
            </button>
          )}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-auto lg:overflow-hidden">

        {/* ── Left sidebar ── */}
        <div
          className={`lg:col-span-3 flex-col gap-4 ${isSidebarOpen ? "flex" : "hidden lg:flex"}`}
        >
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-4">
            {/* Team Format Switcher */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Format
                </label>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono font-bold">
                  {FORMATIONS_BY_FORMAT[teamFormat]?.playerCount} Players
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                {(["5s", "6s", "7s", "8s", "9s", "10s", "11s"] as TeamFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => handleFormatChange(fmt)}
                    className={`py-1 px-1 rounded text-2xs font-bold font-mono transition-all text-center ${
                      teamFormat === fmt
                        ? "bg-volt-400 text-pitch-950 shadow-sm ring-1 ring-volt-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title={FORMATIONS_BY_FORMAT[fmt].label}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1 truncate">
                {FORMATIONS_BY_FORMAT[teamFormat]?.pitchName}
              </p>
            </div>

            {/* Formation selector */}
            <div>
              <div className="flex justify-between items-end mb-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Formation ({teamFormat})
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleClearPitch}
                    className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10"
                    title="Clear all players to make all slots empty"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleAutopick}
                    className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 transition-colors bg-cyan-50 dark:bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-400/20"
                    title="Auto-fill slots with best players"
                  >
                    Autopick
                  </button>
                </div>
              </div>
              <select
                value={formation}
                onChange={(e) => applyFormationReset(e.target.value as FormationType)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-cyan-500 outline-none font-mono"
              >
                {FORMATIONS_BY_FORMAT[teamFormat]?.formations.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Save formation */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                Save formation as
              </label>
              <div className="flex gap-1.5 mb-3">
                <select
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-300"
                >
                  <option value="Friendly Match">Friendly Match</option>
                  <option value="Tournament Run">Tournament Run</option>
                  <option value="Local Derby">Local Derby</option>
                  <option value="Championship Final">Championship Final</option>
                  <option value="Training Match">Training Match</option>
                </select>
                <button
                  onClick={saveFormationPreset}
                  disabled={isSaving}
                  className="bg-lime-500 hover:bg-lime-600 disabled:opacity-50 text-slate-950 font-bold px-3 py-1 rounded text-2xs uppercase tracking-wide"
                >
                  {isSaving ? "..." : "Save"}
                </button>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {savedFormations.length === 0 && (
                  <p className="text-2xs text-slate-400">
                    No saved formations yet — save one to persist across sessions.
                  </p>
                )}
                {savedFormations.map((sf) => (
                  <div
                    key={sf.id}
                    className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800 text-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white leading-tight">
                          {sf.label}
                        </span>
                        {sf.teamFormat && (
                          <span className="px-1 py-0.2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[9px] font-mono font-bold">
                            {sf.teamFormat}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono">{sf.formationType}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => applyPreset(sf)}
                        className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-900/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/30"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteFormationPreset(sf.id)}
                        className="text-[10px] text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors"
                        title="Delete preset"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coach card */}
            <div className="mt-auto bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <Avatar
                name={coach ? `${coach.firstName} ${coach.lastName}` : "?"}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {coach ? `${coach.firstName} ${coach.lastName}` : "No coach assigned"}
                </p>
                <p className="text-xs text-slate-400">Head Coach</p>
              </div>
              <button
                onClick={onEditColors}
                className="w-9 h-9 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0"
                title="Edit team colors"
              >
                <Palette size={16} className="text-slate-500 dark:text-slate-300" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Pitch ── */}
        <div className="lg:col-span-6 flex flex-col items-center justify-start lg:justify-center gap-2">
          {/* Tactical Pitch Header Badge */}
          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm text-white border border-white/10 px-3.5 py-1 rounded-full text-xs shadow-md">
            <span className="font-bold text-volt-400 uppercase tracking-wider font-mono">
              {teamFormat}
            </span>
            <span className="text-white/30">·</span>
            <span className="text-slate-200 font-medium">
              {FORMATIONS_BY_FORMAT[teamFormat]?.pitchName}
            </span>
            <span className="text-white/30">·</span>
            <span className="font-mono text-cyan-300 font-bold">{formation}</span>
          </div>

          <div className="relative w-full max-w-xs sm:max-w-sm aspect-[4/5] bg-emerald-900 border-[3px] border-white/20 rounded-lg shadow-2xl overflow-hidden bg-gradient-to-b from-emerald-800 via-emerald-900 to-emerald-950">
            <div className="absolute inset-x-0 top-0 h-1/2 border-b border-white/10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white/10 rounded-full" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 h-16 border-b border-x border-white/10" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-44 h-16 border-t border-x border-white/10" />
            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-24 h-2.5 bg-slate-950/60 border-t border-x border-white/30 z-10" />

            {(FORMATION_PRESETS[formation] || []).map((slot) => {
              const assignedPlayerId = squad[slot.id];
              const playerObj = players.find((p) => p.id === assignedPlayerId);
              return (
                <TacticalCard
                  key={slot.id}
                  slotId={slot.id}
                  positionLabel={slot.role}
                  top={slot.top}
                  left={slot.left}
                  player={playerObj}
                  cardBackground={cardBackground}
                  onDragStart={(e, _, source) => handleDragStart(e, slot.id, source)}
                  onDrop={handleDropOnPitchSlot}
                  onViewDetails={(p) => setSelectedPlayer(p)}
                />
              );
            })}
          </div>
        </div>

        {/* ── Right: Strength + Inspector ── */}
        <div className="lg:col-span-3 flex flex-row lg:flex-col gap-3 lg:gap-4">
          {/* Collective Strength */}
          <div className="flex-1 lg:flex-none bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-center shadow-sm">
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-1">
              Collective Strength
            </h4>
            <p className="text-3xl font-mono font-black text-lime-500 dark:text-lime-400 tracking-tight">
              {collectiveStrength}
            </p>
          </div>

          {/* Player Inspector */}
          <div className="flex-1 lg:flex-none bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col shadow-sm">
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-3">
              Player Inspector
            </h4>
            {selectedPlayer ? (
              <div className="space-y-3 flex-1">
                <div
                  className="relative aspect-[2/3] w-full max-w-[140px] mx-auto rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl"
                  style={cardBackground}
                >
                  <div className="absolute inset-0">
                    {selectedPlayer.photo ? (
                      <img
                        src={selectedPlayer.photo}
                        className="h-full w-full object-cover object-top"
                        alt=""
                      />
                    ) : (
                      <PlayerPlaceholder
                        image={mannequinPng}
                        name={selectedPlayer.name}
                        number={selectedPlayer.squadNumber}
                        nameTop="44%"
                        numberTop="47%"
                        numberSize="80px"
                        className="h-full w-full px-4"
                      />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10" />
                  <div className="absolute top-3 left-3 z-20">
                    <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">
                      {selectedPlayer.position}
                    </p>
                    <h3 className="text-base font-black text-white leading-none mt-1 uppercase">
                      {selectedPlayer.name.split(" ")[0]}
                      <br />
                      {selectedPlayer.name.split(" ").slice(1).join(" ")}
                    </h3>
                  </div>
                  <div className="absolute top-3 right-3 text-right z-20">
                    <span className="text-2xl font-display font-black text-volt-400">
                      {selectedPlayer.rating}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 italic leading-relaxed">
                    Role: {selectedPlayer.position} specialist <br />
                    Squad number: {selectedPlayer.squadNumber}
                  </p>
                  {(() => {
                    const selectedSlot = Object.entries(squad).find(([_, id]) => id === selectedPlayer.id)?.[0];
                    if (!selectedSlot) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setSquad((prev) => {
                            const next = { ...prev };
                            delete next[selectedSlot];
                            return next;
                          });
                          setSelectedPlayer(null);
                          toast.success(`${selectedPlayer.name} moved to bench (slot emptied)`);
                        }}
                        className="w-full mt-2.5 text-2xs font-bold text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded py-1.5 transition flex items-center justify-center gap-1 uppercase"
                      >
                        <UserMinus size={12} />
                        <span>Bench Player (Empty Slot)</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl p-6 text-center">
                <p className="text-xs text-slate-400 font-medium">
                  Tap a player on the pitch to inspect
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Substitutes drawer (slide-in) ── */}
      {/* Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:bg-transparent lg:pointer-events-none"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropOnBench}
        className={`fixed inset-y-0 right-0 w-72 sm:w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 transform ${isDrawerOpen ? "translate-x-0" : "translate-x-full"} transition-transform duration-300 ease-in-out p-4 flex flex-col`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wide">
              Substitutes &amp; Reserves
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Drag a player onto a pitch slot
            </p>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded text-xs border border-slate-200 dark:border-slate-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-3 content-start pr-1">
          {reservePlayers.length === 0 && (
            <p className="col-span-3 text-2xs text-slate-400 dark:text-slate-500 text-center pt-6">
              Every player is on the pitch.
            </p>
          )}
          {reservePlayers.map((player) => {
            const getRatingColor = (r: number) =>
              r >= 85
                ? "text-volt-400"
                : r >= 70
                  ? "text-field-400"
                  : "text-ice-400";
            return (
              <div
                key={player.id}
                draggable
                onDragStart={(e) => handleDragStart(e, player.id, "drawer")}
                onClick={() => {
                  setSelectedPlayer(player);
                  setIsDrawerOpen(false);
                }}
                className="relative aspect-[2/3] rounded-xl border border-white/5 bg-black overflow-hidden group cursor-grab hover:border-volt-400/30 transition-all shadow-lg"
                style={cardBackground}
              >
                <div className="absolute inset-0">
                  {player.photo ? (
                    <img
                      src={player.photo}
                      alt={player.name}
                      className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <PlayerPlaceholder
                      image={mannequinPng}
                      name={player.name}
                      number={player.squadNumber}
                      nameSize="0px"
                      numberSize="32px"
                      numberTop="40%"
                      className="h-full w-full p-2 opacity-60"
                    />
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10" />
                <div className="absolute top-1.5 left-1.5 right-1.5 z-20 flex justify-between items-center">
                  <div className="bg-black/70 backdrop-blur-sm text-[6px] px-1 py-0.5 rounded border border-white/10 text-white font-bold uppercase tracking-tighter">
                    {player.position}
                  </div>
                  <div className={`font-display font-black text-[11px] leading-none drop-shadow-md ${getRatingColor(player.rating)}`}>
                    {player.rating}
                  </div>
                </div>
                <div className="absolute bottom-1 inset-x-0 px-1 z-20 text-center">
                  <p className="text-[8px] font-black text-white truncate uppercase tracking-tight drop-shadow-lg">
                    {player.name.split(" ").pop()}
                  </p>
                </div>
                <div className="absolute inset-0 border-2 border-volt-400/0 group-hover:border-volt-400/20 rounded-xl transition-all pointer-events-none" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
