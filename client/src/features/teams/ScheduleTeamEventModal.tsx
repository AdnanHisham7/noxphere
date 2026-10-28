import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Users } from "lucide-react";
import { clsx } from "clsx";
import { Button, Modal, Input, Select } from "../../components/ui";
import { useCreateSessionMutation } from "../../store/api/scheduleApi";
import { academyApi } from "../../store/api/academyApi";
import { useGetFranchisesQuery } from "../../store/api/franchiseApi";
import { Team } from "../../store/api/teamsApi";

export const ScheduleTeamEventModal: React.FC<{
  team: Team;
  academyId: string;
  coaches: { id: string; firstName: string; lastName: string }[];
  onClose: () => void;
}> = ({ team, academyId, coaches, onClose }) => {
  const [createSession, { isLoading }] = useCreateSessionMutation();
  const { data: academyData } = academyApi.useGetAcademyByIdQuery(academyId, { skip: !academyId });
  const { data: franchises } = useGetFranchisesQuery(
    academyId ? { academyId, isActive: true } : undefined,
    { skip: !academyId }
  );

  const academyPitches = (academyData?.pitches || []).filter((p) => p.isActive !== false);

  const availableSessionTypes = academyData?.sessionTypes && academyData.sessionTypes.length > 0
    ? academyData.sessionTypes.map((st) => ({ id: st.name.toLowerCase(), label: st.name }))
    : [
        { id: "technical", label: "Technical" },
        { id: "physical", label: "Physical" },
        { id: "tactical", label: "Tactical" },
        { id: "mental", label: "Mental" },
        { id: "match", label: "Match" },
        { id: "training", label: "Training" },
        { id: "trial", label: "Trial" },
        { id: "fitness", label: "Fitness" },
      ];

  const [type, setType] = useState<string>(availableSessionTypes[0]?.id || "match");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:30");
  const [selectedCoachId, setSelectedCoachId] = useState(
    (team.coach as any)?._id || (team.coach as any)?.id || coaches[0]?.id || ""
  );
  const [venueType, setVenueType] = useState<"pitch" | "branch" | "custom">("pitch");
  const [selectedPitchId, setSelectedPitchId] = useState(academyPitches[0]?.id || "");
  const [selectedFranchiseId, setSelectedFranchiseId] = useState(franchises?.[0]?.id || "");
  const [customLocation, setCustomLocation] = useState("");
  const [opponent, setOpponent] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return toast.error("Date is required");
    if (!startTime || !endTime) return toast.error("Start and end time are required");
    if (endTime <= startTime) return toast.error("End time must be after start time");
    if (!selectedCoachId) return toast.error("Coach is required");

    let location = "";
    let pitchId: string | undefined = undefined;
    let franchiseIdToSave: string | undefined = undefined;

    if (venueType === "pitch") {
      const pitch = academyPitches.find((p) => p.id === selectedPitchId);
      location = pitch?.name || "Academy Pitch";
      pitchId = pitch?.id;
    } else if (venueType === "branch") {
      const f = franchises?.find((it) => it.id === selectedFranchiseId);
      location = f?.location?.name || f?.name || "Branch Ground";
      franchiseIdToSave = f?.id;
    } else {
      if (!customLocation.trim()) return toast.error("Enter venue or ground location");
      location = customLocation.trim();
    }

    const sessionNotes = [
      type.toLowerCase() === "match" && opponent.trim() ? `Opponent: ${opponent.trim()}` : "",
      notes.trim(),
    ].filter(Boolean).join(" · ");

    try {
      await createSession({
        targetType: "team",
        teamId: team.id,
        academyId,
        franchiseId: franchiseIdToSave,
        coachId: selectedCoachId,
        type,
        date,
        startTime,
        endTime,
        location,
        pitchId,
        notes: sessionNotes || undefined,
      }).unwrap();

      toast.success(`${type.toLowerCase() === "match" ? "Match" : "Squad session"} scheduled for ${team.name}!`);
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't schedule event — try again");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Schedule Event · ${team.name}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Banner about cross-branch squad */}
        <div className="p-3 rounded-lg bg-volt-400/[0.08] dark:bg-volt-400/[0.05] border border-volt-400/20 text-2xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
          <Users size={14} className="text-volt-500 shrink-0 mt-0.5" />
          <span>
            <strong>{team.name} ({team.ageGroup})</strong> is an academy-wide squad. Scheduling this event will automatically add it to the squad's schedule and notify all assigned players across all branches.
          </span>
        </div>

        {/* Event Type */}
        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
            Event Type
          </label>
          <div className="flex flex-wrap gap-2">
            {availableSessionTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={clsx(
                  "px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all border",
                  type.toLowerCase() === t.id.toLowerCase()
                    ? "bg-volt-400 text-pitch-900 border-volt-400 shadow-sm font-extrabold"
                    : "bg-slate-50 dark:bg-pitch-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-300"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {type.toLowerCase() === "match" && (
          <Input
            label="Opponent Team / Club (optional)"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="e.g. City Youth FC"
          />
        )}

        {/* Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input label="Start Time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          <Input label="End Time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>

        {/* Venue / Ground Location */}
        <div className="space-y-2 border-t border-slate-100 dark:border-white/5 pt-3">
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
            Ground / Venue Selection
          </label>
          <div className="flex gap-2">
            {[
              { id: "pitch", label: "Academy Pitch" },
              { id: "branch", label: "Branch Ground" },
              { id: "custom", label: "Custom Venue" },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVenueType(v.id as any)}
                className={clsx(
                  "px-3 py-1 text-2xs font-bold rounded-md border transition-all",
                  venueType === v.id
                    ? "bg-pitch-900 dark:bg-white text-white dark:text-pitch-900 border-pitch-900 dark:border-white font-bold"
                    : "bg-slate-100 dark:bg-pitch-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>

          {venueType === "pitch" ? (
            academyPitches.length > 0 ? (
              <Select
                label="Select Academy Pitch"
                value={selectedPitchId}
                onChange={(e) => setSelectedPitchId(e.target.value)}
              >
                {academyPitches.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.fieldNumber ? `(Field ${p.fieldNumber})` : ""} {p.surfaceType ? `· ${p.surfaceType}` : ""}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-2xs text-slate-400">No academy pitches configured yet. Switch to Branch Ground or Custom Venue.</p>
            )
          ) : venueType === "branch" ? (
            <Select
              label="Select Host Branch Ground"
              value={selectedFranchiseId}
              onChange={(e) => setSelectedFranchiseId(e.target.value)}
            >
              {(franchises || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — {f.location?.name || f.location?.address}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              label="Custom Ground / Venue Name"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              placeholder="e.g. Greenfield Stadium Ground 2"
              required
            />
          )}
        </div>

        {/* Coach */}
        <Select
          label="Assigned Lead Coach"
          value={selectedCoachId}
          onChange={(e) => setSelectedCoachId(e.target.value)}
          required
        >
          <option value="">Select coach...</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </Select>

        <Input
          label="Tactical Notes / Brief (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Match kit required, arrive 30 mins before kick-off"
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={isLoading} className="flex-1">
            Schedule Squad Event
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
