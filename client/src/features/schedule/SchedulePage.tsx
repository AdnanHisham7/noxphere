import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useHighlightEffect } from "../../hooks/useEntityHighlight";
import { clearActiveTeam, setActiveTeam } from "../../store/slices/uiSlice";
import { ScheduleTeamEventModal } from "../teams/ScheduleTeamEventModal";
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
  UserCheck,
  ExternalLink,
  Navigation,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Button, Badge, Modal, Input, Skeleton, EmptyState, DocumentUploadField, PageHeader, Card, Select, getMapsLink } from "../../components/ui";
import { RootState } from "../../store";
import { useCurrentFranchiseId } from "../../hooks/useCurrentFranchiseId";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import { useConfirm } from "../../hooks/useConfirm";
import { useListTeamsQuery, useGetTeamByIdQuery } from "../../store/api/teamsApi";
import { useGetUsersQuery } from "../../store/api/usersApi";
import { useGetFranchiseByIdQuery, useGetFranchisesQuery } from "../../store/api/franchiseApi";
import { useGetStudentsQuery, useGetAgeCategoriesQuery } from "../../store/api/studentsApi";
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

const TYPE_LABEL: Record<string, string> = {
  technical: "Technical",
  physical: "Physical",
  tactical: "Tactical",
  psychological: "Psychological",
  social: "Social",
  mental: "Mental",
  match: "Match",
  training: "Training",
  trial: "Trial",
  fitness: "Fitness",
};

