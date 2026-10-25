// src/features/teams/TeamsPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Plus, Users, Trash2, Swords, FileSpreadsheet } from "lucide-react";
import { toast } from "react-hot-toast";
import { RootState } from "../../store";
import { TeamReportModal } from "./TeamReportModal";
import {
  Card,
  Button,
  Input,
  Modal,
  Badge,
  Skeleton,
  EmptyState,
  ImageUploadField,
  PageHeader,
  Select,
} from "../../components/ui";
import { useCurrentFranchiseId } from "../../hooks/useCurrentFranchiseId";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import {
  useListTeamsQuery,
  useCreateTeamMutation,
  useDeleteTeamMutation,
  useGetTeamByIdQuery,
  useUpdateTeamMutation,
  useAddStudentToTeamMutation,
  useRemoveStudentFromTeamMutation,
  type Team,
} from "../../store/api/teamsApi";
import { useGetUsersQuery } from "../../store/api/usersApi";
import { academyApi } from "../../store/api/academyApi";
import { useGetFranchisesQuery } from "../../store/api/franchiseApi";
import {
  useGetStudentsQuery,
  useUpdateStudentMutation,
  useGetAgeCategoriesQuery,
} from "../../store/api/studentsApi";
import { useConfirm } from "../../hooks/useConfirm";

