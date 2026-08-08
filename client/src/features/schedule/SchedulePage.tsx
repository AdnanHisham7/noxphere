import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  CalendarDays,
  Plus,
  MapPin,
  Trash2,
  Bell,
  Users,
  Layers,
  Search,
  Filter,
  MoreVertical,
  Clock,
  AlertTriangle,
  X,
  CheckCircle2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Button, Badge, Modal, Input, Skeleton, EmptyState, DocumentUploadField } from "../../components/ui";
import { RootState } from "../../store";
import { useCurrentFranchiseId } from "../../hooks/useCurrentFranchiseId";
import { useListTeamsQuery } from "../../store/api/teamsApi";
import { useGetUsersQuery } from "../../store/api/usersApi";
import { useGetFranchiseByIdQuery, useGetFranchisesQuery } from "../../store/api/franchiseApi";
import { useGetStudentsQuery } from "../../store/api/studentsApi";
import { academyApi } from "../../store/api/academyApi";
import { clsx } from "clsx";
import {
  useGetSessionsQuery,
  useCreateSessionMutation,
  useUpdateSessionMutation,
  useCancelSessionMutation,
  useChangeSessionLocationMutation,
  useDeleteSessionMutation,
  useAlertAllGuardiansMutation,
  type Session,
} from "../../store/api/scheduleApi";

const STATUS_VARIANT: Record<Session["status"], "green" | "blue" | "gray" | "red"> = {
  upcoming: "blue",
  ongoing: "green",
  completed: "gray",
  cancelled: "red",
};