const formatSessionType = (type?: string, academySessionTypes?: { name: string }[]): string => {
  if (!type) return "—";
  const normalized = type.trim();
  const lower = normalized.toLowerCase();

  const configured = academySessionTypes?.find(
    (st) => st.name.toLowerCase() === lower
  );
  if (configured) return configured.name;

  if (TYPE_LABEL[lower]) return TYPE_LABEL[lower];

  return normalized
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

const todayStr = () => new Date().toISOString().slice(0, 10);

interface CoachAvailabilityFields {
  id: string;
  firstName: string;
  lastName: string;
  weeklyAvailability?: { dayOfWeek: number; startTime: string; endTime: string }[];
  customUnavailableDates?: string[];
}

// A coach with no weeklyAvailability configured at all is treated as
// always available — nothing has been set for them to conflict with.
// Mirrors the backend check in ScheduleUseCases.assertCoachesAvailable.
const isCoachAvailableOnDate = (coach: CoachAvailabilityFields, dateStr: string): boolean => {
  if (coach.customUnavailableDates?.includes(dateStr)) return false;
  if (!coach.weeklyAvailability || coach.weeklyAvailability.length === 0) return true;
  const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return coach.weeklyAvailability.some((wa) => wa.dayOfWeek === dayOfWeek);
};

const SchedulePage: React.FC = () => {
  const dispatch = useDispatch();
  const franchiseId = useCurrentFranchiseId();
  const activeTeamId = useSelector((s: RootState) => s.ui.activeTeamId);
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const isCoach = user?.role === "coach";
  const canBroadcast = user?.permissions?.canSendNotifications === true;
  const canHardDelete = user?.role === "super_admin" || user?.role === "manager" || user?.role === "operational_manager";

  // State
  const [searchParams] = useSearchParams();
  const effectiveTeamId = activeTeamId || searchParams.get("teamId") || undefined;
  const highlightId = searchParams.get("highlightId");
  useHighlightEffect();

  // Synchronize URL ?teamId parameter with Redux activeTeamId
  useEffect(() => {
    const urlTeamId = searchParams.get("teamId");
    if (urlTeamId) {
      if (urlTeamId !== activeTeamId) {
        dispatch(setActiveTeam(urlTeamId));
      }
    } else if (activeTeamId) {
      dispatch(clearActiveTeam());
    }
  }, [searchParams, activeTeamId, dispatch]);

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
  const { data: academyData } = academyApi.useGetAcademyByIdQuery(
    resolvedAcademyId ?? "",
    { skip: !resolvedAcademyId }
  );

  const { data: allTeams } = useListTeamsQuery(
    franchiseId ? { franchiseId } : { academyId: resolvedAcademyId ?? "" },
    { skip: !franchiseId && !resolvedAcademyId }
  );
  const { data: fetchedTeam } = useGetTeamByIdQuery(effectiveTeamId ?? "", { skip: !effectiveTeamId });
  const activeTeam = (allTeams ?? []).find((t) => t.id === effectiveTeamId) ?? (fetchedTeam as any);
  const teams = isCoach
    ? (allTeams ?? []).filter((t) => (t.coach?._id?.toString() || (t.coach as any)?.id?.toString()) === user?.id)
    : allTeams ?? [];

  const { data: existingAgeCategories = [] } = useGetAgeCategoriesQuery(
    franchiseId ? { franchiseId } : { academyId: resolvedAcademyId ?? "" },
    { skip: !franchiseId && !resolvedAcademyId }
  );
  const categories = existingAgeCategories;
  const { data: coachesResult } = useGetUsersQuery(
    { roles: "coach", academyId: resolvedAcademyId ?? "", isActive: "true", limit: 100 },
    { skip: !resolvedAcademyId || isCoach }
  );
  const coaches = coachesResult?.data ?? [];

  const { data: sessions = [], isLoading, isError } = useGetSessionsQuery(
    effectiveTeamId
      ? {
          teamId: effectiveTeamId,
          ...(selectedDate ? { from: selectedDate, to: selectedDate } : {}),
        }
      : franchiseId
      ? {
          franchiseId,
          ...(isCoach && user?.id ? { coachId: user.id } : {}),
          ...(selectedDate ? { from: selectedDate, to: selectedDate } : {}),
        }
      : {
          academyId: resolvedAcademyId ?? "",
          ...(selectedDate ? { from: selectedDate, to: selectedDate } : {}),
        },
    { skip: !effectiveTeamId && !franchiseId && !resolvedAcademyId }
  );

  const sessionsList = Array.isArray(sessions) ? sessions : [];

  const availableFilterTypes = useMemo(() => {
    const typesMap = new Map<string, string>();

    const defaultTypes = [
      { id: "technical", label: "Technical" },
      { id: "physical", label: "Physical" },
      { id: "tactical", label: "Tactical" },
      { id: "psychological", label: "Psychological" },
      { id: "social", label: "Social" },
      { id: "match", label: "Match" },
      { id: "training", label: "Training" },
      { id: "trial", label: "Trial" },
      { id: "fitness", label: "Fitness" },
    ];
    defaultTypes.forEach((t) => typesMap.set(t.id.toLowerCase(), t.label));

    if (academyData?.sessionTypes) {
      academyData.sessionTypes.forEach((st) => {
        typesMap.set(st.name.toLowerCase(), st.name);
      });
    }

    sessionsList.forEach((s) => {
      if (s.type) {
        const key = s.type.toLowerCase();
        if (!typesMap.has(key)) {
          typesMap.set(key, formatSessionType(s.type, academyData?.sessionTypes));
        }
      }
    });

    return Array.from(typesMap.entries()).map(([id, label]) => ({ id, label }));
  }, [academyData?.sessionTypes, sessionsList]);

  useEffect(() => {
    if (!highlightId || !sessionsList.length) return;
    const match = sessionsList.find((s) => s.id === highlightId);
    if (match && selectedDate && match.date !== selectedDate) {
      setSelectedDate("");
    }
  }, [highlightId, sessionsList, selectedDate]);

  // Mutations
  const [createSession, { isLoading: creating }] = useCreateSessionMutation();
  const [updateSession, { isLoading: updating }] = useUpdateSessionMutation();
  const [cancelSession, { isLoading: cancelling }] = useCancelSessionMutation();
  const [changeLocation, { isLoading: changingLocation }] = useChangeSessionLocationMutation();
  const [deleteSession] = useDeleteSessionMutation();
  const { confirm, ConfirmDialog } = useConfirm();
  const [alertAllGuardians, { isLoading: alerting }] = useAlertAllGuardiansMutation();

  // Filtered Sessions — upcoming first (soonest date), then ongoing, then the rest latest-first
  const filteredSessions = useMemo(() => {
    const STATUS_ORDER: Record<string, number> = { upcoming: 0, ongoing: 1, completed: 2, cancelled: 3 };

    return sessionsList
      .filter((s) => {
        const targetName = (s.teamName || s.category || "").toLowerCase();
        const loc = (s.location || "").toLowerCase();
        const query = searchQuery.toLowerCase();
        const matchesSearch = !query || targetName.includes(query) || loc.includes(query);
        const matchesType =
          typeFilter === "all" ||
          (s.type || "").toLowerCase() === typeFilter.toLowerCase();
        const matchesStatus = statusFilter === "all" || s.status === statusFilter;

        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => {
        const aOrder = STATUS_ORDER[a.status] ?? 4;
        const bOrder = STATUS_ORDER[b.status] ?? 4;
        if (aOrder !== bOrder) return aOrder - bOrder;

        // Upcoming & ongoing: soonest first; completed & cancelled: latest first
        const ascending = aOrder <= 1;
        const dateCompare = (a.date || "").localeCompare(b.date || "");
        if (dateCompare !== 0) return ascending ? dateCompare : -dateCompare;
        const timeCompare = (a.startTime || "").localeCompare(b.startTime || "");
        if (timeCompare !== 0) return ascending ? timeCompare : -timeCompare;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
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
    const ok = await confirm({
      title: "Remove session",
      message: "Remove this session permanently? This action cannot be undone.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
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

  if (!franchiseId && !effectiveTeamId) {
    return (
      <EmptyState
        icon={<CalendarDays size={32} />}
        title="No branch or team selected"
        description="Select an active branch or team from the header bar to manage operational schedules."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Squad Schedule Banner if a team is active */}
      {effectiveTeamId && (
        <div className="p-3.5 rounded-lg bg-volt-400/[0.08] dark:bg-volt-400/[0.05] border border-volt-400/25 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-volt-400/20 text-volt-600 dark:text-volt-400">
              <Users size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Squad Schedule · {activeTeam?.name ?? "Team"} {activeTeam?.ageGroup ? `(${activeTeam.ageGroup})` : ""}
              </p>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Viewing scheduled matches and training sessions exclusively for this squad.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              dispatch(clearActiveTeam());
              navigate("/schedule");
            }}
            className="text-xs text-volt-600 dark:text-volt-400 font-bold hover:underline px-2.5 py-1 rounded bg-volt-400/10 border border-volt-400/20"
          >
            ← Back to Branch Schedule
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        eyebrow={effectiveTeamId ? "Squad Operations" : "Training & Operations"}
        title={effectiveTeamId ? `${activeTeam?.name ?? "Team"} Schedule` : "Schedule Command Center"}
        subtitle={effectiveTeamId ? `Operational session dispatcher and roster attendance tracking for ${activeTeam?.name ?? "squad"}.` : "Operational session dispatcher, field utilization, and roster attendance tracking."}
        actions={
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {canBroadcast && !effectiveTeamId && (
              <Button
                variant="secondary"
                icon={<Bell size={15} />}
                onClick={() => setConfirmBroadcastModal(true)}
                className="text-xs font-semibold flex-1 sm:flex-initial justify-center"
              >
                Broadcast Alert
              </Button>
            )}
            <Button icon={<Plus size={15} />} onClick={() => setShowCreate(true)} className="text-xs font-semibold flex-1 sm:flex-initial justify-center">
              {effectiveTeamId ? "Schedule Squad Event" : "New Session"}
            </Button>
          </div>
        }
      />

      {/* Metric Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 space-y-1">
          <span className="text-2xs font-mono uppercase text-slate-500 dark:text-slate-400">{selectedDate ? "Total for Day" : "Total Sessions"}</span>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">{kpis.total}</p>
        </Card>
        <Card className="p-3.5 space-y-1">
          <span className="text-2xs font-mono uppercase text-emerald-600 dark:text-emerald-400">Ongoing</span>
          <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{kpis.ongoing}</p>
        </Card>
        <Card className="p-3.5 space-y-1">
          <span className="text-2xs font-mono uppercase text-volt-600 dark:text-volt-400">Upcoming</span>
          <p className="text-xl font-bold font-mono text-volt-600 dark:text-volt-400">{kpis.upcoming}</p>
        </Card>
        <Card className="p-3.5 space-y-1">
          <span className="text-2xs font-mono uppercase text-slate-500 dark:text-slate-400">Completed</span>
          <p className="text-xl font-bold font-mono text-slate-700 dark:text-slate-300">{kpis.completed}</p>
        </Card>
      </div>

      {/* Operational Search & Filter Bar */}
      <div className="p-3 rounded-xl bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by team, category, venue..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-volt-400"
            />
          </div>
          <div className="relative flex items-center gap-1.5">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-volt-400"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                className="text-xs text-volt-600 dark:text-volt-400 hover:text-volt-500 dark:hover:text-volt-300 font-semibold underline px-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-36">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              {availableFilterTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-36">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
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
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-pitch-800/50 shadow-sm dark:shadow-none overflow-hidden">
          <div className="table-responsive">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-slate-50 dark:bg-pitch-900/80 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 font-mono uppercase text-2xs tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Target / Group</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Location & Field</th>
                  <th className="py-3 px-4">Coach</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                {filteredSessions.map((session) => (
                  <tr
                    key={session.id}
                    id={`entity-${session.id}`}
                    data-highlight-id={session.id}
                    className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Date & Time */}
                    <td className="py-3.5 px-4 text-slate-900 dark:text-white font-medium whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-500 dark:text-slate-400 text-2xs font-mono">
                          {session.date
                            ? new Date(`${session.date}T00:00:00`).toLocaleDateString("en-GB", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-slate-400 dark:text-slate-500" />
                          <span>
                            {session.startTime} – {session.endTime}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Target / Group */}
                    <td className="py-3.5 px-4 font-sans font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {session.targetType === "category" ? (
                          <Layers size={14} className="text-volt-500 dark:text-volt-400" />
                        ) : session.targetType === "batch" ? (
                          <UserCheck size={14} className="text-volt-500 dark:text-volt-400" />
                        ) : (
                          <Users size={14} className="text-volt-500 dark:text-volt-400" />
                        )}
                        <span>
                          {session.targetType === "batch"
                            ? `Custom Batch (${session.playerIds?.length || 0} players)`
                            : session.teamName || session.category || "Unassigned"}
                        </span>
                        {session.targetType === "category" && (
                          <Badge variant="blue" size="sm">
                            Category
                          </Badge>
                        )}
                        {session.targetType === "batch" && (
                          <Badge variant="yellow" size="sm">
                            Batch
                          </Badge>
                        )}
                        {session.targetType === "team" && (
                          <Badge variant="green" size="sm">
                            Squad Event
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Session Type */}
                    <td className="py-3.5 px-4 font-sans whitespace-nowrap">
                      <Badge variant="gray" size="sm">
                        {formatSessionType(session.type, academyData?.sessionTypes)}
                      </Badge>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4 font-sans text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <MapPin size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        <span>
                          {session.location} {session.fieldNumber ? `(${session.fieldNumber})` : ""}
                        </span>
                        {(() => {
                          const mapsUrl = getMapsLink({
                            googleMapsUrl: session.googleMapsUrl,
                            latitude: session.latitude,
                            longitude: session.longitude,
                            location: session.location,
                            fieldNumber: session.fieldNumber,
                          });
                          return mapsUrl ? (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-volt-600 dark:text-volt-400 hover:underline ml-1"
                              title="Open venue in Google Maps"
                            >
                              <span>Maps</span>
                              <ExternalLink size={10} />
                            </a>
                          ) : null;
                        })()}
                      </div>
                    </td>

                    {/* Coach */}
                    <td className="py-3.5 px-4 font-sans text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {session.coaches && session.coaches.length > 0
                        ? session.coaches.map((c) => `Coach ${c}`).join(", ")
                        : session.coach
                          ? `Coach ${session.coach}`
                          : "—"}
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
                            className="px-2.5 py-1 rounded bg-volt-400/15 hover:bg-volt-400/25 text-volt-600 dark:text-volt-400 text-xs font-semibold border border-volt-400/30 transition-all"
                          >
                            Mark Attendance
                          </button>
                        )}

                        {session.status !== "cancelled" && session.status !== "completed" && (
                          <>
                            <button
                              onClick={() => setEditModalSession(session)}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-white/5 transition-all font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setCancelModalSession(session)}
                              className="px-2 py-1 rounded bg-ember-500/10 hover:bg-ember-500/20 text-ember-600 dark:text-ember-400 text-xs border border-ember-500/20 transition-all font-semibold"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {canHardDelete && (
                          <button
                            onClick={() => handleDelete(session.id)}
                            className="p-1 text-slate-400 dark:text-slate-500 hover:text-ember-500 transition-colors"
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
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p>
                This action will send an immediate push notification to <strong>all registered guardians</strong> across the branch. Use only for schedule delays or emergency announcements.
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
        effectiveTeamId ? (
          activeTeam ? (
            <ScheduleTeamEventModal
              team={activeTeam}
              academyId={resolvedAcademyId || activeTeam.academyId || user?.academyId || ""}
              coaches={coaches}
              onClose={() => setShowCreate(false)}
            />
          ) : null
        ) : (
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
        )
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
      {ConfirmDialog}
    </div>
  );
};

/* --- SUB COMPONENTS --- */

const CreateSessionModal: React.FC<{
  franchiseId: string;
  teams: { id: string; name: string; coach?: { _id: string; firstName: string; lastName: string } }[];
  categories: string[];
  coaches: CoachAvailabilityFields[];
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

  const [targetType, setTargetType] = useState<"category" | "batch">("category");
  const [batchPlayerSearch, setBatchPlayerSearch] = useState("");
  const [categoriesState, setCategoriesState] = useState<string[]>([]);
  const [coachIds, setCoachIds] = useState<string[]>(isCoach ? [currentUser?.id ?? ""] : []);

  const [selectedTypeOpt, setSelectedTypeOpt] = useState("technical");
  const [customType, setCustomType] = useState("");

  const [isMultiDay, setIsMultiDay] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
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

  const currentAcademyId = useCurrentAcademyId();
  const activeFranchise = academyFranchises?.find((f) => f.id === selectedFranchiseId);
  const effectiveAcademyId = user?.academyId || activeFranchise?.academyId || currentAcademyId;
  const { data: academyData } = academyApi.useGetAcademyByIdQuery(
    effectiveAcademyId ?? "",
    { skip: !effectiveAcademyId }
  );
  const academyPitches = (academyData?.pitches || []).filter((p) => p.isActive !== false);
  const [selectedPitchId, setSelectedPitchId] = useState<string>("manual");

  const availableSessionTypes = useMemo(() => {
    if (academyData?.sessionTypes && academyData.sessionTypes.length > 0) {
      return academyData.sessionTypes.map((st) => ({
        id: st.name.toLowerCase(),
        label: st.name,
      }));
    }
    return [
      { id: "technical", label: "Technical" },
      { id: "physical", label: "Physical" },
      { id: "tactical", label: "Tactical" },
      { id: "psychological", label: "Psychological" },
      { id: "social", label: "Social" },
      { id: "match", label: "Match" },
      { id: "training", label: "Training" },
      { id: "trial", label: "Trial" },
      { id: "fitness", label: "Fitness" },
    ];
  }, [academyData?.sessionTypes]);

  useEffect(() => {
    if (availableSessionTypes.length > 0 && !availableSessionTypes.some((t) => t.id === selectedTypeOpt) && selectedTypeOpt !== "custom") {
      setSelectedTypeOpt(availableSessionTypes[0].id);
    }
  }, [availableSessionTypes, selectedTypeOpt]);

  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<{ name: string; url: string }[]>([]);

  // Cross-Franchise custom player selection states & queries
  const [crossFranchiseId, setCrossFranchiseId] = useState("");
  const { data: crossStudentsResult } = useGetStudentsQuery(
    { franchiseId: crossFranchiseId, limit: 100 },
    { skip: !crossFranchiseId }
  );
  const crossStudents = useMemo(() => {
    return (crossStudentsResult?.items ?? []).filter(
      (s) => s.isActive !== false && (!s.status || s.status === "active")
    );
  }, [crossStudentsResult?.items]);

  const otherFranchises = (academyFranchises ?? []).filter(
    (f) => f.id !== selectedFranchiseId
  );

  const { data: studentsResult } = useGetStudentsQuery(
    { franchiseId: selectedFranchiseId, limit: 100 },
    { skip: !selectedFranchiseId }
  );
  const availableStudents = useMemo(() => {
    return (studentsResult?.items ?? []).filter(
      (s) => s.isActive !== false && (!s.status || s.status === "active")
    );
  }, [studentsResult?.items]);

  React.useEffect(() => {
    if (academyFranchises && academyFranchises.length > 0 && !selectedFranchiseId) {
      setSelectedFranchiseId(academyFranchises[0].id);
    }
  }, [academyFranchises]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFranchiseId) return toast.error("Select a branch");
    if (targetType === "category" && categoriesState.length === 0) return toast.error("Select at least one category");
    if (targetType === "batch" && playerIds.length === 0) return toast.error("Select at least one player for the custom batch session");
    if (coachIds.length === 0) return toast.error("Select at least one coach");
    if (selectedTypeOpt === "custom" && !customType.trim()) return toast.error("Enter custom session type");
    if (!location) return toast.error("Location is required");

    const finalType = selectedTypeOpt === "custom" ? customType.trim() : selectedTypeOpt;

    const matchingPitch =
      selectedPitchId !== "manual"
        ? academyPitches.find((p) => p.id === selectedPitchId)
        : academyPitches.find((p) => p.name.toLowerCase() === location.trim().toLowerCase());

    onCreate({
      franchiseId: selectedFranchiseId || undefined,
      academyId: effectiveAcademyId || undefined,
      targetType,
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
      daysOfWeek: isMultiDay && daysOfWeek.length > 0 ? daysOfWeek : undefined,
      location,
      fieldNumber: fieldNumber || undefined,
      pitchId: matchingPitch?.id,
      googleMapsUrl: matchingPitch?.googleMapsUrl,
      latitude: matchingPitch?.latitude,
      longitude: matchingPitch?.longitude,
      notes: notes || undefined,
      playerIds: playerIds.length > 0 ? playerIds : undefined,
      documents: documents.length > 0 ? documents : undefined,
    });
  };

  return (
    <Modal isOpen onClose={onClose} title="New Operational Session" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5 text-xs max-h-[70vh] overflow-y-auto pr-2 no-scrollbar text-slate-800 dark:text-slate-200">
        
        {/* Franchise Selector (Academy Overview Only) */}
        {!franchiseId && academyFranchises && (
          <div>
            <Select
              label="Branch"
              value={selectedFranchiseId}
              onChange={(e) => setSelectedFranchiseId(e.target.value)}
            >
              <option value="" disabled>Select Branch</option>
              {academyFranchises.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </div>
        )}

        {/* Schedule Target Toggle */}
        {!isCoach && (
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Schedule Target
            </label>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-pitch-900 p-1 rounded-lg border border-slate-200 dark:border-white/5 w-fit">
              {(["category", "batch"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTargetType(t)}
                  className={clsx(
                    "px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-1.5 transition-all",
                    targetType === t ? "bg-volt-400 text-pitch-900 font-extrabold shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  {t === "category" ? <Layers size={12} /> : <UserCheck size={12} />}
                  {t === "category" ? "Age Categories" : "Custom Batch"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Categories or Batch Selection */}
        {targetType === "category" ? (
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
              Age Categories (Select all that apply)
            </label>
            {categories.length === 0 ? (
              <div className="p-3 rounded border border-amber-500/20 bg-amber-500/10 text-amber-500 text-xs">
                No players with assigned age categories exist in this branch yet. Age categories are automatically registered when players enroll with their birthdates.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 mt-1 border border-slate-200 dark:border-white/10 rounded p-2 max-h-32 overflow-y-auto bg-slate-50 dark:bg-pitch-900">
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
                          : "bg-white dark:bg-pitch-800 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 border border-volt-500/30 bg-volt-400/[0.04] dark:border-volt-400/20 dark:bg-volt-400/[0.03] p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-2xs font-bold text-volt-600 dark:text-volt-400 uppercase tracking-wide">
                  Custom Batch Player Selection ({playerIds.length} selected)
                </label>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Select players from the academy list. Internal alerts will be sent <strong>only</strong> to these students.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const filteredIds = availableStudents
                      .filter((s) =>
                        `${s.firstName} ${s.lastName} ${s.ageGroup} ${s.jerseyNumber || ""}`
                          .toLowerCase()
                          .includes(batchPlayerSearch.toLowerCase())
                      )
                      .map((s) => s.id);
                    const merged = Array.from(new Set([...playerIds, ...filteredIds]));
                    setPlayerIds(merged);
                  }}
                  className="text-[10px] text-volt-600 dark:text-volt-400 hover:underline font-semibold"
                >
                  Select Filtered
                </button>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => setPlayerIds([])}
                  className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-semibold"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={batchPlayerSearch}
                onChange={(e) => setBatchPlayerSearch(e.target.value)}
                placeholder="Search players by name, age category, or jersey..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-volt-400"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto border border-slate-200 dark:border-white/10 rounded p-2 bg-slate-50 dark:bg-pitch-900">
              {availableStudents.length === 0 ? (
                <p className="text-2xs text-slate-400 dark:text-slate-500 italic p-1">No players found in this branch.</p>
              ) : (
                availableStudents
                  .filter((s) =>
                    `${s.firstName} ${s.lastName} ${s.ageGroup} ${s.jerseyNumber || ""}`
                      .toLowerCase()
                      .includes(batchPlayerSearch.toLowerCase())
                  )
                  .map((s) => {
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
                          "px-2 py-1 rounded text-[10px] font-semibold border flex items-center gap-1.5 transition-all duration-150",
                          isSelected
                            ? "bg-volt-400 border-volt-400 text-pitch-900 font-extrabold shadow-sm"
                            : "bg-white dark:bg-pitch-800 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-white"
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {s.firstName} {s.lastName} ({s.ageGroup})
                        {s.jerseyNumber && <span className="opacity-75">#{s.jerseyNumber}</span>}
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* Multiple Coaches Selection */}
        {!isCoach && (
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
              Assigned Coaches (Select all that apply)
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1 border border-slate-200 dark:border-white/10 rounded p-2 max-h-32 overflow-y-auto bg-slate-50 dark:bg-pitch-900">
              {coaches.map((c) => {
                const isSelected = coachIds.includes(c.id);
                const checkDate = isMultiDay ? startDate : date;
                const isAvailable = isCoachAvailableOnDate(c, checkDate);
                const isDisabled = !isAvailable && !isSelected;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isDisabled}
                    title={!isAvailable ? "Marked unavailable on this date" : undefined}
                    onClick={() => {
                      if (isSelected) {
                        setCoachIds(coachIds.filter((id) => id !== c.id));
                      } else {
                        setCoachIds([...coachIds, c.id]);
                      }
                    }}
                    className={clsx(
                      "px-2 py-0.5 rounded text-[10px] font-semibold border transition-all duration-150",
                      isDisabled
                        ? "bg-slate-100 dark:bg-pitch-800 border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                        : isSelected
                          ? "bg-volt-400 border-volt-400 text-pitch-900 font-extrabold"
                          : "bg-white dark:bg-pitch-800 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {c.firstName} {c.lastName}
                    {!isAvailable && " · Unavailable"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Extensible Session Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Select
              label="Session Type"
              value={selectedTypeOpt}
              onChange={(e) => setSelectedTypeOpt(e.target.value)}
            >
              {availableSessionTypes.map((st) => (
                <option key={st.id} value={st.id}>{st.label}</option>
              ))}
              <option value="custom">Custom (Specify...)</option>
            </Select>
          </div>
          {selectedTypeOpt === "custom" && (
            <Input label="Custom Type Name" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="e.g. Tactical Drill" required />
          )}
        </div>

        {/* Duration Mode & Time Range */}
        <div className="border-t border-slate-200 dark:border-white/5 pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Session Duration</span>
            <button
              type="button"
              onClick={() => setIsMultiDay(!isMultiDay)}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-white uppercase border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
            <div className="space-y-3 bg-slate-50 dark:bg-white/[0.02] p-3 rounded-lg border border-slate-200 dark:border-white/5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                <Input label="Daily Start" type="time" value={dailyStartTime} onChange={(e) => setDailyStartTime(e.target.value)} required />
                <Input label="Daily End" type="time" value={dailyEndTime} onChange={(e) => setDailyEndTime(e.target.value)} required />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Filter By Specific Days (Leave empty to repeat every day)
                </label>
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
                    const active = daysOfWeek.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() =>
                          setDaysOfWeek((prev) =>
                            active ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                          )
                        }
                        className={clsx(
                          "px-2.5 py-1 text-2xs font-semibold rounded border transition-all",
                          active
                            ? "bg-volt-400 text-pitch-900 border-volt-400 font-bold"
                            : "bg-white dark:bg-pitch-800 text-slate-500 border-slate-200 dark:border-white/10"
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Location / Field Info */}
        <div className="space-y-2">
          {academyPitches.length > 0 && (
            <div>
              <Select
                label="Venue / Pitch Picker"
                value={selectedPitchId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPitchId(val);
                  if (val !== "manual") {
                    const found = academyPitches.find((p) => p.id === val);
                    if (found) {
                      setLocation(found.name);
                      setFieldNumber(found.fieldNumber || "");
                    }
                  }
                }}
              >
                <option value="manual">Enter Manually / Custom Venue</option>
                <optgroup label="Registered Academy Pitches & Venues">
                  {academyPitches.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.fieldNumber ? `(Field ${p.fieldNumber})` : ""} {p.surfaceType ? `· ${p.surfaceType}` : ""}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={academyPitches.length > 0 && selectedPitchId !== "manual" ? "Location / Venue (Selected)" : "Location / Venue"}
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                const matching = academyPitches.find((p) => p.name.toLowerCase() === e.target.value.toLowerCase());
                if (matching) {
                  setSelectedPitchId(matching.id);
                } else if (selectedPitchId !== "manual") {
                  setSelectedPitchId("manual");
                }
              }}
              placeholder="e.g. Turf 1, North Arena"
              required
            />
            <Input
              label="Field Number (Optional)"
              value={fieldNumber}
              onChange={(e) => setFieldNumber(e.target.value)}
              placeholder="e.g. Field B, Pitch 2"
            />
          </div>

          {(() => {
            const selectedPitch = academyPitches.find((p) => p.id === selectedPitchId);
            const mapsUrl = getMapsLink({
              googleMapsUrl: selectedPitch?.googleMapsUrl,
              latitude: selectedPitch?.latitude,
              longitude: selectedPitch?.longitude,
              address: selectedPitch?.address,
              location,
              fieldNumber,
            });
            return mapsUrl ? (
              <div className="flex items-center gap-1.5 pt-0.5 text-2xs">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-volt-600 dark:text-volt-400 hover:underline"
                  title="Open venue in Google Maps"
                >
                  <Navigation size={11} className="text-volt-500" />
                  <span>Preview Venue in Google Maps</span>
                  <ExternalLink size={10} />
                </a>
                {selectedPitch?.address && (
                  <span className="text-slate-400 dark:text-slate-500 truncate max-w-xs">
                    · {selectedPitch.address}
                  </span>
                )}
              </div>
            ) : null;
          })()}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Session Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none min-h-[60px]"
            placeholder="e.g. Tactical positioning focus"
          />
        </div>

        {/* Custom Overrides / Player List Selector */}
        <div className="border-t border-slate-200 dark:border-white/5 pt-3 space-y-3">
          <div>
            <Select
              label="Cross-Branch / Custom Player List (Optional)"
              helperText="Select a different branch to invite players from."
              value={crossFranchiseId}
              onChange={(e) => setCrossFranchiseId(e.target.value)}
            >
              <option value="">-- Choose a Branch --</option>
              {otherFranchises.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </div>

          {crossFranchiseId && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Available Players in {otherFranchises.find(f => f.id === crossFranchiseId)?.name}
              </p>
              {crossStudents.length === 0 ? (
                <p className="text-2xs text-slate-400 dark:text-slate-500 italic">No players registered under this branch.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border border-slate-200 dark:border-white/10 rounded p-2 bg-slate-50 dark:bg-pitch-900">
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
                            : "bg-white dark:bg-pitch-800 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10 hover:text-slate-900 dark:hover:text-white"
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
            <div className="space-y-1.5 border-t border-slate-200 dark:border-white/5 pt-2.5">
              <p className="text-[10px] font-semibold text-volt-600 dark:text-volt-400 uppercase tracking-wide">
                Invited Custom Players ({playerIds.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {playerIds.map((id) => {
                  const p = [...crossStudents, ...availableStudents].find((s) => s.id === id);
                  const displayName = p ? `${p.firstName} ${p.lastName} (${p.ageGroup})` : `Player ID: ${id.slice(-6)}`;
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-volt-400/10 border border-volt-400/30 text-volt-600 dark:text-volt-400"
                    >
                      {displayName}
                      <button
                        type="button"
                        onClick={() => setPlayerIds(playerIds.filter((pid) => pid !== id))}
                        className="text-[9px] hover:text-volt-600 dark:hover:text-volt-300 font-extrabold ml-0.5 font-mono"
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
        <div className="border-t border-slate-200 dark:border-white/5 pt-3 space-y-3">
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Attached Documents</label>
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
                <div key={idx} className="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-white/5 rounded border border-slate-200 dark:border-white/5 text-2xs text-slate-700 dark:text-slate-300">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-volt-600 dark:hover:text-volt-400 truncate max-w-[80%]">
                    {doc.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => setDocuments(documents.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-ember-500 text-[10px]"
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
  coaches: CoachAvailabilityFields[];
  onClose: () => void;
  onUpdate: (data: any) => void;
  saving: boolean;
}> = ({ session, teams, categories, coaches, onClose, onUpdate, saving }) => {
  const [categoriesState, setCategoriesState] = useState<string[]>(session.categories || (session.category ? [session.category] : []));
  const [coachIds, setCoachIds] = useState<string[]>(session.coachIds || (session.coachId ? [session.coachId] : []));

  const [selectedTypeOpt, setSelectedTypeOpt] = useState(session.type?.toLowerCase() || "technical");
  const [customType, setCustomType] = useState(session.type || "");

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
  const isCoach = user?.role === "coach";
  const { data: academyFranchises } = useGetFranchisesQuery(
    user?.academyId ? { academyId: user.academyId, isActive: true } : undefined,
    { skip: !user?.academyId }
  );

  const currentAcademyId = useCurrentAcademyId();
  const sessionFranchise = academyFranchises?.find((f) => f.id === session.franchiseId);
  const effectiveAcademyId = user?.academyId || sessionFranchise?.academyId || currentAcademyId;
  const { data: academyData } = academyApi.useGetAcademyByIdQuery(
    effectiveAcademyId ?? "",
    { skip: !effectiveAcademyId }
  );
  const academyPitches = (academyData?.pitches || []).filter((p) => p.isActive !== false);

  const availableSessionTypes = useMemo(() => {
    if (academyData?.sessionTypes && academyData.sessionTypes.length > 0) {
      return academyData.sessionTypes.map((st) => ({
        id: st.name.toLowerCase(),
        label: st.name,
      }));
    }
    return [
      { id: "technical", label: "Technical" },
      { id: "physical", label: "Physical" },
      { id: "tactical", label: "Tactical" },
      { id: "psychological", label: "Psychological" },
      { id: "social", label: "Social" },
      { id: "match", label: "Match" },
      { id: "training", label: "Training" },
      { id: "trial", label: "Trial" },
      { id: "fitness", label: "Fitness" },
    ];
  }, [academyData?.sessionTypes]);

  const matchedPitch = academyPitches.find(
    (p) => p.name.toLowerCase() === (session.location || "").toLowerCase()
  );
  const [selectedPitchId, setSelectedPitchId] = useState<string>(
    matchedPitch ? matchedPitch.id : "manual"
  );

  const [crossFranchiseId, setCrossFranchiseId] = useState("");
  const { data: crossStudentsResult } = useGetStudentsQuery(
    { franchiseId: crossFranchiseId, limit: 100 },
    { skip: !crossFranchiseId }
  );
  const crossStudents = useMemo(() => {
    return (crossStudentsResult?.items ?? []).filter(
      (s) => s.isActive !== false && (!s.status || s.status === "active" || session.playerIds?.includes(s.id))
    );
  }, [crossStudentsResult?.items, session.playerIds]);

  const otherFranchises = (academyFranchises ?? []).filter(
    (f) => f.id !== session.franchiseId
  );

  const { data: studentsResult } = useGetStudentsQuery(
    { franchiseId: session.franchiseId, limit: 100 },
    { skip: !session.franchiseId }
  );
  const availableStudents = useMemo(() => {
    return (studentsResult?.items ?? []).filter(
      (s) => s.isActive !== false && (!s.status || s.status === "active" || session.playerIds?.includes(s.id))
    );
  }, [studentsResult?.items, session.playerIds]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (coachIds.length === 0) return toast.error("Select at least one coach");
    if (selectedTypeOpt === "custom" && !customType.trim()) return toast.error("Enter custom session type");
    if (!location) return toast.error("Location is required");

    const finalType = selectedTypeOpt === "custom" ? customType.trim() : selectedTypeOpt;

    const matchingPitch =
      selectedPitchId !== "manual"
        ? academyPitches.find((p) => p.id === selectedPitchId)
        : academyPitches.find((p) => p.name.toLowerCase() === location.trim().toLowerCase());

    onUpdate({
      categories: session.targetType === "category" ? categoriesState : undefined,
      coachIds: isCoach ? undefined : coachIds,
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
      pitchId: matchingPitch?.id,
      googleMapsUrl: matchingPitch?.googleMapsUrl,
      latitude: matchingPitch?.latitude,
      longitude: matchingPitch?.longitude,
      notes: notes || undefined,
      playerIds,
      documents,
    });
  };

  return (
    <Modal isOpen onClose={onClose} title={`Edit Session — ${session.teamName || session.category || "General"}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-5 text-xs max-h-[70vh] overflow-y-auto pr-2 no-scrollbar">
        
        {/* Read-only target info */}
        <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-lg">
          <p className="text-2xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Target Squad</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
            {session.targetType === "team"
              ? `Team: ${session.teamName}`
              : session.targetType === "batch"
                ? `Custom Batch (${session.playerIds?.length || 0} players)`
                : `Categories: ${categoriesState.join(", ")}`}
          </p>
        </div>

        {/* Categories multiselect (only if category target) */}
        {session.targetType === "category" && (
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
              Age Categories (Select all that apply)
            </label>
            {Array.from(new Set([...categories, ...categoriesState])).length === 0 ? (
              <div className="p-3 rounded border border-amber-500/20 bg-amber-500/10 text-amber-500 text-xs">
                No players with assigned age categories exist in this branch yet.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 mt-1 border border-slate-200 dark:border-white/10 rounded p-2 max-h-32 overflow-y-auto bg-slate-50 dark:bg-pitch-900">
                {Array.from(new Set([...categories, ...categoriesState])).map((c) => {
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
                          ? "bg-volt-400 border-volt-400 text-pitch-900 font-extrabold shadow-sm"
                          : "bg-white dark:bg-pitch-800 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Multiple Coaches Selection */}
        {!isCoach ? (
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
              Assigned Coaches (Select all that apply)
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1 border border-slate-200 dark:border-white/10 rounded p-2 max-h-32 overflow-y-auto bg-slate-50 dark:bg-pitch-900">
              {coaches.map((c) => {
                const isSelected = coachIds.includes(c.id);
                const checkDate = isMultiDay ? session.startDate ?? date : date;
                const isAvailable = isCoachAvailableOnDate(c, checkDate);
                const isDisabled = !isAvailable && !isSelected;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isDisabled}
                    title={!isAvailable ? "Marked unavailable on this date" : undefined}
                    onClick={() => {
                      if (isSelected) {
                        setCoachIds(coachIds.filter((id) => id !== c.id));
                      } else {
                        setCoachIds([...coachIds, c.id]);
                      }
                    }}
                    className={clsx(
                      "px-2 py-0.5 rounded text-[10px] font-semibold border transition-all duration-150",
                      isDisabled
                        ? "bg-slate-100 dark:bg-pitch-800 border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                        : isSelected
                          ? "bg-volt-400 border-volt-400 text-pitch-900 font-extrabold shadow-sm"
                          : "bg-white dark:bg-pitch-800 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {c.firstName} {c.lastName}
                    {!isAvailable && " · Unavailable"}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
              Assigned Coaches
            </label>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              {session.coaches && session.coaches.length > 0
                ? session.coaches.map((c) => `Coach ${c}`).join(", ")
                : session.coach
                  ? `Coach ${session.coach}`
                  : "Assigned Coach"}
            </p>
          </div>
        )}

        {/* Extensible Session Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Select
              label="Session Type"
              value={selectedTypeOpt}
              onChange={(e) => setSelectedTypeOpt(e.target.value)}
            >
              {availableSessionTypes.map((st) => (
                <option key={st.id} value={st.id}>{st.label}</option>
              ))}
              <option value="custom">Custom (Specify...)</option>
            </Select>
          </div>
          {selectedTypeOpt === "custom" && (
            <Input label="Custom Type Name" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="e.g. Friendly Match" required />
          )}
        </div>

        {/* Duration Mode & Time Range */}
        <div className="border-t border-slate-200 dark:border-white/5 pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Session Duration</span>
            <button
              type="button"
              onClick={() => setIsMultiDay(!isMultiDay)}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-white uppercase border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
            <div className="grid grid-cols-4 gap-3 bg-slate-50 dark:bg-white/[0.02] p-3 rounded-lg border border-slate-200 dark:border-white/5">
              <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              <Input label="Daily Start" type="time" value={dailyStartTime} onChange={(e) => setDailyStartTime(e.target.value)} required />
              <Input label="Daily End" type="time" value={dailyEndTime} onChange={(e) => setDailyEndTime(e.target.value)} required />
            </div>
          )}
        </div>

        {/* Location / Field Info */}
        <div className="space-y-2">
          {academyPitches.length > 0 && (
            <div>
              <Select
                label="Venue / Pitch Picker"
                value={selectedPitchId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPitchId(val);
                  if (val !== "manual") {
                    const found = academyPitches.find((p) => p.id === val);
                    if (found) {
                      setLocation(found.name);
                      setFieldNumber(found.fieldNumber || "");
                    }
                  }
                }}
              >
                <option value="manual">Enter Manually / Custom Venue</option>
                <optgroup label="Registered Academy Pitches & Venues">
                  {academyPitches.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.fieldNumber ? `(Field ${p.fieldNumber})` : ""} {p.surfaceType ? `· ${p.surfaceType}` : ""}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={academyPitches.length > 0 && selectedPitchId !== "manual" ? "Location / Venue (Selected)" : "Location / Venue"}
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                const matching = academyPitches.find((p) => p.name.toLowerCase() === e.target.value.toLowerCase());
                if (matching) {
                  setSelectedPitchId(matching.id);
                } else if (selectedPitchId !== "manual") {
                  setSelectedPitchId("manual");
                }
              }}
              placeholder="e.g. Turf 1, North Arena"
              required
            />
            <Input
              label="Field Number (Optional)"
              value={fieldNumber}
              onChange={(e) => setFieldNumber(e.target.value)}
              placeholder="e.g. Field B, Pitch 2"
            />
          </div>

          {(() => {
            const selectedPitch = academyPitches.find((p) => p.id === selectedPitchId);
            const mapsUrl = getMapsLink({
              googleMapsUrl: selectedPitch?.googleMapsUrl || session.googleMapsUrl,
              latitude: selectedPitch?.latitude || session.latitude,
              longitude: selectedPitch?.longitude || session.longitude,
              address: selectedPitch?.address,
              location,
              fieldNumber,
            });
            return mapsUrl ? (
              <div className="flex items-center gap-1.5 pt-0.5 text-2xs">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-volt-600 dark:text-volt-400 hover:underline"
                  title="Open venue in Google Maps"
                >
                  <Navigation size={11} className="text-volt-500" />
                  <span>Preview Venue in Google Maps</span>
                  <ExternalLink size={10} />
                </a>
                {selectedPitch?.address && (
                  <span className="text-slate-400 dark:text-slate-500 truncate max-w-xs">
                    · {selectedPitch.address}
                  </span>
                )}
              </div>
            ) : null;
          })()}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Session Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-volt-400 min-h-[60px]"
            placeholder="e.g. Tactical positioning focus"
          />
        </div>

        {/* Custom Overrides / Player List Selector */}
        <div className="border-t border-slate-200 dark:border-white/5 pt-3 space-y-3">
          <div>
            <Select
              label="Cross-Branch / Custom Player List (Optional)"
              helperText="Select a different branch to invite players from."
              value={crossFranchiseId}
              onChange={(e) => setCrossFranchiseId(e.target.value)}
            >
              <option value="">-- Choose a Branch --</option>
              {otherFranchises.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </div>

          {crossFranchiseId && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Available Players in {otherFranchises.find(f => f.id === crossFranchiseId)?.name}
              </p>
              {crossStudents.length === 0 ? (
                <p className="text-2xs text-slate-500 italic">No players registered under this branch.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border border-slate-200 dark:border-white/10 rounded p-2 bg-slate-50 dark:bg-pitch-900">
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
                            ? "bg-volt-400 border-volt-400 text-pitch-900 font-extrabold shadow-sm"
                            : "bg-white dark:bg-pitch-800 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10 hover:text-slate-900 dark:hover:text-white"
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
            <div className="space-y-1.5 border-t border-slate-200 dark:border-white/5 pt-2.5">
              <p className="text-[10px] font-semibold text-volt-500 dark:text-volt-400 uppercase tracking-wide">
                Invited Custom Players ({playerIds.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {playerIds.map((id) => {
                  const p = [...crossStudents, ...availableStudents].find((s) => s.id === id);
                  const displayName = p ? `${p.firstName} ${p.lastName} (${p.ageGroup})` : `Player ID: ${id.slice(-6)}`;
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-volt-500/10 dark:bg-volt-400/10 border border-volt-500/20 dark:border-volt-400/20 text-volt-600 dark:text-volt-400"
                    >
                      {displayName}
                      <button
                        type="button"
                        onClick={() => setPlayerIds(playerIds.filter((pid) => pid !== id))}
                        className="text-[9px] hover:text-volt-700 dark:hover:text-volt-300 font-extrabold ml-0.5 font-mono"
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
        <div className="border-t border-slate-200 dark:border-white/5 pt-3 space-y-3">
          <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Attached Documents</label>
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
                <div key={idx} className="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-white/5 rounded border border-slate-200 dark:border-white/5 text-2xs text-slate-700 dark:text-slate-300">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-volt-600 dark:hover:text-volt-400 truncate max-w-[80%]">
                    {doc.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => setDocuments(documents.filter((_, i) => i !== idx))}
                    className="text-slate-500 hover:text-ember-500 dark:hover:text-ember-400 text-[10px]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" loading={saving} className="w-full text-xs font-semibold py-2.5 bg-volt-400 hover:bg-volt-300 text-pitch-900 shadow-sm">
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
      <p className="text-2xs text-slate-500 dark:text-slate-400">Guardians will receive an emergency cancellation push notification.</p>
      <Button type="submit" variant="danger" loading={saving} className="w-full text-xs font-semibold">
        Confirm Cancellation
      </Button>
    </form>
  );
};

export default SchedulePage;