const TeamsPage: React.FC = () => {
  const { user } = useSelector((s: RootState) => s.auth);
  const navigate = useNavigate();
  const franchiseId = useCurrentFranchiseId();
  const academyId = useCurrentAcademyId();
  const canManage =
    user?.role === "manager" ||
    user?.role === "operational_manager" ||
    user?.role === "super_admin";

  const {
    data: teams,
    isLoading,
    isError,
  } = useListTeamsQuery(
    academyId ? { academyId } : (franchiseId ? { franchiseId } : { academyId: "" }),
    { skip: !academyId && !franchiseId },
  );
  const { data: coachesResult } = useGetUsersQuery(
    {
      roles: "coach",
      academyId: academyId ?? "",
      isActive: "true",
      limit: 100,
    },
    { skip: !academyId },
  );
  const coaches = coachesResult?.data ?? [];
  const { data: academy } = academyApi.useGetAcademyByIdQuery(academyId ?? "", {
    skip: !academyId,
  });
  const { data: existingAgeCategories = [] } = useGetAgeCategoriesQuery(
    academyId ? { academyId } : (franchiseId ? { franchiseId } : { academyId: "" }),
    { skip: !academyId && !franchiseId },
  );
  const categories = Array.from(
    new Set([...existingAgeCategories, ...(academy?.ageGroups ?? [])]),
  ).sort(
    (a, b) => parseInt(a.replace("U-", "")) - parseInt(b.replace("U-", "")),
  );
  const [createTeam, { isLoading: creating }] = useCreateTeamMutation();
  const [updateTeam] = useUpdateTeamMutation();
  const [deleteTeam] = useDeleteTeamMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [teamFormat, setTeamFormat] = useState("11s");
  const [coachId, setCoachId] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(undefined);
  const [primaryColor, setPrimaryColor] = useState("#1f2937");
  const [secondaryColor, setSecondaryColor] = useState("#334155");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [brandingTeamId, setBrandingTeamId] = useState<string | null>(null);
  const [reportTeamId, setReportTeamId] = useState<string | null>(null);

  const resetCreateForm = () => {
    setName("");
    setAgeGroup("");
    setTeamFormat("11s");
    setCoachId("");
    setLogoUrl(undefined);
    setBannerUrl(undefined);
    setPrimaryColor("#1f2937");
    setSecondaryColor("#334155");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ageGroup) return;
    try {
      await createTeam({
        name,
        ageGroup,
        teamFormat,
        academyId: academyId ?? undefined,
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
      await updateTeam({
        id: teamId,
        body: { coachId: newCoachId || undefined },
      }).unwrap();
      toast.success(newCoachId ? "Coach assigned" : "Coach removed");
    } catch {
      toast.error("Couldn't update coach — try again");
    }
  };

  const { confirm, ConfirmDialog } = useConfirm();

  const handleDelete = async (id: string, teamName?: string) => {
    const ok = await confirm({
      title: "Delete Team",
      message: `Are you sure you want to delete ${teamName ? `"${teamName}"` : "this team"}? All players in this team will become unassigned, but will remain enrolled in the academy.`,
      confirmLabel: "Delete Team",
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteTeam(id).unwrap();
      toast.success("Team removed");
    } catch {
      toast.error("Couldn't remove team — try again");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Academy Squads"
        title="Teams"
        subtitle="Manage academy teams and squads composed of players across branches"
        actions={
          canManage && (
            <Button
              icon={<Plus size={16} />}
              onClick={() => setShowCreate(true)}
              className="w-full sm:w-auto justify-center"
            >
              New team
            </Button>
          )
        }
      />

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          icon={<Users size={28} />}
          title="Couldn't load teams"
          description="Please try again shortly."
        />
      )}

      {teams && teams.length === 0 && (
        <EmptyState
          icon={<Users size={28} />}
          title="No teams yet"
          description="Create your first team to start assigning students and coaches."
          action={
            <Button onClick={() => setShowCreate(true)}>Create a team</Button>
          }
        />
      )}

      {teams && teams.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Card key={team.id} className="p-0 flex flex-col overflow-hidden">
              <div
                className="h-14 w-full relative"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${team.primaryColor ?? "#1f2937"}, ${team.secondaryColor ?? "#334155"})`,
                }}
              >
                {team.bannerUrl && (
                  <img
                    src={team.bannerUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-70"
                  />
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
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${team.primaryColor ?? "#1f2937"}, ${team.secondaryColor ?? "#334155"})`,
                        }}
                      >
                        <Users size={18} className="text-white/70" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-display font-bold text-slate-900 dark:text-white uppercase tracking-wide leading-tight">
                          {team.name}
                        </h3>
                        <Badge variant="green" size="sm">
                          ACADEMY
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="blue">{team.ageGroup}</Badge>
                        <Badge variant="yellow" size="sm" className="font-mono font-bold">
                          {team.teamFormat || "11s"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleDelete(team.id, team.name)}
                      className="text-slate-500 hover:text-ember-400 transition-colors p-1"
                      aria-label="Delete team"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-3">
                  Coach:{" "}
                  {team.coach
                    ? `${team.coach.firstName} ${team.coach.lastName}`
                    : "No coach assigned"}
                </p>
                {canManage && (
                  <Select
                    value={team.coach?._id ?? ""}
                    onChange={(e) => handleAssignCoach(team.id, e.target.value)}
                    className="!text-xs"
                    wrapperClassName="mt-2"
                  >
                    <option value="">No coach assigned</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </Select>
                )}
                <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs text-slate-500 font-mono">
                    {team.studentCount} students
                  </span>
                  <div className="flex items-center flex-wrap gap-2 sm:gap-3">
                    {canManage && (
                      <button
                        onClick={() => setBrandingTeamId(team.id)}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
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
                    <button
                      onClick={() => setReportTeamId(team.id)}
                      className="text-xs flex items-center gap-1 text-emerald-500 hover:text-emerald-400 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors font-medium"
                      title="Generate official squad report and formation"
                    >
                      <FileSpreadsheet size={12} /> Report
                    </button>
                    {canManage && (
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

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="New team"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Team name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. U-15 Eagles"
            required
          />
          <Select
            label="Age group"
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            required
            helperText={categories.length === 0 ? "Add categories from Settings first." : undefined}
          >
            <option value="" disabled>
              {categories.length === 0
                ? "No categories set up yet"
                : "Select a category"}
            </option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            label="Squad / Match Format"
            value={teamFormat}
            onChange={(e) => setTeamFormat(e.target.value)}
            className="font-mono text-xs"
          >
            <option value="5s">5s — 5-a-side (Futsal / Turf / 5 on Pitch)</option>
            <option value="6s">6s — 6-a-side (Turf / 6 on Pitch)</option>
            <option value="7s">7s — 7-a-side (Mini Football / 7 on Pitch)</option>
            <option value="8s">8s — 8-a-side (8 on Pitch)</option>
            <option value="9s">9s — 9-a-side (Youth Academy / 9 on Pitch)</option>
            <option value="10s">10s — 10-a-side (10 on Pitch)</option>
            <option value="11s">11s — 11-a-side (Full Regulation / 11 on Pitch)</option>
          </Select>
          <Select
            label="Coach (optional)"
            value={coachId}
            onChange={(e) => setCoachId(e.target.value)}
          >
            <option value="">Assign later</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <ImageUploadField
              label="Team logo (optional)"
              category="team_logo"
              value={logoUrl}
              onChange={setLogoUrl}
              shape="square"
            />
            <ImageUploadField
              label="Team banner (optional)"
              category="team_banner"
              value={bannerUrl}
              onChange={setBannerUrl}
              shape="wide"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Team colors
            </label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-9 h-9 bg-transparent border border-white/10 rounded cursor-pointer"
                />
                <span className="text-2xs font-mono text-slate-400">
                  {primaryColor}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-9 h-9 bg-transparent border border-white/10 rounded cursor-pointer"
                />
                <span className="text-2xs font-mono text-slate-400">
                  {secondaryColor}
                </span>
              </div>
              <div
                className="flex-1 h-9 rounded border border-white/10"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                }}
              />
            </div>
            <p className="text-2xs text-slate-500 mt-1.5">
              Used as the gradient theme across this team's pages.
            </p>
          </div>

          <Button type="submit" loading={creating} className="w-full">
            Create team
          </Button>
        </form>
      </Modal>

      {selectedTeamId && (
        <TeamRosterModal
          teamId={selectedTeamId}
          onClose={() => setSelectedTeamId(null)}
        />
      )}

      {brandingTeamId && (
        <TeamBrandingModal
          team={teams?.find((t) => t.id === brandingTeamId) ?? null}
          categories={categories}
          onClose={() => setBrandingTeamId(null)}
        />
      )}

      {reportTeamId && (
        <TeamReportModal
          teamId={reportTeamId}
          isOpen={Boolean(reportTeamId)}
          onClose={() => setReportTeamId(null)}
        />
      )}

      {ConfirmDialog}
    </div>
  );
};

const TeamRosterModal: React.FC<{ teamId: string; onClose: () => void }> = ({
  teamId,
  onClose,
}) => {
  const { user } = useSelector((s: RootState) => s.auth);
  const currentAcademyId = useCurrentAcademyId();
  const canManage =
    user?.role === "manager" ||
    user?.role === "operational_manager" ||
    user?.role === "super_admin";

  const { data: team, isLoading: teamLoading } = useGetTeamByIdQuery(teamId);
  const [addStudentToTeam] = useAddStudentToTeamMutation();
  const [removeStudentFromTeam] = useRemoveStudentFromTeamMutation();
  const { confirm, ConfirmDialog } = useConfirm();
  const { data: franchises } = useGetFranchisesQuery(
    currentAcademyId
      ? { academyId: currentAcademyId, isActive: true }
      : undefined,
    { skip: !currentAcademyId },
  );

  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedAgeGroup, setSelectedAgeGroup] = useState("");

  // Default age category to the team's age category for immediate convenience
  React.useEffect(() => {
    if (team?.ageGroup && !selectedAgeGroup) {
      setSelectedAgeGroup(team.ageGroup);
    }
  }, [team?.ageGroup]);

  const { data: studentsResult, isLoading: studentsLoading } =
    useGetStudentsQuery(
      {
        franchiseId: selectedFranchiseId || undefined,
        academyId: !selectedFranchiseId ? (currentAcademyId ?? undefined) : undefined,
        search: search || undefined,
        ageGroup: selectedAgeGroup || undefined,
        limit: 100,
      },
      { skip: !currentAcademyId && !selectedFranchiseId },
    );
  const availableStudents = studentsResult?.items ?? [];
  const teamStudentIds = new Set(team?.students?.map((s) => s._id) ?? []);
  const filteredAvailable = availableStudents.filter(
    (s) => !teamStudentIds.has(s.id),
  );

  const handleRemove = async (studentId: string, studentName?: string) => {
    const ok = await confirm({
      title: "Remove Player from Team",
      message: `Are you sure you want to remove ${studentName || "this player"} from ${team?.name ? `"${team.name}"` : "the team roster"}? The player will remain enrolled in their branch and keep any other team memberships.`,
      confirmLabel: "Remove Player",
      danger: true,
    });
    if (!ok) return;

    try {
      await removeStudentFromTeam({ teamId, studentId }).unwrap();
      toast.success("Player removed from squad");
    } catch {
      toast.error("Couldn't remove player — try again");
    }
  };

  const handleAssign = async (studentId: string) => {
    try {
      await addStudentToTeam({ teamId, studentId }).unwrap();
      toast.success("Player added to squad");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't assign player — try again");
    }
  };

  const categoriesList = Array.from({ length: 21 }, (_, i) => `U-${i + 5}`);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={team ? `Manage Squad — ${team.name}` : "Team roster"}
      size="xl"
    >
      {teamLoading && <Skeleton className="h-60" />}
      {team && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 h-[60vh] min-h-[440px]">
          {/* LEFT: Current Team Roster (2/5 width) */}
          <div className="md:col-span-2 flex flex-col h-full border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/5 pb-4 md:pb-0 md:pr-4">
            <div className="mb-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-volt-600 dark:text-volt-400 uppercase tracking-wide">
                  Current Squad ({team.students.length})
                </h4>
                <Badge variant="blue" size="sm">
                  {team.ageGroup}
                </Badge>
              </div>
              <p className="text-2xs text-slate-500 mt-0.5">
                Players from multiple branches enrolled in this squad
              </p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {team.students.length === 0 ? (
                <div className="h-full flex items-center justify-center border border-dashed border-slate-200 dark:border-white/10 rounded-lg p-5">
                  <p className="text-xs text-slate-500 text-center italic">
                    No players in this squad yet. Select a branch and add players from the right.
                  </p>
                </div>
              ) : (
                team.students.map((s) => (
                  <div
                    key={s._id}
                    className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-lg hover:border-slate-300 dark:hover:border-white/10 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {s.firstName} {s.lastName}
                        </p>
                        {(s.branchName || s.franchise?.name) && (
                          <span
                            className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium truncate max-w-[110px]"
                            title={s.branchName || s.franchise?.name}
                          >
                            {s.branchName || s.franchise?.name}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {s.position || "Player"} · {s.attendancePercentage}% attendance
                        {Array.isArray((s as any).teamIds) && (s as any).teamIds.length > 1 && (
                          <span className="text-volt-600 dark:text-volt-400 font-semibold ml-1.5">
                            · In {(s as any).teamIds.length} squads
                          </span>
                        )}
                      </p>
                    </div>
                    {canManage && (
                      <button
                        onClick={() =>
                          handleRemove(s._id, `${s.firstName} ${s.lastName}`)
                        }
                        className="text-slate-400 hover:text-ember-500 transition-colors p-1 shrink-0"
                        title="Remove from this team"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT: Add/Transfer Players (3/5 width) */}
          <div className="md:col-span-3 flex flex-col h-full md:pl-2">
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-volt-600 dark:text-volt-400 uppercase tracking-wide">
                  Assign Players from Branches
                </h4>
                <span className="text-2xs text-slate-500 font-mono">
                  {filteredAvailable.length} available
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="col-span-1">
                  <Select
                    value={selectedFranchiseId}
                    onChange={(e) => setSelectedFranchiseId(e.target.value)}
                    className="!text-[11px] !py-1 !px-2"
                  >
                    <option value="">All Branches</option>
                    {(franchises ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-1">
                  <Select
                    value={selectedAgeGroup}
                    onChange={(e) => setSelectedAgeGroup(e.target.value)}
                    className="!text-[11px] !py-1 !px-2"
                  >
                    <option value="">All Ages</option>
                    {categoriesList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
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
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-11 rounded-lg" />
                  ))}
                </div>
              ) : filteredAvailable.length === 0 ? (
                <div className="h-full flex items-center justify-center border border-dashed border-slate-200 dark:border-white/10 rounded-lg p-5">
                  <p className="text-xs text-slate-500 text-center italic">
                    No available players match filters.
                  </p>
                </div>
              ) : (
                filteredAvailable.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-3 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/5 rounded-lg hover:border-slate-300 dark:hover:border-white/10 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {s.firstName} {s.lastName}
                        </p>
                        {(s.franchiseName || s.franchise?.name) && (
                          <span
                            className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium truncate max-w-[110px]"
                            title={s.franchiseName || s.franchise?.name}
                          >
                            {s.franchiseName || s.franchise?.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-500">{s.ageGroup}</span>
                        {s.teamId || (s.teamIds && s.teamIds.length > 0) ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono font-medium">
                            In {s.teamIds && s.teamIds.length > 1 ? `${s.teamIds.length} squads` : "1 squad"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">Unassigned</span>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => handleAssign(s.id)}
                        className="px-2.5 py-1 rounded bg-volt-400 hover:bg-volt-300 text-pitch-900 text-[10px] font-bold uppercase transition-all shrink-0 ml-2 shadow-2xs"
                      >
                        + Add to Team
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </Modal>
  );
};

export default TeamsPage;

const TeamBrandingModal: React.FC<{
  team: Team | null;
  categories: string[];
  onClose: () => void;
}> = ({ team, categories, onClose }) => {
  const [updateTeam, { isLoading: saving }] = useUpdateTeamMutation();
  const [name, setName] = useState(team?.name ?? "");
  const [ageGroup, setAgeGroup] = useState(team?.ageGroup ?? "");
  const [logoUrl, setLogoUrl] = useState(team?.logoUrl);
  const [bannerUrl, setBannerUrl] = useState(team?.bannerUrl);
  const [primaryColor, setPrimaryColor] = useState(
    team?.primaryColor ?? "#1f2937",
  );
  const [secondaryColor, setSecondaryColor] = useState(
    team?.secondaryColor ?? "#334155",
  );

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
        body: {
          name: name.trim(),
          ageGroup,
          logoUrl,
          bannerUrl,
          primaryColor,
          secondaryColor,
        },
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
        <Input
          label="Team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Select
          label="Age group"
          value={ageGroup}
          onChange={(e) => setAgeGroup(e.target.value)}
        >
          <option value="" disabled>
            Select a category
          </option>
          {/* The team's current category is always offered even if it was
              since removed from academy settings, so switching away is
              the only way to lose it — never a silent forced blank. */}
          {(categories.includes(ageGroup)
            ? categories
            : [ageGroup, ...categories]
          ).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <ImageUploadField
            label="Team logo"
            category="team_logo"
            value={logoUrl}
            onChange={setLogoUrl}
            shape="square"
          />
          <ImageUploadField
            label="Team banner"
            category="team_banner"
            value={bannerUrl}
            onChange={setBannerUrl}
            shape="wide"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Team colors
          </label>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-9 h-9 bg-transparent border border-white/10 rounded cursor-pointer"
              />
              <span className="text-2xs font-mono text-slate-400">
                {primaryColor}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-9 h-9 bg-transparent border border-white/10 rounded cursor-pointer"
              />
              <span className="text-2xs font-mono text-slate-400">
                {secondaryColor}
              </span>
            </div>
            <div
              className="flex-1 h-9 rounded border border-white/10"
              style={{
                backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              }}
            />
          </div>
        </div>
        <Button loading={saving} onClick={handleSave} className="w-full">
          Save changes
        </Button>
      </div>
    </Modal>
  );
};
