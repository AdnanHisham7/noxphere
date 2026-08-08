// src/features/coaches/CoachesManagementPage.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import { UserCog, Plus, KeyRound, Power, Search, Pencil, Clock, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button, Input, Badge, Avatar, Modal, Skeleton, EmptyState } from "../../components/ui";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import { useListTeamsQuery } from "../../store/api/teamsApi";
import { useGetFranchisesQuery } from "../../store/api/franchiseApi";
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useToggleUserActiveMutation,
  useResetUserPasswordMutation,
  type ManagedUser,
} from "../../store/api/usersApi";

const CoachesManagementPage: React.FC = () => {
  const academyId = useCurrentAcademyId();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{ id: string; name: string } | null>(null);
  const [editingCoach, setEditingCoach] = useState<ManagedUser | null>(null);
  const [availabilityModalCoach, setAvailabilityModalCoach] = useState<ManagedUser | null>(null);

  const { data: coachesResult, isLoading, isError } = useGetUsersQuery(
    { roles: "coach", academyId: academyId ?? "", search: search || undefined, limit: 100 },
    { skip: !academyId },
  );
  const coaches = coachesResult?.data ?? [];

  const { data: teams } = useListTeamsQuery({ academyId: academyId ?? "" }, { skip: !academyId });
  const { data: franchises } = useGetFranchisesQuery(
    academyId ? { academyId, isActive: true } : undefined,
    { skip: !academyId }
  );

  const teamsByCoach = new Map<string, string[]>();
  for (const t of teams ?? []) {
    if (!t.coach?._id) continue;
    const list = teamsByCoach.get(t.coach._id) ?? [];
    list.push(t.name);
    teamsByCoach.set(t.coach._id, list);
  }

  const franchiseMap = new Map<string, string>();
  for (const f of franchises ?? []) {
    franchiseMap.set(f.id, f.name);
  }

  const [createCoach, { isLoading: creating }] = useCreateUserMutation();
  const [toggleActive] = useToggleUserActiveMutation();
  const [resetPassword, { isLoading: resetting }] = useResetUserPasswordMutation();

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await toggleActive(id).unwrap();
      toast.success(isActive ? "Coach deactivated" : "Coach activated");
    } catch {
      toast.error("Couldn't update coach — try again");
    }
  };

  if (!academyId) {
    return (
      <EmptyState
        icon={<UserCog size={28} />}
        title="No franchise selected"
        description="Select a franchise from the top bar to manage coaches."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="section-title mb-1">Staff</p>
          <h1 className="font-display font-extrabold text-white text-2xl uppercase tracking-tight">Coaches</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isLoading ? "Loading…" : `${coachesResult?.total ?? 0} coaches in this academy`}
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>New coach</Button>
      </div>

      <div className="card p-4">
        <Input
          placeholder="Search coaches..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      )}

      {isError && <EmptyState title="Couldn't load coaches" description="Please try again shortly." />}

      {!isLoading && coaches.length === 0 && (
        <EmptyState
          icon={<UserCog size={28} />}
          title="No coaches yet"
          description="Add a coach account, then assign them to a team from the Teams page."
          action={<Button onClick={() => setShowCreate(true)}>New coach</Button>}
        />
      )}

      {!isLoading && coaches.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coaches.map((c) => {
            const teamNames = teamsByCoach.get(c.id) ?? [];
            return (
              <div key={c.id} className="card p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={`${c.firstName} ${c.lastName}`} size="md" />
                    <div className="min-w-0">
                      <p className="font-display font-bold text-white truncate">{c.firstName} {c.lastName}</p>
                      <p className="text-2xs text-slate-500 truncate">{c.email}</p>
                    </div>
                  </div>
                  <Badge variant={c.isActive ? "green" : "gray"} size="sm">{c.isActive ? "Active" : "Inactive"}</Badge>
                </div>

                <div>
                  <p className="text-2xs text-slate-500 uppercase tracking-wide mb-1">Franchise Assignment</p>
                  {c.franchiseId && franchiseMap.has(c.franchiseId) ? (
                    <span className="pill-blue text-2xs bg-emerald-950/80 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider font-semibold">
                      In-Charge: {franchiseMap.get(c.franchiseId)}
                    </span>
                  ) : (
                    <p className="text-xs text-slate-500 italic">General Coach (Not in-charge)</p>
                  )}
                </div>

                <div>
                  <p className="text-2xs text-slate-500 uppercase tracking-wide mb-1">Assigned teams</p>
                  {teamNames.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      No team yet — <Link to="/teams" className="text-volt-400 hover:underline">assign one →</Link>
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {teamNames.map((n) => (
                        <span key={n} className="pill-blue text-2xs">{n}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                  <button
                    onClick={() => setEditingCoach(c)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={() => setAvailabilityModalCoach(c)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-volt-400 transition-colors"
                    title="Manage Availability"
                  >
                    <Clock size={13} /> Availability
                  </button>
                  <button
                    onClick={() => setPasswordModal({ id: c.id, name: `${c.firstName} ${c.lastName}` })}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-ice-400 transition-colors"
                  >
                    <KeyRound size={13} /> Reset
                  </button>
                  <button
                    onClick={() => handleToggle(c.id, c.isActive)}
                    className={clsx("flex items-center gap-1.5 text-xs transition-colors ml-auto", c.isActive ? "text-slate-400 hover:text-volt-400" : "text-field-400 hover:text-field-300")}
                  >
                    <Power size={13} /> {c.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateCoachModal
          franchises={franchises ?? []}
          onClose={() => setShowCreate(false)}
          creating={creating}
          onCreate={async (body) => {
            try {
              await createCoach(body).unwrap();
              toast.success("Coach created — assign them to a team from the Teams page");
              setShowCreate(false);
            } catch (err: any) {
              toast.error(err?.data?.message || "Couldn't create coach — try again");
            }
          }}
        />
      )}

      {passwordModal && (
        <Modal isOpen onClose={() => setPasswordModal(null)} title={`Reset password — ${passwordModal.name}`} size="sm">
          <ResetPasswordForm
            saving={resetting}
            onSave={async (newPassword) => {
              try {
                await resetPassword({ id: passwordModal.id, newPassword }).unwrap();
                toast.success("Password reset");
                setPasswordModal(null);
              } catch (err: any) {
                toast.error(err?.data?.message || "Couldn't reset password — try again");
              }
            }}
          />
        </Modal>
      )}

      {editingCoach && (
        <EditCoachModal coach={editingCoach} franchises={franchises ?? []} onClose={() => setEditingCoach(null)} />
      )}
 
      {availabilityModalCoach && (
        <AvailabilityModal coach={availabilityModalCoach} onClose={() => setAvailabilityModalCoach(null)} />
      )}
    </div>
  );
};

const EditCoachModal: React.FC<{ coach: ManagedUser; franchises: any[]; onClose: () => void }> = ({ coach, franchises, onClose }) => {
  const [updateUser, { isLoading: saving }] = useUpdateUserMutation();
  const [firstName, setFirstName] = useState(coach.firstName);
  const [lastName, setLastName] = useState(coach.lastName);
  const [phone, setPhone] = useState(coach.phone ?? "");
  const [franchiseId, setFranchiseId] = useState(coach.franchiseId ?? "");

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    try {
      await updateUser({
        id: coach.id,
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          franchiseId: franchiseId,
        },
      }).unwrap();
      toast.success("Coach details updated");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update coach — try again");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Edit ${coach.firstName} ${coach.lastName}`} size="sm">
      <div className="space-y-4">
        <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Franchise in-charge (Optional)
          </label>
          <select
            value={franchiseId}
            onChange={(e) => setFranchiseId(e.target.value)}
            className="input !w-full"
          >
            <option value="">No franchise assigned (General Coach)</option>
            {franchises.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <Button loading={saving} onClick={handleSave} className="flex-1">Save changes</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
};

const CreateCoachModal: React.FC<{
  franchises: any[];
  onClose: () => void;
  creating: boolean;
  onCreate: (body: { email: string; password: string; role: "coach"; firstName: string; lastName: string; phone: string; franchiseId?: string }) => void;
}> = ({ franchises, onClose, creating, onCreate }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [franchiseId, setFranchiseId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !phone.trim() || password.length < 8) {
      toast.error("Fill in all required fields (password min. 8 characters)");
      return;
    }
    onCreate({
      email,
      password,
      role: "coach",
      firstName,
      lastName,
      phone: phone.trim(),
      franchiseId: franchiseId || undefined,
    });
  };

  return (
    <Modal isOpen onClose={onClose} title="New coach" size="md">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        <div className="sm:col-span-2">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <Input label="Temporary password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required />
        <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Franchise in-charge (Optional)
          </label>
          <select
            value={franchiseId}
            onChange={(e) => setFranchiseId(e.target.value)}
            className="input !w-full"
          >
            <option value="">No franchise assigned (General Coach)</option>
            {franchises.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <p className="text-2xs text-slate-500 mt-1">
            If selected, this coach will be marked as in-charge of the chosen franchise.
          </p>
        </div>

        <div className="sm:col-span-2 flex gap-3 pt-2">
          <Button type="submit" className="flex-1" loading={creating}>Create coach</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
};

const ResetPasswordForm: React.FC<{ saving: boolean; onSave: (password: string) => void }> = ({ saving, onSave }) => {
  const [password, setPassword] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (password.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }
        onSave(password);
      }}
      className="space-y-4"
    >
      <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required />
      <Button type="submit" loading={saving} className="w-full">Reset password</Button>
    </form>
  );
};

const AvailabilityModal: React.FC<{ coach: ManagedUser; onClose: () => void }> = ({ coach, onClose }) => {
  const [updateUser, { isLoading: saving }] = useUpdateUserMutation();
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  const [weeklyActive, setWeeklyActive] = useState<Record<number, boolean>>(() => {
    const active: Record<number, boolean> = {};
    for (let i = 0; i < 7; i++) {
      active[i] = !!coach.weeklyAvailability?.some((wa) => wa.dayOfWeek === i);
    }
    return active;
  });

  const [weeklyTimes, setWeeklyTimes] = useState<Record<number, { startTime: string; endTime: string }>>(() => {
    const times: Record<number, { startTime: string; endTime: string }> = {};
    for (let i = 0; i < 7; i++) {
      const match = coach.weeklyAvailability?.find((wa) => wa.dayOfWeek === i);
      times[i] = {
        startTime: match?.startTime || "09:00",
        endTime: match?.endTime || "17:00",
      };
    }
    return times;
  });

  const [unavailableDates, setUnavailableDates] = useState<string[]>(coach.customUnavailableDates || []);
  const [newDate, setNewDate] = useState("");

  const handleAddDate = () => {
    if (!newDate) return;
    if (unavailableDates.includes(newDate)) {
      toast.error("Date already added");
      return;
    }
    setUnavailableDates([...unavailableDates, newDate].sort());
    setNewDate("");
  };

  const handleRemoveDate = (dateToRemove: string) => {
    setUnavailableDates(unavailableDates.filter((d) => d !== dateToRemove));
  };

  const handleSave = async () => {
    const weeklyAvailability = Object.keys(weeklyActive)
      .map(Number)
      .filter((day) => weeklyActive[day])
      .map((day) => ({
        dayOfWeek: day,
        startTime: weeklyTimes[day].startTime,
        endTime: weeklyTimes[day].endTime,
      }));

    try {
      await updateUser({
        id: coach.id,
        data: {
          weeklyAvailability,
          customUnavailableDates: unavailableDates,
        },
      }).unwrap();
      toast.success("Coach availability saved");
      onClose();
    } catch {
      toast.error("Couldn't save availability — try again");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Availability — ${coach.firstName} ${coach.lastName}`} size="md">
      <div className="space-y-5 text-xs max-h-[75vh] overflow-y-auto pr-2 no-scrollbar">
        
        {/* Weekly Day/Time Fields */}
        <div>
          <h4 className="text-2xs font-bold text-volt-400 uppercase tracking-wider mb-2">Weekly Schedule</h4>
          <div className="space-y-2">
            {DAYS.map((dayName, idx) => {
              const isActive = weeklyActive[idx];
              return (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setWeeklyActive({ ...weeklyActive, [idx]: e.target.checked })}
                      className="rounded border-white/10 text-volt-400 focus:ring-volt-400 bg-pitch-900 h-4 w-4"
                    />
                    <span className="font-semibold text-white w-20 text-[11px]">{dayName}</span>
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={weeklyTimes[idx].startTime}
                        onChange={(e) =>
                          setWeeklyTimes({
                            ...weeklyTimes,
                            [idx]: { ...weeklyTimes[idx], startTime: e.target.value },
                          })
                        }
                        className="bg-pitch-900 border border-white/10 rounded px-2 py-1 text-white focus:outline-none text-[11px]"
                      />
                      <span className="text-slate-500">—</span>
                      <input
                        type="time"
                        value={weeklyTimes[idx].endTime}
                        onChange={(e) =>
                          setWeeklyTimes({
                            ...weeklyTimes,
                            [idx]: { ...weeklyTimes[idx], endTime: e.target.value },
                          })
                        }
                        className="bg-pitch-900 border border-white/10 rounded px-2 py-1 text-white focus:outline-none text-[11px]"
                      />
                    </div>
                  )}
                  {!isActive && <span className="text-2xs text-slate-500 italic">Unavailable</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Unavailable Dates */}
        <div className="border-t border-white/5 pt-4">
          <h4 className="text-2xs font-bold text-volt-400 uppercase tracking-wider mb-2">Custom Unavailable Dates</h4>
          <p className="text-2xs text-slate-500 mb-2">Add specific calendar dates when this coach is unavailable.</p>
          <div className="flex gap-2">
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="flex-1" />
            <Button type="button" onClick={handleAddDate} className="text-xs bg-slate-800 text-white hover:bg-slate-700">
              Add Date
            </Button>
          </div>
          {unavailableDates.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5 border border-white/5 rounded p-2 bg-pitch-900/50 max-h-24 overflow-y-auto">
              {unavailableDates.map((dateStr) => (
                <div key={dateStr} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] text-slate-300">
                  <span>{new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  <button type="button" onClick={() => handleRemoveDate(dateStr)} className="text-slate-500 hover:text-ember-400 transition-colors">
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-3 border-t border-white/5">
          <Button loading={saving} onClick={handleSave} className="flex-1 bg-volt-400 hover:bg-volt-300 text-pitch-900 font-bold uppercase py-2">
            Save Availability
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>

      </div>
    </Modal>
  );
};

export default CoachesManagementPage;