const TYPE_LABEL: Record<Session["type"], string> = {
  training: "Training",
  match: "Match",
  trial: "Trial",
  fitness: "Fitness",
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const SchedulePage: React.FC = () => {
  const franchiseId = useCurrentFranchiseId();
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const isCoach = user?.role === "coach";
  const canBroadcast = user?.permissions?.canSendNotifications === true;
  const canHardDelete = user?.role === "super_admin" || user?.role === "manager";

  // State
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [showCreate, setShowCreate] = useState(false);
  const [editModalSession, setEditModalSession] = useState<Session | null>(null);
  const [cancelModalSession, setCancelModalSession] = useState<Session | null>(null);
  const [confirmBroadcastModal, setConfirmBroadcastModal] = useState(false);

  // Queries
  const { data: franchise } = useGetFranchiseByIdQuery(franchiseId ?? "", { skip: !franchiseId });
  const resolvedAcademyId = franchiseId ? franchise?.academyId : user?.academyId;

  const { data: allTeams } = useListTeamsQuery(
    franchiseId ? { franchiseId } : { academyId: resolvedAcademyId ?? "" },
    { skip: !franchiseId && !resolvedAcademyId }
  );
  const teams = isCoach ? (allTeams ?? []).filter((t) => t.coach?._id === user?.id) : allTeams ?? [];

  const { data: academy } = academyApi.useGetAcademyByIdQuery(resolvedAcademyId ?? "", { skip: !resolvedAcademyId });
  const categoriesList = Array.from({ length: 21 }, (_, i) => `U-${i + 5}`);
  const categories = Array.from(new Set([...(academy?.ageGroups ?? []), ...categoriesList])).sort(
    (a, b) => parseInt(a.replace('U-', '')) - parseInt(b.replace('U-', ''))
  );
  const { data: coachesResult } = useGetUsersQuery(
    { roles: "coach", academyId: resolvedAcademyId ?? "", isActive: "true", limit: 100 },
    { skip: !resolvedAcademyId || isCoach }
  );
  const coaches = coachesResult?.data ?? [];

  const { data: sessions = [], isLoading, isError } = useGetSessionsQuery(
    franchiseId
      ? {
          franchiseId,
          ...(isCoach && user?.id ? { coachId: user.id } : {}),
          ...(selectedDate ? { from: selectedDate, to: selectedDate } : {}),
        }
      : {
          academyId: resolvedAcademyId ?? "",
          ...(selectedDate ? { from: selectedDate, to: selectedDate } : {}),
        },
    { skip: !franchiseId && !resolvedAcademyId }
  );

  const sessionsList = Array.isArray(sessions) ? sessions : [];

  // Mutations
  const [createSession, { isLoading: creating }] = useCreateSessionMutation();
  const [updateSession, { isLoading: updating }] = useUpdateSessionMutation();
  const [cancelSession, { isLoading: cancelling }] = useCancelSessionMutation();
  const [changeLocation, { isLoading: changingLocation }] = useChangeSessionLocationMutation();
  const [deleteSession] = useDeleteSessionMutation();
  const [alertAllGuardians, { isLoading: alerting }] = useAlertAllGuardiansMutation();

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessionsList.filter((s) => {
      const targetName = (s.teamName || s.category || "").toLowerCase();
      const loc = (s.location || "").toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || targetName.includes(query) || loc.includes(query);
      const matchesType = typeFilter === "all" || s.type === typeFilter;
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [sessionsList, searchQuery, typeFilter, statusFilter]);

  // Operational KPIs
  const kpis = useMemo(() => {
    const total = sessionsList.length;
    const ongoing = sessionsList.filter((s) => s.status === "ongoing").length;
    const completed = sessionsList.filter((s) => s.status === "completed").length;
    const upcoming = sessionsList.filter((s) => s.status === "upcoming").length;
    return { total, ongoing, completed, upcoming };
  }, [sessionsList]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this session permanently? This action cannot be undone.")) return;
    try {
      await deleteSession(id).unwrap();
      toast.success("Session removed permanently");
    } catch {
      toast.error("Couldn't remove session — please try again");
    }
  };

  const handleAlertAll = async () => {
    if (!franchiseId) return;
    try {
      const res = await alertAllGuardians({ franchiseId }).unwrap();
      toast.success(`Broadcasting alert sent to ${res.notified} guardian${res.notified === 1 ? "" : "s"}`);
      setConfirmBroadcastModal(false);
    } catch {
      toast.error("Couldn't send broadcast alert — try again");
    }
  };

  if (!franchiseId) {
    return (
      <EmptyState
        icon={<CalendarDays size={32} />}
        title="No franchise selected"
        description="Select an active franchise from the header bar to manage operational schedules."
      />
    );
  }

  return (
    <div className="space-y-6 text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-wide uppercase flex items-center gap-2">
            <CalendarDays className="text-volt-400" size={24} /> Schedule Command Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Operational session dispatcher, field utilization, and roster attendance tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canBroadcast && (
            <Button
              variant="secondary"
              icon={<Bell size={15} />}
              onClick={() => setConfirmBroadcastModal(true)}
              className="text-xs font-semibold"
            >
              Broadcast Alert
            </Button>
          )}
          <Button icon={<Plus size={15} />} onClick={() => setShowCreate(true)} className="text-xs font-semibold">
            New Session
          </Button>
        </div>
      </div>

      {/* Metric Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-pitch-800/80 border border-white/5">
          <span className="text-2xs font-mono uppercase text-slate-400">{selectedDate ? "Total for Day" : "Total Sessions"}</span>
          <p className="text-xl font-bold font-mono text-white mt-0.5">{kpis.total}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-pitch-800/80 border border-white/5">
          <span className="text-2xs font-mono uppercase text-emerald-400">Ongoing</span>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{kpis.ongoing}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-pitch-800/80 border border-white/5">
          <span className="text-2xs font-mono uppercase text-volt-400">Upcoming</span>
          <p className="text-xl font-bold font-mono text-volt-400 mt-0.5">{kpis.upcoming}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-pitch-800/80 border border-white/5">
          <span className="text-2xs font-mono uppercase text-slate-400">Completed</span>
          <p className="text-xl font-bold font-mono text-slate-300 mt-0.5">{kpis.completed}</p>
        </div>
      </div>

      {/* Operational Search & Filter Bar */}
      <div className="p-3 rounded-xl bg-pitch-800 border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by team, category, venue..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-pitch-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-volt-400"
            />
          </div>
          <div className="relative flex items-center gap-1.5">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-pitch-900 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-volt-400"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                className="text-xs text-volt-400 hover:text-volt-300 font-semibold underline px-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-pitch-900 border border-white/10 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="training">Training</option>
            <option value="match">Match</option>
            <option value="trial">Trial</option>
            <option value="fitness">Fitness</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-pitch-900 border border-white/10 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {isError && <EmptyState title="Couldn't load schedule" description="Error connecting to operational server." />}

      {!isLoading && !isError && filteredSessions.length === 0 && (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title="No matching sessions"
          description="Try broadening your date selection or search query parameters."
          action={
            <Button onClick={() => setShowCreate(true)} className="text-xs">
              Schedule New Session
            </Button>
          }
        />
      )}

      {!isLoading && !isError && filteredSessions.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-pitch-800/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-pitch-900/80 border-b border-white/10 text-slate-400 font-mono uppercase text-2xs tracking-wider">
                <tr>
                  <th className="py-3 px-4">Time Window</th>
                  <th className="py-3 px-4">Target / Group</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Location & Field</th>
                  <th className="py-3 px-4">Coach</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Time Window */}
                    <td className="py-3.5 px-4 text-white font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-500" />
                        <span>
                          {session.startTime} – {session.endTime}
                        </span>
                      </div>
                    </td>

                    {/* Target / Group */}
                    <td className="py-3.5 px-4 font-sans font-medium text-slate-200 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {session.targetType === "category" ? (
                          <Layers size={14} className="text-volt-400" />
                        ) : (
                          <Users size={14} className="text-volt-400" />
                        )}
                        <span>{session.teamName || session.category || "Unassigned"}</span>
                        {session.targetType === "category" && (
                          <Badge variant="blue" size="sm">
                            Category
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Session Type */}
                    <td className="py-3.5 px-4 font-sans whitespace-nowrap">
                      <Badge variant="gray" size="sm">
                        {TYPE_LABEL[session.type]}
                      </Badge>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4 font-sans text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-slate-500" />
                        <span>
                          {session.location} {session.fieldNumber ? `(${session.fieldNumber})` : ""}
                        </span>
                      </div>
                    </td>

                    {/* Coach */}
                    <td className="py-3.5 px-4 font-sans text-slate-400 whitespace-nowrap">
                      {session.coach ? `Coach ${session.coach}` : "—"}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 font-sans whitespace-nowrap">
                      <Badge variant={STATUS_VARIANT[session.status]} size="sm">
                        {session.status}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 font-sans text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {session.status !== "cancelled" && (
                          <button
                            onClick={() => navigate(`/schedule/${session.id}/roster`)}
                            className="px-2.5 py-1 rounded bg-volt-400/10 hover:bg-volt-400/20 text-volt-400 text-xs font-semibold border border-volt-400/20 transition-all"
                          >
                            Mark Attendance
                          </button>
                        )}

                        {session.status !== "cancelled" && session.status !== "completed" && (
                          <>
                            <button
                              onClick={() => setEditModalSession(session)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-white/5 transition-all font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setCancelModalSession(session)}
                              className="px-2 py-1 rounded bg-ember-500/10 hover:bg-ember-500/20 text-ember-400 text-xs border border-ember-500/20 transition-all"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {canHardDelete && (
                          <button
                            onClick={() => handleDelete(session.id)}
                            className="p-1 text-slate-500 hover:text-ember-400 transition-colors"
                            title="Delete session"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Broadcast Alert Confirmation Modal */}
      {confirmBroadcastModal && (
        <Modal isOpen onClose={() => setConfirmBroadcastModal(false)} title="Broadcast Emergency Alert" size="sm">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" />
              <p>
                This action will send an immediate push notification to <strong>all registered guardians</strong> across the franchise. Use only for schedule delays or emergency announcements.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmBroadcastModal(false)} className="text-xs">
                Abort
              </Button>
              <Button loading={alerting} onClick={handleAlertAll} className="text-xs bg-amber-500 hover:bg-amber-600 text-pitch-900">
                Confirm Broadcast
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Session Modal */}
      {showCreate && (
        <CreateSessionModal
          franchiseId={franchiseId || ""}
          teams={teams ?? []}
          categories={categories}
          coaches={coaches}
          isCoach={isCoach}
          currentUser={user ? { id: user.id, firstName: user.firstName, lastName: user.lastName } : undefined}
          onClose={() => setShowCreate(false)}
          onCreate={async (input) => {
            try {
              await createSession(input).unwrap();
              toast.success("Session scheduled successfully");
              setShowCreate(false);
            } catch (err: any) {
              toast.error(err?.data?.message || "Couldn't schedule session — try again");
            }
          }}
          creating={creating}
        />
      )}

      {/* Edit Session Modal */}
      {editModalSession && (
        <EditSessionModal
          session={editModalSession}
          franchiseId={franchiseId || ""}
          teams={teams ?? []}
          categories={categories}
          coaches={coaches}
          onClose={() => setEditModalSession(null)}
          onUpdate={async (data) => {
            try {
              await updateSession({ id: editModalSession.id, data }).unwrap();
              toast.success("Session updated successfully");
              setEditModalSession(null);
            } catch (err: any) {
              toast.error(err?.data?.message || "Couldn't update session — try again");
            }
          }}
          saving={updating}
        />
      )}

      {/* Cancel Session Modal */}
      {cancelModalSession && (
        <Modal isOpen onClose={() => setCancelModalSession(null)} title="Cancel Operational Session" size="sm">
          <CancelForm
            saving={cancelling}
            onCancel={async (reason) => {
              try {
                await cancelSession({ id: cancelModalSession.id, reason }).unwrap();
                toast.success("Session cancelled — guardians notified");
                setCancelModalSession(null);
              } catch {
                toast.error("Couldn't cancel session — try again");
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
};

/* --- SUB COMPONENTS --- */

const CreateSessionModal: React.FC<{
  franchiseId: string;
  teams: { id: string; name: string; coach?: { _id: string; firstName: string; lastName: string } }[];
  categories: string[];
  coaches: { id: string; firstName: string; lastName: string }[];
  isCoach: boolean;
  currentUser?: { id: string; firstName: string; lastName: string };
  onClose: () => void;
  onCreate: (input: any) => void;
  creating: boolean;
}> = ({ franchiseId, teams, categories, coaches, isCoach, currentUser, onClose, onCreate, creating }) => {
  const { user } = useSelector((s: RootState) => s.auth);
  const { data: academyFranchises } = useGetFranchisesQuery(
    user?.academyId ? { academyId: user.academyId, isActive: true } : undefined,
    { skip: !user?.academyId }
  );

  const [selectedFranchiseId, setSelectedFranchiseId] = useState(franchiseId || "");
  const { data: franchiseTeams } = useListTeamsQuery(
    { franchiseId: selectedFranchiseId },
    { skip: !selectedFranchiseId || !!franchiseId }
  );
  const activeTeams = franchiseId ? teams : (franchiseTeams ?? []);

  const [targetType, setTargetType] = useState<"team" | "category">(
    isCoach || activeTeams.length > 0 ? "team" : "category"
  );
  const [teamId, setTeamId] = useState(activeTeams[0]?.id ?? "");
  const [categoriesState, setCategoriesState] = useState<string[]>([]);
  const [coachIds, setCoachIds] = useState<string[]>(isCoach ? [currentUser?.id ?? ""] : []);

  const [selectedTypeOpt, setSelectedTypeOpt] = useState("training");
  const [customType, setCustomType] = useState("");

  const [isMultiDay, setIsMultiDay] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:30");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [dailyStartTime, setDailyStartTime] = useState("16:00");
  const [dailyEndTime, setDailyEndTime] = useState("17:30");

  const [location, setLocation] = useState("");
  const [fieldNumber, setFieldNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<{ name: string; url: string }[]>([]);

  // Cross-Franchise custom player selection states & queries
  const [crossFranchiseId, setCrossFranchiseId] = useState("");
  const { data: crossStudentsResult } = useGetStudentsQuery(
    { franchiseId: crossFranchiseId, limit: 100 },
    { skip: !crossFranchiseId }
  );
  const crossStudents = crossStudentsResult?.items ?? [];

  const otherFranchises = (academyFranchises ?? []).filter(
    (f) => f.id !== selectedFranchiseId
  );

  const { data: studentsResult } = useGetStudentsQuery(
    { franchiseId: selectedFranchiseId, limit: 100 },
    { skip: !selectedFranchiseId }
  );
  const availableStudents = studentsResult?.items ?? [];

  React.useEffect(() => {
    if (activeTeams.length > 0 && !teamId) {
      setTeamId(activeTeams[0].id);
      if (!isCoach && activeTeams[0].coach?._id) {
        setCoachIds([activeTeams[0].coach._id]);
      }
    }
  }, [activeTeams]);

  React.useEffect(() => {
    if (academyFranchises && academyFranchises.length > 0 && !selectedFranchiseId) {
      setSelectedFranchiseId(academyFranchises[0].id);
    }
  }, [academyFranchises]);

  const handleTeamChange = (id: string) => {
    setTeamId(id);
    if (!isCoach) {
      const t = activeTeams.find((tm) => tm.id === id);
      if (t?.coach?._id) {
        setCoachIds([t.coach._id]);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFranchiseId) return toast.error("Select a franchise");
    if (targetType === "team" && !teamId) return toast.error("Select a team");
    if (targetType === "category" && categoriesState.length === 0) return toast.error("Select at least one category");
    if (coachIds.length === 0) return toast.error("Select at least one coach");
    if (selectedTypeOpt === "custom" && !customType.trim()) return toast.error("Enter custom session type");
    if (!location) return toast.error("Location is required");

    const finalType = selectedTypeOpt === "custom" ? customType.trim() : selectedTypeOpt;

    onCreate({
      franchiseId: selectedFranchiseId,
      targetType,
      teamId: targetType === "team" ? teamId : undefined,
      category: targetType === "category" ? categoriesState[0] : undefined,
      categories: targetType === "category" ? categoriesState : undefined,
      coachId: coachIds[0],
      coachIds,
      type: finalType,
      date: isMultiDay ? startDate : date,
      startTime: isMultiDay ? dailyStartTime : startTime,
      endTime: isMultiDay ? dailyEndTime : endTime,
      startDate: isMultiDay ? startDate : date,
      endDate: isMultiDay ? endDate : date,
      dailyStartTime: isMultiDay ? dailyStartTime : startTime,
      dailyEndTime: isMultiDay ? dailyEndTime : endTime,
      location,
      fieldNumber: fieldNumber || undefined,
      notes: notes || undefined,
      playerIds: playerIds.length > 0 ? playerIds : undefined,
      documents: documents.length > 0 ? documents : undefined,
    });
  };

  return (
    <Modal isOpen onClose={onClose} title="New Operational Session" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5 text-xs max-h-[70vh] overflow-y-auto pr-2 no-scrollbar">
        
        {/* Franchise Selector (Head Office View Only) */}
        {!franchiseId && academyFranchises && (
          <div>
            <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Franchise</label>
            <select
              value={selectedFranchiseId}
              onChange={(e) => setSelectedFranchiseId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-pitch-900 border border-white/10 text-white focus:outline-none"
            >
              <option value="" disabled>Select Franchise</option>
              {academyFranchises.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Schedule Target Toggle */}
        {!isCoach && (
          <div>
            <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Schedule Target
            </label>
            <div className="flex items-center gap-1 bg-pitch-900 p-1 rounded-lg border border-white/5 w-fit">
              {(["team", "category"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTargetType(t)}
                  className={clsx(
                    "px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-1.5 transition-all",
                    targetType === t ? "bg-volt-400 text-pitch-900 font-extrabold" : "text-slate-400 hover:text-white"
                  )}
                >
                  {t === "team" ? <Users size={12} /> : <Layers size={12} />}
                  {t === "team" ? "A Team" : "Age Categories"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Team or Categories Selection */}
        {targetType === "team" ? (
          <div>
            <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Team</label>
            <select
              value={teamId}
              onChange={(e) => handleTeamChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-pitch-900 border border-white/10 text-white focus:outline-none"
            >
              <option value="">Select Team</option>
              {activeTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Age Categories (Select all that apply)
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1 border border-white/10 rounded p-2 max-h-32 overflow-y-auto bg-pitch-900">
              {categories.map((c) => {
                const isSelected = categoriesState.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setCategoriesState(categoriesState.filter((cat) => cat !== c));
                      } else {
                        setCategoriesState([...categoriesState, c]);
                      }
                    }}
                    className={clsx(
                      "px-2 py-0.5 rounded text-[10px] font-semibold border transition-all duration-150",
                      isSelected
                        ? "bg-volt-400 border-volt-400 text-pitch-900 font-extrabold"
                        : "bg-pitch-800 border-white/5 text-slate-400 hover:border-white/10 hover:text-white"
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Multiple Coaches Selection */}
        {!isCoach && (
          <div>
            <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Assigned Coaches (Select all that apply)
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1 border border-white/10 rounded p-2 max-h-32 overflow-y-auto bg-pitch-900">
              {coaches.map((c) => {
                const isSelected = coachIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setCoachIds(coachIds.filter((id) => id !== c.id));
                      } else {
                        setCoachIds([...coachIds, c.id]);
                      }
                    }}
                    className={clsx(
                      "px-2 py-0.5 rounded text-[10px] font-semibold border transition-all duration-150",
                      isSelected
                        ? "bg-volt-400 border-volt-400 text-pitch-900 font-extrabold"
                        : "bg-pitch-800 border-white/5 text-slate-400 hover:border-white/10 hover:text-white"
                    )}
                  >
                    {c.firstName} {c.lastName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Extensible Session Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Session Type</label>
            <select
              value={selectedTypeOpt}
              onChange={(e) => setSelectedTypeOpt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-pitch-900 border border-white/10 text-white focus:outline-none"
            >
              <option value="training">Training</option>
              <option value="match">Match</option>
              <option value="trial">Trial</option>
              <option value="fitness">Fitness</option>
              <option value="custom">Custom (Specify...)</option>
            </select>
          </div>
          {selectedTypeOpt === "custom" && (
            <Input label="Custom Type Name" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="e.g. Friendly Match" required />
          )}
        </div>

        {/* Duration Mode & Time Range */}
        <div className="border-t border-white/5 pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wide">Session Duration</span>
            <button
              type="button"
              onClick={() => setIsMultiDay(!isMultiDay)}
              className="px-2.5 py-1 rounded bg-slate-800 text-[10px] font-bold text-white uppercase border border-white/5 hover:bg-slate-700 transition-colors"
            >
              {isMultiDay ? "Switch to Single Day" : "Switch to Multi-day Range"}
            </button>
          </div>

          {!isMultiDay ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="col-span-1">
                <Input label="Start Time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div className="col-span-1">
                <Input label="End Time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 bg-white/[0.02] p-3 rounded-lg border border-white/5">
              <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              <Input label="Daily Start" type="time" value={dailyStartTime} onChange={(e) => setDailyStartTime(e.target.value)} required />
              <Input label="Daily End" type="time" value={dailyEndTime} onChange={(e) => setDailyEndTime(e.target.value)} required />
            </div>
          )}
        </div>

        {/* Location / Field Info */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Location / Venue" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Turf 1" required />
          <Input label="Field Number (Optional)" value={fieldNumber} onChange={(e) => setFieldNumber(e.target.value)} placeholder="e.g. Field B" />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Session Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-pitch-900 border border-white/10 text-white focus:outline-none min-h-[60px]"
            placeholder="e.g. Tactical positioning focus"
          />
        </div>

        {/* Custom Overrides / Player List Selector */}
        <div className="border-t border-white/5 pt-3 space-y-3">
          <div>
            <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Cross-Franchise / Custom Player List (Optional)
            </label>
            <p className="text-[10px] text-slate-500 mb-2">Select a different franchise to invite players from.</p>
            <select
              value={crossFranchiseId}
              onChange={(e) => setCrossFranchiseId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-pitch-900 border border-white/10 text-xs text-white focus:outline-none focus:border-volt-400"
            >
              <option value="">-- Choose a Franchise --</option>
              {otherFranchises.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {crossFranchiseId && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Available Players in {otherFranchises.find(f => f.id === crossFranchiseId)?.name}
              </p>
              {crossStudents.length === 0 ? (
                <p className="text-2xs text-slate-500 italic">No players registered under this franchise.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border border-white/10 rounded p-2 bg-pitch-900">
                  {crossStudents.map((s) => {
                    const isSelected = playerIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setPlayerIds(playerIds.filter((id) => id !== s.id));
                          } else {
                            setPlayerIds([...playerIds, s.id]);
                          }
                        }}
                        className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-semibold border transition-all duration-150",
                          isSelected
                            ? "bg-volt-400 border-volt-400 text-pitch-900 font-extrabold"
                            : "bg-pitch-800 border-white/5 text-slate-400 hover:border-white/10 hover:text-white"
                        )}
                      >
                        {s.firstName} {s.lastName} ({s.ageGroup})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {playerIds.length > 0 && (
            <div className="space-y-1.5 border-t border-white/5 pt-2.5">
              <p className="text-[10px] font-semibold text-volt-400 uppercase tracking-wide">
                Invited Custom Players ({playerIds.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {playerIds.map((id) => {
                  const p = [...crossStudents, ...availableStudents].find((s) => s.id === id);
                  const displayName = p ? `${p.firstName} ${p.lastName} (${p.ageGroup})` : `Player ID: ${id.slice(-6)}`;
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-volt-400/10 border border-volt-400/20 text-volt-400"
                    >
                      {displayName}
                      <button
                        type="button"
                        onClick={() => setPlayerIds(playerIds.filter((pid) => pid !== id))}
                        className="text-[9px] hover:text-volt-300 font-extrabold ml-0.5 font-mono"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Document Uploads */}
        <div className="border-t border-white/5 pt-3 space-y-3">
          <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Attached Documents</label>
          <DocumentUploadField
            label="Upload Session Document (PDF/Word)"
            category="notification_document"
            onChange={(file) => {
              if (file) {
                setDocuments([...documents, { name: file.filename || "Uploaded File", url: file.url }]);
              }
            }}
          />
          {documents.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {documents.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between px-2 py-1 bg-white/5 rounded border border-white/5 text-2xs text-slate-300">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-volt-400 truncate max-w-[80%]">
                    {doc.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => setDocuments(documents.filter((_, i) => i !== idx))}
                    className="text-slate-500 hover:text-ember-400 text-[10px]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" loading={creating} className="w-full text-xs font-semibold py-2.5 bg-volt-400 hover:bg-volt-300 text-pitch-900">
          Schedule Operational Session
        </Button>
      </form>
    </Modal>
  );
};

const EditSessionModal: React.FC<{
  session: Session;
  franchiseId: string;
  teams: { id: string; name: string; coach?: { _id: string; firstName: string; lastName: string } }[];
  categories: string[];
  coaches: { id: string; firstName: string; lastName: string }[];
  onClose: () => void;
  onUpdate: (data: any) => void;
  saving: boolean;
}> = ({ session, teams, categories, coaches, onClose, onUpdate, saving }) => {
  const [categoriesState, setCategoriesState] = useState<string[]>(session.categories || (session.category ? [session.category] : []));
  const [coachIds, setCoachIds] = useState<string[]>(session.coachIds || (session.coachId ? [session.coachId] : []));

  const [selectedTypeOpt, setSelectedTypeOpt] = useState(["training", "match", "trial", "fitness"].includes(session.type) ? session.type : "custom");
  const [customType, setCustomType] = useState(["training", "match", "trial", "fitness"].includes(session.type) ? "" : session.type);

  const [isMultiDay, setIsMultiDay] = useState(!!session.startDate && session.startDate !== session.endDate);
  const [date, setDate] = useState(session.date);
  const [startTime, setStartTime] = useState(session.startTime);
  const [endTime, setEndTime] = useState(session.endTime);
  const [startDate, setStartDate] = useState(session.startDate || session.date);
  const [endDate, setEndDate] = useState(session.endDate || session.date);
  const [dailyStartTime, setDailyStartTime] = useState(session.dailyStartTime || session.startTime);
  const [dailyEndTime, setDailyEndTime] = useState(session.dailyEndTime || session.endTime);

  const [location, setLocation] = useState(session.location);
  const [fieldNumber, setFieldNumber] = useState(session.fieldNumber ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");

  const [playerIds, setPlayerIds] = useState<string[]>(session.playerIds || []);
  const [documents, setDocuments] = useState<{ name: string; url: string }[]>(session.documents || []);

  const { user } = useSelector((s: RootState) => s.auth);
  const { data: academyFranchises } = useGetFranchisesQuery(
    user?.academyId ? { academyId: user.academyId, isActive: true } : undefined,
    { skip: !user?.academyId }
  );

  const [crossFranchiseId, setCrossFranchiseId] = useState("");
  const { data: crossStudentsResult } = useGetStudentsQuery(
    { franchiseId: crossFranchiseId, limit: 100 },
    { skip: !crossFranchiseId }
  );
  const crossStudents = crossStudentsResult?.items ?? [];

  const otherFranchises = (academyFranchises ?? []).filter(
    (f) => f.id !== session.franchiseId
  );

  const { data: studentsResult } = useGetStudentsQuery(
    { franchiseId: session.franchiseId, limit: 100 },
    { skip: !session.franchiseId }
  );
  const availableStudents = studentsResult?.items ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (coachIds.length === 0) return toast.error("Select at least one coach");
    if (selectedTypeOpt === "custom" && !customType.trim()) return toast.error("Enter custom session type");
    if (!location) return toast.error("Location is required");

    const finalType = selectedTypeOpt === "custom" ? customType.trim() : selectedTypeOpt;

    onUpdate({
      categories: session.targetType === "category" ? categoriesState : undefined,
      coachIds,
      type: finalType,
      date: isMultiDay ? startDate : date,
      startTime: isMultiDay ? dailyStartTime : startTime,
      endTime: isMultiDay ? dailyEndTime : endTime,
      startDate: isMultiDay ? startDate : date,
      endDate: isMultiDay ? endDate : date,
      dailyStartTime: isMultiDay ? dailyStartTime : startTime,
      dailyEndTime: isMultiDay ? dailyEndTime : endTime,
      location,
      fieldNumber: fieldNumber || undefined,
      notes: notes || undefined,
      playerIds,
      documents,
    });
  };

  return (
    <Modal isOpen onClose={onClose} title={`Edit Session — ${session.teamName || session.category || "General"}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-5 text-xs max-h-[70vh] overflow-y-auto pr-2 no-scrollbar">
        
        {/* Read-only target info */}
        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
          <p className="text-2xs text-slate-500 font-semibold uppercase tracking-wider">Target Squad</p>
          <p className="text-sm font-bold text-white mt-1">
            {session.targetType === "team" ? `Team: ${session.teamName}` : `Categories: ${categoriesState.join(", ")}`}
          </p>
        </div>

        {/* Categories multiselect (only if category target) */}
        {session.targetType === "category" && (
          <div>
            <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Age Categories (Select all that apply)
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1 border border-white/10 rounded p-2 max-h-32 overflow-y-auto bg-pitch-900">
              {categories.map((c) => {
                const isSelected = categoriesState.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setCategoriesState(categoriesState.filter((cat) => cat !== c));
                      } else {
                        setCategoriesState([...categoriesState, c]);
                      }
                    }}
                    className={clsx(
                      "px-2 py-0.5 rounded text-[10px] font-semibold border transition-all duration-150",
                      isSelected
                        ? "bg-volt-400 border-volt-400 text-pitch-900 font-extrabold"
                        : "bg-pitch-800 border-white/5 text-slate-400 hover:border-white/10 hover:text-white"
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Multiple Coaches Selection */}
        <div>
          <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
            Assigned Coaches (Select all that apply)
          </label>
          <div className="flex flex-wrap gap-1.5 mt-1 border border-white/10 rounded p-2 max-h-32 overflow-y-auto bg-pitch-900">
            {coaches.map((c) => {
              const isSelected = coachIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setCoachIds(coachIds.filter((id) => id !== c.id));
                    } else {
                      setCoachIds([...coachIds, c.id]);
                    }
                  }}
                  className={clsx(
                    "px-2 py-0.5 rounded text-[10px] font-semibold border transition-all duration-150",
                    isSelected
                      ? "bg-volt-400 border-volt-400 text-pitch-900 font-extrabold"
                      : "bg-pitch-800 border-white/5 text-slate-400 hover:border-white/10 hover:text-white"
                  )}
                >
                  {c.firstName} {c.lastName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Extensible Session Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Session Type</label>
            <select
              value={selectedTypeOpt}
              onChange={(e) => setSelectedTypeOpt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-pitch-900 border border-white/10 text-white focus:outline-none"
            >
              <option value="training">Training</option>
              <option value="match">Match</option>
              <option value="trial">Trial</option>
              <option value="fitness">Fitness</option>
              <option value="custom">Custom (Specify...)</option>
            </select>
          </div>
          {selectedTypeOpt === "custom" && (
            <Input label="Custom Type Name" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="e.g. Friendly Match" required />
          )}
        </div>

        {/* Duration Mode & Time Range */}
        <div className="border-t border-white/5 pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wide">Session Duration</span>
            <button
              type="button"
              onClick={() => setIsMultiDay(!isMultiDay)}
              className="px-2.5 py-1 rounded bg-slate-800 text-[10px] font-bold text-white uppercase border border-white/5 hover:bg-slate-700 transition-colors"
            >
              {isMultiDay ? "Switch to Single Day" : "Switch to Multi-day Range"}
            </button>
          </div>

          {!isMultiDay ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="col-span-1">
                <Input label="Start Time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div className="col-span-1">
                <Input label="End Time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 bg-white/[0.02] p-3 rounded-lg border border-white/5">
              <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              <Input label="Daily Start" type="time" value={dailyStartTime} onChange={(e) => setDailyStartTime(e.target.value)} required />
              <Input label="Daily End" type="time" value={dailyEndTime} onChange={(e) => setDailyEndTime(e.target.value)} required />
            </div>
          )}
        </div>

        {/* Location / Field Info */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Location / Venue" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Turf 1" required />
          <Input label="Field Number (Optional)" value={fieldNumber} onChange={(e) => setFieldNumber(e.target.value)} placeholder="e.g. Field B" />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Session Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-pitch-900 border border-white/10 text-white focus:outline-none min-h-[60px]"
            placeholder="e.g. Tactical positioning focus"
          />
        </div>

        {/* Custom Overrides / Player List Selector */}
        <div className="border-t border-white/5 pt-3 space-y-3">
          <div>
            <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Cross-Franchise / Custom Player List (Optional)
            </label>
            <p className="text-[10px] text-slate-500 mb-2">Select a different franchise to invite players from.</p>
            <select
              value={crossFranchiseId}
              onChange={(e) => setCrossFranchiseId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-pitch-900 border border-white/10 text-xs text-white focus:outline-none focus:border-volt-400"
            >
              <option value="">-- Choose a Franchise --</option>
              {otherFranchises.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {crossFranchiseId && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Available Players in {otherFranchises.find(f => f.id === crossFranchiseId)?.name}
              </p>
              {crossStudents.length === 0 ? (
                <p className="text-2xs text-slate-500 italic">No players registered under this franchise.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border border-white/10 rounded p-2 bg-pitch-900">
                  {crossStudents.map((s) => {
                    const isSelected = playerIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setPlayerIds(playerIds.filter((id) => id !== s.id));
                          } else {
                            setPlayerIds([...playerIds, s.id]);
                          }
                        }}
                        className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-semibold border transition-all duration-150",
                          isSelected
                            ? "bg-volt-400 border-volt-400 text-pitch-900 font-extrabold"
                            : "bg-pitch-800 border-white/5 text-slate-400 hover:border-white/10 hover:text-white"
                        )}
                      >
                        {s.firstName} {s.lastName} ({s.ageGroup})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {playerIds.length > 0 && (
            <div className="space-y-1.5 border-t border-white/5 pt-2.5">
              <p className="text-[10px] font-semibold text-volt-400 uppercase tracking-wide">
                Invited Custom Players ({playerIds.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {playerIds.map((id) => {
                  const p = [...crossStudents, ...availableStudents].find((s) => s.id === id);
                  const displayName = p ? `${p.firstName} ${p.lastName} (${p.ageGroup})` : `Player ID: ${id.slice(-6)}`;
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-volt-400/10 border border-volt-400/20 text-volt-400"
                    >
                      {displayName}
                      <button
                        type="button"
                        onClick={() => setPlayerIds(playerIds.filter((pid) => pid !== id))}
                        className="text-[9px] hover:text-volt-300 font-extrabold ml-0.5 font-mono"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Document Uploads */}
        <div className="border-t border-white/5 pt-3 space-y-3">
          <label className="block text-2xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Attached Documents</label>
          <DocumentUploadField
            label="Upload Session Document (PDF/Word)"
            category="notification_document"
            onChange={(file) => {
              if (file) {
                setDocuments([...documents, { name: file.filename || "Uploaded File", url: file.url }]);
              }
            }}
          />
          {documents.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {documents.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between px-2 py-1 bg-white/5 rounded border border-white/5 text-2xs text-slate-300">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-volt-400 truncate max-w-[80%]">
                    {doc.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => setDocuments(documents.filter((_, i) => i !== idx))}
                    className="text-slate-500 hover:text-ember-400 text-[10px]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" loading={saving} className="w-full text-xs font-semibold py-2.5 bg-volt-400 hover:bg-volt-300 text-pitch-900">
          Save Session Changes
        </Button>
      </form>
    </Modal>
  );
};

const CancelForm: React.FC<{ saving: boolean; onCancel: (reason: string) => void }> = ({ saving, onCancel }) => {
  const [reason, setReason] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) return toast.error("Reason is required");
        onCancel(reason.trim());
      }}
      className="space-y-4 text-xs"
    >
      <Input
        label="Reason for Cancellation"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Adverse weather conditions"
        required
      />
      <p className="text-2xs text-slate-400">Guardians will receive an emergency cancellation push notification.</p>
      <Button type="submit" variant="danger" loading={saving} className="w-full text-xs font-semibold">
        Confirm Cancellation
      </Button>
    </form>
  );
};

export default SchedulePage;