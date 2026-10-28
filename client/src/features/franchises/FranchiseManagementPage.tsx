// src/features/franchises/FranchiseManagementPage.tsx
import React, { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Building2, Plus, Power, Trash2, ListChecks, X, Pencil, LayoutDashboard, Users, Calendar, CalendarDays, Clock, MapPin, Layers } from "lucide-react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { setActiveFranchise } from "../../store/slices/uiSlice";
import { Button, Input, Badge, Modal, Skeleton, EmptyState, PageHeader, Select, LocationPicker } from "../../components/ui";
import { RootState } from "../../store";
import { useCurrentFranchiseId } from "../../hooks/useCurrentFranchiseId";
import { useConfirm } from "../../hooks/useConfirm";
import { academyApi } from "../../store/api/academyApi";
import {
  useGetFranchisesQuery,
  useGetFranchiseByIdQuery,
  useCreateFranchiseMutation,
  useUpdateFranchiseMutation,
  useToggleFranchiseActiveMutation,
  useDeleteFranchiseMutation,
  type Franchise,
} from "../../store/api/franchiseApi";
import { useGetAcademySubscriptionStatusQuery } from "../../store/api/academySubscriptionApi";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatBranchSchedule(sessionTimes?: { dayOfWeek: number; startTime: string; endTime: string }[]) {
  if (!sessionTimes || sessionTimes.length === 0) return null;
  const sorted = [...sessionTimes].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const uniqueDays = Array.from(new Set(sorted.map((s) => DAY_NAMES[s.dayOfWeek]))).join(", ");
  const time = sorted[0]?.startTime && sorted[0]?.endTime ? `${sorted[0].startTime} - ${sorted[0].endTime}` : null;
  return { days: uniqueDays, time };
}

const FranchiseManagementPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();
  const { user } = useSelector((s: RootState) => s.auth);
  const isSuperAdmin = user?.role === "super_admin";
  const isHeadOfficeRole = isSuperAdmin || ((user?.role === "manager" || user?.role === "operational_manager") && !user?.franchiseId);

  // Manager: resolve their own academy via their user record, fallback to current franchise.
  const currentFranchiseId = useCurrentFranchiseId();
  const { data: currentFranchise } = useGetFranchiseByIdQuery(currentFranchiseId ?? "", {
    skip: !currentFranchiseId || isSuperAdmin,
  });

  const canCreateFranchise = isHeadOfficeRole;

  // Super admin: pick any academy from a dropdown.
  const { data: academiesResult } = academyApi.useGetAcademiesQuery(
    { isActive: true, limit: 100 },
    { skip: !isSuperAdmin },
  );
  const academies = academiesResult?.data ?? [];
  const [selectedAcademyId, setSelectedAcademyId] = useState("");

  const activeAcademyId = isSuperAdmin ? selectedAcademyId : (user?.academyId || currentFranchise?.academyId);

  const { data: franchises, isLoading, isError } = useGetFranchisesQuery(
    activeAcademyId ? { academyId: activeAcademyId } : undefined,
    { skip: !activeAcademyId },
  );

  const { data: subStatus } = useGetAcademySubscriptionStatusQuery(activeAcademyId ?? "", {
    skip: !activeAcademyId,
  });

  const [createFranchise, { isLoading: creating }] = useCreateFranchiseMutation();
  const [toggleActive] = useToggleFranchiseActiveMutation();
  const [deleteFranchise] = useDeleteFranchiseMutation();
  const [showCreate, setShowCreate] = useState(false);
  const [detailsFranchise, setDetailsFranchise] = useState<Franchise | null>(null);

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await toggleActive(id).unwrap();
      toast.success(isActive ? "Branch deactivated" : "Branch activated");
    } catch {
      toast.error("Couldn't update branch — try again");
    }
  };

  const handleDelete = async (f: Franchise) => {
    if (!activeAcademyId) return;
    const ok = await confirm({
      title: "Remove branch",
      message: `Remove "${f.name}"? This cannot be undone.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteFranchise({ id: f.id, academyId: activeAcademyId }).unwrap();
      toast.success("Branch removed");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't remove branch — try again");
    }
  };

  // Drill into this franchise's own dashboard — the only place a
  // franchise-specific view now lives (the top bar no longer carries a
  // franchise switcher on this page or on /dashboard).
  const handleViewDashboard = (f: Franchise) => {
    dispatch(setActiveFranchise(f.id));
    navigate(`/franchises/${f.id}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Structure"
        title="Branches"
        subtitle={
          isSuperAdmin
            ? "Manage the operational branches under any academy"
            : "Manage the branches under your academy"
        }
        actions={
          activeAcademyId && canCreateFranchise ? (
            <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)} className="w-full sm:w-auto">New branch</Button>
          ) : undefined
        }
      />

      {isSuperAdmin && (
        <div className="card p-4 flex items-end gap-3">
          <div className="w-full sm:w-64">
            <Select label="Academy" value={selectedAcademyId} onChange={(e) => setSelectedAcademyId(e.target.value)}>
              <option value="">Select an academy…</option>
              {academies.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {!activeAcademyId && (
        <EmptyState
          icon={<Building2 size={28} />}
          title={isSuperAdmin ? "Select an academy" : "No academy found"}
          description={isSuperAdmin ? "Choose an academy above to see its branches." : "Your account isn't linked to an academy yet."}
        />
      )}

      {activeAcademyId && isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      )}



      {activeAcademyId && isError && (
        <EmptyState title="Couldn't load branches" description="Please try again shortly." />
      )}

      {activeAcademyId && !isLoading && franchises?.length === 0 && (
        <EmptyState
          icon={<Building2 size={28} />}
          title="No branches yet"
          description="Every academy needs at least one branch for students, teams, and sessions to belong to."
          action={canCreateFranchise ? <Button onClick={() => setShowCreate(true)}>Create branch</Button> : undefined}
        />
      )}

      {activeAcademyId && !isLoading && franchises && franchises.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {franchises.map((f) => (
            <div
              key={f.id}
              className="card p-5 flex flex-col justify-between hover:border-volt-500/40 dark:hover:border-volt-400/30 transition-all duration-200"
            >
              <div className="space-y-3">
                {/* Branch Header & Code */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-bold text-slate-900 dark:text-white text-base truncate">
                        {f.name}
                      </p>
                      {f.franchiseCode && (
                        <span className="font-mono text-3xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 shrink-0">
                          {f.franchiseCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <MapPin size={13} className="shrink-0 text-slate-400" />
                      <span className="truncate">{f.location?.name || f.location?.address || "Location unassigned"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setDetailsFranchise(f)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                      title="Edit branch details"
                      aria-label="Edit branch"
                    >
                      <Pencil size={13} />
                    </button>
                    <Badge variant={f.isActive ? "green" : "gray"} size="sm">
                      {f.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                {/* Core Metrics: Players & Batches */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-pitch-800/60 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-3xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <Users size={12} className="text-volt-500 shrink-0" />
                      <span>Total Players</span>
                    </div>
                    <p className="text-base font-display font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {f.totalStudents ?? 0}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-pitch-800/60 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-3xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <Layers size={12} className="text-sky-500 shrink-0" />
                      <span>Active Batches</span>
                    </div>
                    <p className="text-base font-display font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {f.batches?.length || f.ageGroups?.length || 0}
                    </p>
                  </div>
                </div>

                {/* Active Batches / Age Groups */}
                {f.batches && f.batches.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {f.batches.slice(0, 5).map((b) => (
                      <span
                        key={b.ageGroup}
                        className="px-2 py-0.5 rounded-md text-3xs font-semibold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 flex items-center gap-1"
                      >
                        <span className="font-bold text-volt-600 dark:text-volt-400">{b.ageGroup}</span>
                        <span className="text-slate-400 font-normal">({b.count})</span>
                      </span>
                    ))}
                    {f.batches.length > 5 && (
                      <span className="px-1.5 py-0.5 text-3xs text-slate-400 font-medium">
                        +{f.batches.length - 5} more
                      </span>
                    )}
                  </div>
                ) : f.ageGroups && f.ageGroups.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {f.ageGroups.slice(0, 5).map((ag) => (
                      <span
                        key={ag}
                        className="px-2 py-0.5 rounded-md text-3xs font-semibold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10"
                      >
                        {ag}
                      </span>
                    ))}
                    {f.ageGroups.length > 5 && (
                      <span className="px-1.5 py-0.5 text-3xs text-slate-400 font-medium">
                        +{f.ageGroups.length - 5} more
                      </span>
                    )}
                  </div>
                ) : null}

                {/* Regular Operating Schedule */}
                {(() => {
                  const sched = formatBranchSchedule(f.sessionTimes);
                  return (
                    <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-slate-400 py-0.5">
                      <Clock size={12} className="shrink-0 text-slate-400 dark:text-slate-500" />
                      <span className="truncate">
                        {sched ? (
                          <>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{sched.days}</span>
                            {sched.time && <span className="font-mono text-3xs ml-1 text-slate-400">({sched.time})</span>}
                          </>
                        ) : (
                          "Schedule not set"
                        )}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Actions & Footer */}
              <div className="space-y-3 pt-3 mt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleViewDashboard(f)}
                    className="flex items-center justify-center gap-1.5 text-xs font-semibold text-pitch-900 bg-volt-400 hover:bg-volt-300 rounded-lg px-3 py-2 transition-colors shadow-xs"
                  >
                    <LayoutDashboard size={13} />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => {
                      dispatch(setActiveFranchise(f.id));
                      navigate(`/schedule?franchiseId=${f.id}`);
                    }}
                    className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-pitch-800 dark:hover:bg-pitch-700 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 transition-colors"
                  >
                    <CalendarDays size={13} />
                    <span>Schedule</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
                  <button
                    onClick={() => handleToggle(f.id, f.isActive)}
                    className={clsx(
                      "flex items-center gap-1.5 font-medium transition-colors",
                      f.isActive
                        ? "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                        : "text-emerald-600 dark:text-field-400 hover:text-emerald-500",
                    )}
                  >
                    <Power size={12} />
                    <span>{f.isActive ? "Deactivate" : "Activate"}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(f)}
                    className="flex items-center gap-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={12} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {ConfirmDialog}

      {showCreate && activeAcademyId && (
        <CreateFranchiseModal
          academyId={activeAcademyId}
          onClose={() => setShowCreate(false)}
          creating={creating}
          onCreate={async (body) => {
            try {
              await createFranchise(body).unwrap();
              toast.success("Branch created");
              setShowCreate(false);
            } catch (err: any) {
              toast.error(err?.data?.message || "Couldn't create branch — try again");
            }
          }}
        />
      )}

      {detailsFranchise && (
        <FranchiseDetailsModal
          franchise={detailsFranchise}
          onClose={() => setDetailsFranchise(null)}
        />
      )}
    </div>
  );
};

const CreateFranchiseModal: React.FC<{
  academyId: string;
  onClose: () => void;
  creating: boolean;
  onCreate: (body: {
    academyId: string;
    name: string;
    location: { name: string; address: string; latitude: number; longitude: number; fieldNumber?: string };
  }) => void;
}> = ({ academyId, onClose, creating, onCreate }) => {
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !locationName.trim() || !address.trim()) {
      toast.error("Fill in all required fields");
      return;
    }
    onCreate({
      academyId,
      name: name.trim(),
      location: {
        name: locationName.trim(),
        address: address.trim(),
        latitude,
        longitude,
      },
    });
  };

  return (
    <Modal isOpen onClose={onClose} title="New branch" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Branch name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Downtown Branch" required />
        <Input label="Location name" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g. Downtown Sports Complex" required />
        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" required />
        <LocationPicker
          latitude={latitude}
          longitude={longitude}
          onChange={({ latitude: lat, longitude: lng }) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
        />
        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1" loading={creating}>Create branch</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
};

const FranchiseDetailsModal: React.FC<{
  franchise: Franchise;
  onClose: () => void;
}> = ({ franchise, onClose }) => {
  const [updateFranchise, { isLoading }] = useUpdateFranchiseMutation();
  const [name, setName] = useState(franchise.name);
  const [locationName, setLocationName] = useState(franchise.location?.name ?? "");
  const [address, setAddress] = useState(franchise.location?.address ?? "");
  const [latitude, setLatitude] = useState<number>(franchise.location?.latitude ?? 0);
  const [longitude, setLongitude] = useState<number>(franchise.location?.longitude ?? 0);
  const [fieldNumber, setFieldNumber] = useState(franchise.location?.fieldNumber ?? "");

  const initialDays = Array.from(new Set((franchise.sessionTimes ?? []).map((s) => s.dayOfWeek)));
  const [selectedDays, setSelectedDays] = useState<number[]>(initialDays);
  const [startTime, setStartTime] = useState(franchise.sessionTimes?.[0]?.startTime ?? "16:00");
  const [endTime, setEndTime] = useState(franchise.sessionTimes?.[0]?.endTime ?? "17:30");

  const handleSave = async () => {
    if (!name.trim() || !locationName.trim() || !address.trim()) {
      toast.error("Fill in all required fields");
      return;
    }

    const sessionTimes = selectedDays.map((dayOfWeek) => ({
      dayOfWeek,
      startTime: startTime || "16:00",
      endTime: endTime || "17:30",
    }));

    try {
      await updateFranchise({
        id: franchise.id,
        data: {
          name: name.trim(),
          location: {
            name: locationName.trim(),
            address: address.trim(),
            latitude,
            longitude,
            fieldNumber: fieldNumber.trim() || undefined,
          },
          sessionTimes,
        },
      }).unwrap();
      toast.success("Branch details & training schedule updated");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update branch — try again");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Edit ${franchise.name}`} size="md">
      <div className="space-y-4">
        <Input label="Branch name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Location name" value={locationName} onChange={(e) => setLocationName(e.target.value)} required />
        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} required />
        <LocationPicker
          latitude={latitude}
          longitude={longitude}
          onChange={({ latitude: lat, longitude: lng }) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
        />
        <Input label="Field number (optional)" value={fieldNumber} onChange={(e) => setFieldNumber(e.target.value)} />

        {/* Regular Training Days & Timings */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
          <label className="label">Regular Training Days</label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 1, label: "Mon" },
              { id: 2, label: "Tue" },
              { id: 3, label: "Wed" },
              { id: 4, label: "Thu" },
              { id: 5, label: "Fri" },
              { id: 6, label: "Sat" },
              { id: 0, label: "Sun" },
            ].map((d) => {
              const active = selectedDays.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() =>
                    setSelectedDays((prev) =>
                      active ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                    )
                  }
                  className={clsx(
                    "px-3 py-1 text-xs font-semibold rounded-md border transition-all",
                    active
                      ? "bg-volt-400 text-pitch-900 border-volt-400 font-bold"
                      : "bg-slate-50 dark:bg-pitch-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-300"
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <p className="text-3xs text-slate-400">Click to toggle the days this branch holds training sessions.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Training Start Time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="Training End Time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button loading={isLoading} onClick={handleSave} className="flex-1">Save changes</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
};

export default FranchiseManagementPage;