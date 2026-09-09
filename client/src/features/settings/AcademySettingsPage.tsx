// src/features/settings/AcademySettingsPage.tsx
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Settings,
  Save,
  Building2,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button, Input, Card, Badge, Skeleton, EmptyState, Modal, ConfirmModal } from "../../components/ui";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import { academyApi } from "../../store/api/academyApi";
import type { Location, AcademyPitch } from "../academies/types";

const useGetAcademyById = academyApi.useGetAcademyByIdQuery;
const useUpdateAcademyConfig = academyApi.useUpdateAcademyConfigMutation;

const SURFACE_TYPES = [
  "Artificial Turf",
  "Natural Grass",
  "Indoor Hardwood",
  "Hybrid Turf",
  "Sand / Beach",
  "Concrete / Multi-Sport",
  "Other",
];

const AcademySettingsPage: React.FC = () => {
  const academyId = useCurrentAcademyId();
  const { data: academy, isLoading, isError } = useGetAcademyById(academyId ?? "", { skip: !academyId });
  const [updateConfig, { isLoading: saving }] = useUpdateAcademyConfig();

  const [name, setName] = useState("");
  const [location, setLocation] = useState<Location>({ name: "", address: "", latitude: 0, longitude: 0, fieldNumber: "" });
  const [pitches, setPitches] = useState<AcademyPitch[]>([]);
  const [absentAlertDays, setAbsentAlertDays] = useState(5);
  const [dueDateAlertDays, setDueDateAlertDays] = useState(3);
  const [dataProtectionContactEmail, setDataProtectionContactEmail] = useState("");

  // Pitch Add/Edit Modal state
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);
  const [editingPitchId, setEditingPitchId] = useState<string | null>(null);
  const [pitchForm, setPitchForm] = useState({
    name: "",
    fieldNumber: "",
    surfaceType: "Artificial Turf",
    address: "",
    isActive: true,
  });

  // Pitch Delete Confirmation state
  const [pitchToDelete, setPitchToDelete] = useState<AcademyPitch | null>(null);

  useEffect(() => {
    if (!academy) return;
    setName(academy.name);
    setLocation(academy.location);
    setPitches(academy.pitches || []);
    setAbsentAlertDays(academy.absentAlertDays);
    setDueDateAlertDays(academy.dueDateAlertDays);
    setDataProtectionContactEmail(academy.dataProtectionContactEmail ?? "");
  }, [academy]);

  const handleSave = async () => {
    if (!academyId) return;
    if (!name.trim()) {
      toast.error("Academy name can't be empty");
      return;
    }
    if (absentAlertDays < 1) {
      toast.error("Absence alert threshold must be at least 1 day");
      return;
    }
    if (dueDateAlertDays < 0) {
      toast.error("Due-date alert threshold can't be negative");
      return;
    }
    if (dataProtectionContactEmail.trim() && !/^\S+@\S+\.\S+$/.test(dataProtectionContactEmail.trim())) {
      toast.error("Enter a valid data protection contact email, or leave it blank");
      return;
    }
    try {
      await updateConfig({
        id: academyId,
        config: {
          name: name.trim(),
          location,
          pitches,
          ageGroups: academy?.ageGroups,
          absentAlertDays,
          dueDateAlertDays,
          dataProtectionContactEmail: dataProtectionContactEmail.trim() || undefined,
        },
      }).unwrap();
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't save settings — try again");
    }
  };

  const openAddPitch = () => {
    setEditingPitchId(null);
    setPitchForm({
      name: "",
      fieldNumber: "",
      surfaceType: "Artificial Turf",
      address: location?.address || "",
      isActive: true,
    });
    setIsPitchModalOpen(true);
  };

  const openEditPitch = (pitch: AcademyPitch) => {
    setEditingPitchId(pitch.id);
    setPitchForm({
      name: pitch.name,
      fieldNumber: pitch.fieldNumber || "",
      surfaceType: pitch.surfaceType || "Artificial Turf",
      address: pitch.address || "",
      isActive: pitch.isActive !== false,
    });
    setIsPitchModalOpen(true);
  };

  const handleSavePitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pitchForm.name.trim()) {
      toast.error("Pitch / Venue name is required");
      return;
    }

    let updatedPitches: AcademyPitch[];
    if (editingPitchId) {
      updatedPitches = pitches.map((p) =>
        p.id === editingPitchId
          ? {
              ...p,
              name: pitchForm.name.trim(),
              fieldNumber: pitchForm.fieldNumber.trim() || undefined,
              surfaceType: pitchForm.surfaceType || "Artificial Turf",
              address: pitchForm.address.trim() || undefined,
              isActive: pitchForm.isActive,
            }
          : p
      );
    } else {
      const newPitch: AcademyPitch = {
        id: `pitch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: pitchForm.name.trim(),
        fieldNumber: pitchForm.fieldNumber.trim() || undefined,
        surfaceType: pitchForm.surfaceType || "Artificial Turf",
        address: pitchForm.address.trim() || undefined,
        isActive: pitchForm.isActive,
      };
      updatedPitches = [...pitches, newPitch];
    }

    setPitches(updatedPitches);
    setIsPitchModalOpen(false);

    if (academyId) {
      try {
        await updateConfig({
          id: academyId,
          config: { pitches: updatedPitches },
        }).unwrap();
        toast.success(editingPitchId ? "Pitch updated successfully" : "Pitch added successfully");
      } catch (err: any) {
        toast.error(err?.data?.message || "Failed to persist pitch changes");
      }
    }
  };

  const handleDeletePitch = async () => {
    if (!pitchToDelete || !academyId) return;
    const updatedPitches = pitches.filter((p) => p.id !== pitchToDelete.id);
    setPitches(updatedPitches);
    setPitchToDelete(null);

    try {
      await updateConfig({
        id: academyId,
        config: { pitches: updatedPitches },
      }).unwrap();
      toast.success("Pitch removed successfully");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to remove pitch");
    }
  };

  const handleTogglePitchActive = async (pitch: AcademyPitch) => {
    if (!academyId) return;
    const updatedPitches = pitches.map((p) =>
      p.id === pitch.id ? { ...p, isActive: p.isActive === false ? true : false } : p
    );
    setPitches(updatedPitches);

    try {
      await updateConfig({
        id: academyId,
        config: { pitches: updatedPitches },
      }).unwrap();
      toast.success(pitch.isActive === false ? `${pitch.name} activated` : `${pitch.name} deactivated`);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update pitch status");
    }
  };

  const handleImportPrimaryLocation = async () => {
    if (!academyId) return;
    if (!location?.name?.trim()) {
      toast.error("Please provide a Primary Location Name first");
      return;
    }

    const defaultPitch: AcademyPitch = {
      id: `pitch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: location.name.trim(),
      fieldNumber: location.fieldNumber?.trim() || undefined,
      surfaceType: "Artificial Turf",
      address: location.address?.trim() || undefined,
      isActive: true,
    };

    const updatedPitches = [...pitches, defaultPitch];
    setPitches(updatedPitches);

    try {
      await updateConfig({
        id: academyId,
        config: { pitches: updatedPitches },
      }).unwrap();
      toast.success(`Imported "${location.name}" as a pitch venue`);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to import location as pitch");
    }
  };

  if (!academyId) {
    return (
      <EmptyState
        icon={<Settings size={28} />}
        title="Access Denied"
        description="No academy context resolved. Please log in as an academy manager to configure settings."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !academy) {
    return (
      <EmptyState
        icon={<Settings size={28} />}
        title="Couldn't load settings"
        description="Something went wrong loading your academy settings. Try refreshing."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-lg sm:text-xl font-bold text-white uppercase tracking-wide">Academy settings</h1>
          <p className="text-xs text-slate-400 mt-1">
            These apply academy-wide, across every franchise of {academy.name}.
          </p>
        </div>
        <Button icon={<Save size={15} />} loading={saving} onClick={handleSave} className="w-full sm:w-auto justify-center">
          Save changes
        </Button>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={16} className="text-volt-400" />
          <h2 className="font-display text-sm font-bold text-white uppercase tracking-wide">Academy details</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Academy name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Location name"
            value={location?.name}
            onChange={(e) => setLocation((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Address"
            className="sm:col-span-2"
            value={location?.address}
            onChange={(e) => setLocation((prev) => ({ ...prev, address: e.target.value }))}
          />
          <Input
            label="Latitude"
            type="number"
            step="any"
            value={location?.latitude}
            onChange={(e) => setLocation((prev) => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
          />
          <Input
            label="Longitude"
            type="number"
            step="any"
            value={location?.longitude}
            onChange={(e) => setLocation((prev) => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
          />
          <Input
            label="Field number (optional)"
            value={location?.fieldNumber ?? ""}
            onChange={(e) => setLocation((prev) => ({ ...prev, fieldNumber: e.target.value }))}
          />
        </div>
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-volt-400" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-bold text-white uppercase tracking-wide">
                  Pitches & Venues
                </h2>
                <Badge variant="gray" size="sm">
                  {pitches.length} {pitches.length === 1 ? "pitch" : "pitches"}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage all operational pitches, turfs, and grounds used when creating training sessions and matches.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pitches.length === 0 && location?.name && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Sparkles size={13} />}
                onClick={handleImportPrimaryLocation}
              >
                Import Primary Location
              </Button>
            )}
            <Button
              size="sm"
              icon={<Plus size={14} />}
              onClick={openAddPitch}
            >
              Add Pitch / Venue
            </Button>
          </div>
        </div>

        {pitches.length === 0 ? (
          <div className="py-8 px-4 text-center border border-dashed border-slate-700/60 rounded-xl bg-slate-900/20">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
              <MapPin size={20} />
            </div>
            <p className="text-sm font-medium text-slate-300">No pitches or venues added yet</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Add your grounds, indoor courts, or turfs so coaches and managers can quickly select them from a dropdown when scheduling sessions.
            </p>
            <div className="flex justify-center gap-2">
              {location?.name && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Sparkles size={13} />}
                  onClick={handleImportPrimaryLocation}
                >
                  Import "{location.name}"
                </Button>
              )}
              <Button size="sm" icon={<Plus size={13} />} onClick={openAddPitch}>
                Add First Pitch
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pitches.map((pitch) => (
              <div
                key={pitch.id}
                className="p-3.5 rounded-xl bg-slate-900/50 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-volt-400 shrink-0" />
                        <h3 className="font-sans font-bold text-sm text-white truncate" title={pitch.name}>
                          {pitch.name}
                        </h3>
                      </div>
                      {pitch.address && (
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate pl-3.5" title={pitch.address}>
                          {pitch.address}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePitchActive(pitch)}
                      title={pitch.isActive !== false ? "Click to deactivate" : "Click to activate"}
                      className="shrink-0 transition-opacity"
                    >
                      <Badge variant={pitch.isActive !== false ? "green" : "gray"} size="sm">
                        {pitch.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pl-3.5">
                    {pitch.fieldNumber && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-volt-400/10 text-volt-300 border border-volt-400/20">
                        Field: {pitch.fieldNumber}
                      </span>
                    )}
                    {pitch.surfaceType && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-white/5">
                        {pitch.surfaceType}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-white/5">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Edit2 size={12} />}
                    onClick={() => openEditPitch(pitch)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    icon={<Trash2 size={12} />}
                    onClick={() => setPitchToDelete(pitch)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-sm font-bold text-white uppercase tracking-wide mb-1">Guardian alert thresholds</h2>
        <p className="text-xs text-slate-400 mb-4">
          Controls when the automated absence and installment-due WhatsApp/system alerts fire.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Consecutive absent days before alert"
            type="number"
            min={1}
            max={30}
            value={absentAlertDays}
            onChange={(e) => setAbsentAlertDays(parseInt(e.target.value, 10) || 1)}
          />
          <Input
            label="Days before installment due date to alert"
            type="number"
            min={0}
            max={30}
            value={dueDateAlertDays}
            onChange={(e) => setDueDateAlertDays(parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-sm font-bold text-white uppercase tracking-wide mb-1">Data protection contact</h2>
        <p className="text-xs text-slate-400 mb-4">
          Shown to guardians on the consent notice as the contact for reviewing, correcting, or withdrawing consent
          for their child's data, per the DPDP Act. Leave blank to use your own manager account's email.
        </p>
        <Input
          label="Contact email"
          type="email"
          value={dataProtectionContactEmail}
          onChange={(e) => setDataProtectionContactEmail(e.target.value)}
          placeholder="privacy@youracademy.com"
          className="max-w-sm"
        />
      </Card>

      {/* Add / Edit Pitch Modal */}
      {isPitchModalOpen && (
        <Modal
          isOpen={isPitchModalOpen}
          onClose={() => setIsPitchModalOpen(false)}
          title={editingPitchId ? "Edit Pitch / Venue" : "Add Pitch / Venue"}
          size="md"
        >
          <form onSubmit={handleSavePitch} className="space-y-4">
            <Input
              label="Pitch / Venue Name"
              placeholder="e.g. Main Turf, Arena A, North Field"
              value={pitchForm.name}
              onChange={(e) => setPitchForm({ ...pitchForm, name: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Field Number / Identifier (Optional)"
                placeholder="e.g. Field 1, Pitch B"
                value={pitchForm.fieldNumber}
                onChange={(e) => setPitchForm({ ...pitchForm, fieldNumber: e.target.value })}
              />

              <div>
                <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Surface Type
                </label>
                <select
                  value={pitchForm.surfaceType}
                  onChange={(e) => setPitchForm({ ...pitchForm, surfaceType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-pitch-900 border border-white/10 text-white focus:outline-none focus:border-volt-400 text-xs"
                >
                  {SURFACE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Input
              label="Address / Location Details (Optional)"
              placeholder="e.g. Gate 2, Sports Complex Main Road"
              value={pitchForm.address}
              onChange={(e) => setPitchForm({ ...pitchForm, address: e.target.value })}
            />

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="pitchIsActive"
                checked={pitchForm.isActive}
                onChange={(e) => setPitchForm({ ...pitchForm, isActive: e.target.checked })}
                className="rounded border-white/10 text-volt-400 focus:ring-volt-400 bg-pitch-900 w-4 h-4"
              />
              <label htmlFor="pitchIsActive" className="text-xs text-slate-300 select-none cursor-pointer">
                Available for session scheduling
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setIsPitchModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingPitchId ? "Update Pitch" : "Add Pitch"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Pitch Confirmation Modal */}
      {pitchToDelete && (
        <ConfirmModal
          isOpen={!!pitchToDelete}
          title="Delete Pitch / Venue"
          message={`Are you sure you want to delete "${pitchToDelete.name}"? Past sessions that used this location will keep their record, but it will no longer appear in the session venue picker.`}
          confirmLabel="Delete Pitch"
          cancelLabel="Cancel"
          danger
          onConfirm={handleDeletePitch}
          onCancel={() => setPitchToDelete(null)}
        />
      )}
    </div>
  );
};

export default AcademySettingsPage;