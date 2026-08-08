// src/features/teams/TeamsPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Plus, Users, Trash2, Swords } from "lucide-react";
import { toast } from "react-hot-toast";
import { RootState } from "../../store";
import { Card, Button, Input, Modal, Badge, Skeleton, EmptyState, ImageUploadField } from "../../components/ui";
import { useCurrentFranchiseId } from "../../hooks/useCurrentFranchiseId";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import {
  useListTeamsQuery,
  useCreateTeamMutation,
  useDeleteTeamMutation,
  useGetTeamByIdQuery,
  useUpdateTeamMutation,
  type Team,
} from "../../store/api/teamsApi";
import { useGetUsersQuery } from "../../store/api/usersApi";
import { academyApi } from "../../store/api/academyApi";
import { useGetFranchisesQuery } from "../../store/api/franchiseApi";
import { useGetStudentsQuery, useUpdateStudentMutation } from "../../store/api/studentsApi";

const TeamsPage: React.FC = () => {
  const { user } = useSelector((s: RootState) => s.auth);
  const navigate = useNavigate();
  const franchiseId = useCurrentFranchiseId();
  const isHeadOffice = user?.role === 'manager' && !franchiseId;
  const academyId = useCurrentAcademyId();
  const { data: teams, isLoading, isError } = useListTeamsQuery(
    franchiseId ? { franchiseId } : { academyId: academyId ?? "" },
    { skip: !franchiseId && !academyId },
  );
  const { data: coachesResult } = useGetUsersQuery(
    { roles: "coach", academyId: academyId ?? "", isActive: "true", limit: 100 },
    { skip: !academyId },
  );
  const coaches = coachesResult?.data ?? [];
  const { data: academy } = academyApi.useGetAcademyByIdQuery(academyId ?? "", { skip: !academyId });
  const categoriesList = Array.from({ length: 21 }, (_, i) => `U-${i + 5}`);
  const categories = Array.from(new Set([...(academy?.ageGroups ?? []), ...categoriesList])).sort(
    (a, b) => parseInt(a.replace('U-', '')) - parseInt(b.replace('U-', ''))
  );
  const [createTeam, { isLoading: creating }] = useCreateTeamMutation();
  const [updateTeam] = useUpdateTeamMutation();
  const [deleteTeam] = useDeleteTeamMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [coachId, setCoachId] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(undefined);
  const [primaryColor, setPrimaryColor] = useState("#1f2937");
  const [secondaryColor, setSecondaryColor] = useState("#334155");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [brandingTeamId, setBrandingTeamId] = useState<string | null>(null);

  const resetCreateForm = () => {
    setName(""); setAgeGroup(""); setCoachId("");
    setLogoUrl(undefined); setBannerUrl(undefined);
    setPrimaryColor("#1f2937"); setSecondaryColor("#334155");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ageGroup) return;
    try {
      await createTeam({
        name,
        ageGroup,
        franchiseId: isHeadOffice ? undefined : franchiseId ?? undefined,
        academyId: isHeadOffice ? academyId ?? undefined : undefined,
        coachId: coachId || undefined,
        logoUrl,
        bannerUrl,
        primaryColor,
        secondaryColor,
      }).unwrap();
      toast.success("Team created");
      setShowCreate(false);
      resetCreateForm();
    } catch {
      toast.error("Couldn't create team — try again");
    }
  };

  const handleAssignCoach = async (teamId: string, newCoachId: string) => {
    try {
      await updateTeam({ id: teamId, body: { coachId: newCoachId || undefined } }).unwrap();
      toast.success(newCoachId ? "Coach assigned" : "Coach removed");
    } catch {
      toast.error("Couldn't update coach — try again");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTeam(id).unwrap();
      toast.success("Team removed");
    } catch {
      toast.error("Couldn't remove team — try again");
    }
  };

  if (!franchiseId && !isHeadOffice) {
    return (
      <EmptyState
        icon={<Users size={28} />}
        title="No franchise selected"
        description="Select a franchise from the top bar to manage teams."
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white uppercase tracking-wide">
            {isHeadOffice ? "Academy Teams" : "Teams"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isHeadOffice
              ? "All squads across all franchises of the academy"
              : "Batches and squads for this franchise"}
          </p>
        </div>
        {!isHeadOffice && (
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            New team
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState icon={<Users size={28} />} title="Couldn't load teams" description="Please try again shortly." />
      )}

      {teams && teams.length === 0 && (
        <EmptyState
          icon={<Users size={28} />}
          title="No teams yet"
          description="Create your first team to start assigning students and coaches."
          action={<Button onClick={() => setShowCreate(true)}>Create a team</Button>}
        />
      )}

      {teams && teams.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Card key={team.id} className="p-0 flex flex-col overflow-hidden">
              <div
                className="h-14 w-full relative"
                style={{ backgroundImage: `linear-gradient(135deg, ${team.primaryColor ?? "#1f2937"}, ${team.secondaryColor ?? "#334155"})` }}
              >
                {team.bannerUrl && (
                  <img src={team.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
                )}
              </div>
              <div className="p-5 flex flex-col flex-1 -mt-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {team.logoUrl ? (
                      <img
                        src={team.logoUrl}
                        alt={`${team.name} logo`}
                        className="w-12 h-12 rounded-lg object-cover border-2 border-pitch-900 bg-pitch-900 shrink-0"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-lg border-2 border-pitch-900 shrink-0 flex items-center justify-center"
                        style={{ backgroundImage: `linear-gradient(135deg, ${team.primaryColor ?? "#1f2937"}, ${team.secondaryColor ?? "#334155"})` }}
                      >
                        <Users size={18} className="text-white/70" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-display font-bold text-white uppercase tracking-wide leading-tight">{team.name}</h3>
                        {!team.franchiseId && (
                          <Badge variant="green" size="sm">GLOBAL</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="blue">{team.ageGroup}</Badge>
                        {team.franchise && (
                          <Badge variant="gray" size="sm">
                            {team.franchise.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {!isHeadOffice && (
                    <button
                      onClick={() => handleDelete(team.id)}
                      className="text-slate-500 hover:text-ember-400 transition-colors p-1"
                      aria-label="Delete team"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-3">
                  Coach: {team.coach ? `${team.coach.firstName} ${team.coach.lastName}` : "No coach assigned"}
                </p>
                {!isHeadOffice && (
                  <select
                    value={team.coach?._id ?? ""}
                    onChange={(e) => handleAssignCoach(team.id, e.target.value)}
                    className="input !w-full !text-xs mt-2"
                  >
                    <option value="">No coach assigned</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </select>
                )}
                <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs text-slate-500 font-mono">{team.studentCount} students</span>
                  <div className="flex items-center gap-3">
                    {!isHeadOffice && (
                      <button
                        onClick={() => setBrandingTeamId(team.id)}
                        className="text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedTeamId(team.id)}
                      className="text-xs text-volt-400 hover:text-volt-300 transition-colors"
                    >
                      View roster →
                    </button>
                    {!isHeadOffice && (
                      <button
                        onClick={() => navigate(`/teams/${team.id}/manage`)}
                        className="text-xs flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <Swords size={12} /> Manage team
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New team" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Team name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. U-15 Eagles" required />
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Age group
            </label>
            <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="input !w-full" required>
              <option value="" disabled>
                {categories.length === 0 ? "No categories set up yet" : "Select a category"}
              </option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-2xs text-slate-500 mt-1">Add categories from Settings first.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Coach (optional)
            </label>
            <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className="input !w-full">
              <option value="">Assign later</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ImageUploadField label="Team logo (optional)" category="team_logo" value={logoUrl} onChange={setLogoUrl} shape="square" />
            <ImageUploadField label="Team banner (optional)" category="team_banner" value={bannerUrl} onChange={setBannerUrl} shape="wide" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Team colors</label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-9 h-9 bg-transparent border border-white/10 rounded cursor-pointer" />
                <span className="text-2xs font-mono text-slate-400">{primaryColor}</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-9 h-9 bg-transparent border border-white/10 rounded cursor-pointer" />
                <span className="text-2xs font-mono text-slate-400">{secondaryColor}</span>
              </div>
              <div
                className="flex-1 h-9 rounded border border-white/10"
                style={{ backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
              />
            </div>
            <p className="text-2xs text-slate-500 mt-1.5">Used as the gradient theme across this team's pages.</p>
          </div>

          <Button type="submit" loading={creating} className="w-full">
            Create team
          </Button>
        </form>
      </Modal>

      {selectedTeamId && (
        <TeamRosterModal teamId={selectedTeamId} onClose={() => setSelectedTeamId(null)} />
      )}

      {brandingTeamId && (
        <TeamBrandingModal
          team={teams?.find((t) => t.id === brandingTeamId) ?? null}
          categories={categories}
          onClose={() => setBrandingTeamId(null)}
        />
      )}
    </div>
  );
};

const TeamRosterModal: React.FC<{ teamId: string; onClose: () => void }> = ({ teamId, onClose }) => {
  const { user } = useSelector((s: RootState) => s.auth);
  const activeFranchiseId = useCurrentFranchiseId();
  const isHeadOffice = user?.role === 'manager' && !activeFranchiseId;
  const currentAcademyId = useCurrentAcademyId();
  const { data: team, isLoading: teamLoading } = useGetTeamByIdQuery(teamId);
  const [updateStudent] = useUpdateStudentMutation();
  const { data: franchises } = useGetFranchisesQuery(
    currentAcademyId ? { academyId: currentAcademyId, isActive: true } : undefined,
    { skip: !currentAcademyId }
  );

  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedAgeGroup, setSelectedAgeGroup] = useState("");

  // Auto-select team's franchise initially
  React.useEffect(() => {
    if (team?.franchiseId && !selectedFranchiseId) {
      setSelectedFranchiseId(team.franchiseId);
    }
  }, [team]);

  const { data: studentsResult, isLoading: studentsLoading } = useGetStudentsQuery(
    {
      franchiseId: selectedFranchiseId,
      search: search || undefined,
      ageGroup: selectedAgeGroup || undefined,
      limit: 100,
    },
    { skip: !selectedFranchiseId || isHeadOffice }
  );
  const availableStudents = studentsResult?.items ?? [];
  const teamStudentIds = new Set(team?.students?.map((s) => s._id) ?? []);
  const filteredAvailable = availableStudents.filter((s) => !teamStudentIds.has(s.id));

  const handleRemove = async (studentId: string) => {
    try {
      await updateStudent({ id: studentId, data: { teamId: null } }).unwrap();
      toast.success("Player removed from team");
    } catch {
      toast.error("Couldn't remove player — try again");
    }
  };

  const handleAssign = async (studentId: string) => {
    try {
      await updateStudent({ id: studentId, data: { teamId } }).unwrap();
      toast.success("Player assigned to team");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't assign player — try again");
    }
  };

  const categoriesList = Array.from({ length: 21 }, (_, i) => `U-${i + 5}`);

  return (
    <Modal isOpen onClose={onClose} title={team ? (isHeadOffice ? `Roster — ${team.name}` : `Manage Roster — ${team.name}`) : "Team roster"} size={isHeadOffice ? "md" : "xl"}>
      {teamLoading && <Skeleton className="h-60" />}
      {team && (
        isHeadOffice ? (
          /* Head Office: Read-only View */
          <div className="flex flex-col h-[50vh] min-h-[350px]">
            <div className="mb-3">
              <h4 className="text-xs font-bold text-volt-400 uppercase tracking-wide">Current Players</h4>
              <p className="text-2xs text-slate-500 mt-0.5">{team.students.length} players assigned</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {team.students.length === 0 ? (
                <div className="h-full flex items-center justify-center border border-dashed border-white/5 rounded-lg p-5">
                  <p className="text-xs text-slate-500 text-center italic">No players assigned to this team.</p>
                </div>
              ) : (
                team.students.map((s) => (
                  <div key={s._id} className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border border-white/5 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{s.firstName} {s.lastName}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {s.position || "No position set"} · {s.attendancePercentage}% attendance
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Franchise Level: Full interactive roster management */
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 h-[55vh] min-h-[400px]">
            
            {/* LEFT: Current Team Roster (2/5 width) */}
            <div className="md:col-span-2 flex flex-col h-full border-r border-white/5 pr-4">
              <div className="mb-3">
                <h4 className="text-xs font-bold text-volt-400 uppercase tracking-wide">Current Roster</h4>
                <p className="text-2xs text-slate-500 mt-0.5">{team.students.length} players assigned</p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {team.students.length === 0 ? (
                  <div className="h-full flex items-center justify-center border border-dashed border-white/5 rounded-lg p-5">
                    <p className="text-xs text-slate-500 text-center italic">No players assigned. Use the panel on the right to add players.</p>
                  </div>
                ) : (
                  team.students.map((s) => (
                    <div key={s._id} className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border border-white/5 rounded-lg hover:border-white/10 transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{s.firstName} {s.lastName}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{s.attendancePercentage}% attendance</p>
                      </div>
                      <button
                        onClick={() => handleRemove(s._id)}
                        className="text-slate-500 hover:text-ember-400 transition-colors p-1"
                        title="Remove player"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: Add/Transfer Players (3/5 width) */}
            <div className="md:col-span-3 flex flex-col h-full pl-2">
              <div className="mb-3 space-y-2">
                <h4 className="text-xs font-bold text-volt-400 uppercase tracking-wide">Available Players</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <select
                      value={selectedFranchiseId}
                      onChange={(e) => setSelectedFranchiseId(e.target.value)}
                      className="input !text-[11px] !py-1 !px-2 !w-full"
                    >
                      <option value="" disabled>Select Franchise</option>
                      {(franchises ?? []).map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <select
                      value={selectedAgeGroup}
                      onChange={(e) => setSelectedAgeGroup(e.target.value)}
                      className="input !text-[11px] !py-1 !px-2 !w-full"
                    >
                      <option value="">All Ages</option>
                      {categoriesList.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <input
                      type="text"
                      placeholder="Search name..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="input !text-[11px] !py-1 !px-2 !w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {studentsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                  </div>
                ) : filteredAvailable.length === 0 ? (
                  <div className="h-full flex items-center justify-center border border-dashed border-white/5 rounded-lg p-5">
                    <p className="text-xs text-slate-500 text-center italic">No available players match filters.</p>
                  </div>
                ) : (
                  filteredAvailable.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2.5 bg-white/[0.01] border border-white/5 rounded-lg hover:border-white/10 transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{s.firstName} {s.lastName}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {s.ageGroup} · {s.teamId ? "Already on a team" : "Unassigned"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAssign(s.id)}
                        className="px-2.5 py-1 rounded bg-volt-400 hover:bg-volt-300 text-pitch-900 text-[10px] font-bold uppercase transition-all"
                      >
                        {s.teamId ? "Transfer" : "Assign"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )
      )}
    </Modal>
  );
};

export default TeamsPage;

const TeamBrandingModal: React.FC<{ team: Team | null; categories: string[]; onClose: () => void }> = ({
  team,
  categories,
  onClose,
}) => {
  const [updateTeam, { isLoading: saving }] = useUpdateTeamMutation();
  const [name, setName] = useState(team?.name ?? "");
  const [ageGroup, setAgeGroup] = useState(team?.ageGroup ?? "");
  const [logoUrl, setLogoUrl] = useState(team?.logoUrl);
  const [bannerUrl, setBannerUrl] = useState(team?.bannerUrl);
  const [primaryColor, setPrimaryColor] = useState(team?.primaryColor ?? "#1f2937");
  const [secondaryColor, setSecondaryColor] = useState(team?.secondaryColor ?? "#334155");

  if (!team) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Team name can't be empty");
      return;
    }
    if (!ageGroup) {
      toast.error("Select an age category");
      return;
    }
    try {
      await updateTeam({
        id: team.id,
        body: { name: name.trim(), ageGroup, logoUrl, bannerUrl, primaryColor, secondaryColor },
      }).unwrap();
      toast.success("Team updated");
      onClose();
    } catch {
      toast.error("Couldn't update team — try again");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Edit ${team.name}`} size="md">
      <div className="space-y-4">
        <Input label="Team name" value={name} onChange={(e) => setName(e.target.value)} required />
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Age group
          </label>
          <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="input !w-full">
            <option value="" disabled>
              Select a category
            </option>
            {/* The team's current category is always offered even if it was
                since removed from academy settings, so switching away is
                the only way to lose it — never a silent forced blank. */}
            {(categories.includes(ageGroup) ? categories : [ageGroup, ...categories]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ImageUploadField label="Team logo" category="team_logo" value={logoUrl} onChange={setLogoUrl} shape="square" />
          <ImageUploadField label="Team banner" category="team_banner" value={bannerUrl} onChange={setBannerUrl} shape="wide" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Team colors</label>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-9 h-9 bg-transparent border border-white/10 rounded cursor-pointer" />
              <span className="text-2xs font-mono text-slate-400">{primaryColor}</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-9 h-9 bg-transparent border border-white/10 rounded cursor-pointer" />
              <span className="text-2xs font-mono text-slate-400">{secondaryColor}</span>
            </div>
            <div
              className="flex-1 h-9 rounded border border-white/10"
              style={{ backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
            />
          </div>
        </div>
        <Button loading={saving} onClick={handleSave} className="w-full">Save changes</Button>
      </div>
    </Modal>
  );
};