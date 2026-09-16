// src/features/students/FreeAgentsTab.tsx
import React, { useState, useEffect } from "react";
import {
  useGetUnattachedStudentsQuery,
  type Student,
} from "@/store/api/studentsApi";
import {
  useGetAcademySquadInvitationsQuery,
  useCancelSquadInvitationMutation,
  type SquadInvitation,
} from "@/store/api/squadInvitationApi";
import { Button, Input, Badge, EmptyState } from "@/components/ui";
import {
  Search,
  UserPlus,
  Mail,
  ExternalLink,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  Shield,
  Filter,
  AlertTriangle,
} from "lucide-react";
import { InviteUnattachedStudentModal } from "./ClaimUnattachedStudentModal";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrentAcademyId } from "@/hooks/useCurrentAcademyId";
import { useGetAcademySubscriptionStatusQuery } from "@/store/api/academySubscriptionApi";
import { SubscriptionModal } from "../subscription/SubscriptionModal";
import toast from "react-hot-toast";

interface FreeAgentsTabProps {
  franchiseId: string;
  teams: Array<{ id: string; name: string }>;
}

export const FreeAgentsTab: React.FC<FreeAgentsTabProps> = ({
  franchiseId,
  teams,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [viewMode, setViewMode] = useState<"directory" | "invitations">("directory");
  const [selectedStudentForInvite, setSelectedStudentForInvite] = useState<Student | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { confirm, ConfirmDialog } = useConfirm();

  const academyId = useCurrentAcademyId();
  const {
    data: subStatus,
    refetch: refetchSubStatus,
  } = useGetAcademySubscriptionStatusQuery(academyId ?? "", {
    skip: !academyId,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    data: freeAgentsData,
    isLoading: isLoadingFreeAgents,
    isFetching: isFetchingFreeAgents,
    refetch: refetchFreeAgents,
  } = useGetUnattachedStudentsQuery({
    search: debouncedSearch || undefined,
    ageGroup: ageFilter || undefined,
    limit: 100,
  });

  const {
    data: sentInvitations,
    isLoading: isLoadingInvitations,
    refetch: refetchInvitations,
  } = useGetAcademySquadInvitationsQuery();

  const [cancelInvitation, { isLoading: isCancelling }] = useCancelSquadInvitationMutation();

  const freeAgents: Student[] = freeAgentsData?.students ?? (freeAgentsData as any)?.items ?? [];
  const invitations = sentInvitations || [];
  const pendingCount = invitations.filter((i) => i.status === "pending").length;

  // Subscription capacity calculations
  const provisionedCapacity = subStatus?.provisionedCapacity ?? 0;
  const activeStudentCount = subStatus?.activeStudentCount ?? 0;
  const totalOccupiedSlots = activeStudentCount + pendingCount;
  const remainingInviteSlots = Math.max(0, provisionedCapacity - totalOccupiedSlots);
  const hasActiveSubscription = !!subStatus?.hasSubscription && !!subStatus?.isActive;
  const isCapacityReached = hasActiveSubscription && provisionedCapacity > 0 && remainingInviteSlots <= 0;

  const pendingStudentIds = new Set(
    invitations
      .filter((inv) => inv.status === "pending")
      .map((inv) => (typeof inv.studentId === "object" ? inv.studentId?.id || inv.studentId?._id : inv.studentId))
  );

  const handleOpenInvite = (student: Student) => {
    if (isCapacityReached) {
      toast.error(
        `Player limit reached (${totalOccupiedSlots}/${provisionedCapacity} slots committed). Upgrade your subscription or withdraw a pending invite to invite more players.`
      );
      return;
    }
    setSelectedStudentForInvite(student);
    setIsInviteModalOpen(true);
  };

  const handleCancelInvite = async (invitationId: string, playerName: string) => {
    const confirmed = await confirm({
      title: "Cancel Squad Invitation",
      message: `Are you sure you want to withdraw the invitation sent to ${playerName}?`,
      confirmLabel: "Withdraw Invite",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await cancelInvitation(invitationId).unwrap();
      toast.success("Invitation withdrawn");
      refetchInvitations();
      refetchFreeAgents();
      refetchSubStatus();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to cancel invitation");
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-header Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-100/70 dark:bg-pitch-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("directory")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "directory"
                ? "bg-volt-400 text-pitch-900 shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-pitch-700"
            }`}
          >
            Available Free Agents ({freeAgents.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("invitations")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              viewMode === "invitations"
                ? "bg-volt-400 text-pitch-900 shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-pitch-700"
            }`}
          >
            <span>Sent Invitations</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-pitch-900 font-mono text-2xs font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {viewMode === "directory" && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Input
                placeholder="Filter by name or position..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="h-3.5 w-3.5 text-slate-400" />}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <select
              className="input text-xs w-32"
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
            >
              <option value="">All Ages</option>
              {Array.from({ length: 15 }, (_, i) => `U-${i + 6}`).map((ag) => (
                <option key={ag} value={ag}>
                  {ag}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Subscription Capacity Banner */}
      {hasActiveSubscription && (
        <div
          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
            isCapacityReached
              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
              : remainingInviteSlots <= 2
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
              : "bg-slate-100/80 dark:bg-pitch-800/40 border-slate-200/80 dark:border-white/[0.06] text-slate-700 dark:text-slate-300"
          }`}
        >
          <div className="flex items-start sm:items-center gap-2.5">
            <div
              className={`p-2 rounded-lg shrink-0 ${
                isCapacityReached
                  ? "bg-rose-500/20 text-rose-400"
                  : remainingInviteSlots <= 2
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-volt-400/15 text-volt-500"
              }`}
            >
              {isCapacityReached ? <AlertTriangle size={18} /> : <Shield size={18} />}
            </div>
            <div>
              <div className="font-semibold flex items-center gap-2">
                <span>Subscription Roster Capacity</span>
                <span
                  className={`font-mono text-2xs px-2 py-0.5 rounded-full font-bold ${
                    isCapacityReached
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : "bg-volt-400/20 text-volt-600 dark:text-volt-400 border border-volt-400/30"
                  }`}
                >
                  {totalOccupiedSlots} / {provisionedCapacity} Slots Committed
                </span>
              </div>
              <p className="text-2xs opacity-85 mt-0.5">
                {activeStudentCount} active enrolled player{activeStudentCount === 1 ? "" : "s"} + {pendingCount} pending invite{pendingCount === 1 ? "" : "s"}.
                {" "}
                {isCapacityReached ? (
                  <span className="font-semibold text-rose-400">
                    Player limit reached — max {Math.max(0, provisionedCapacity - activeStudentCount)} pending invitation{Math.max(0, provisionedCapacity - activeStudentCount) === 1 ? "" : "s"} allowed.
                  </span>
                ) : (
                  <span>
                    You can invite up to <strong className="text-volt-600 dark:text-volt-400">{remainingInviteSlots}</strong> more player{remainingInviteSlots === 1 ? "" : "s"}.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isCapacityReached && academyId && (
              <Button
                size="sm"
                onClick={() => setShowUpgradeModal(true)}
                className="text-xs !py-1 !px-3 bg-rose-500 hover:bg-rose-600 text-white font-bold"
              >
                Upgrade Capacity
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Directory View */}
      {viewMode === "directory" && (
        <>
          {isLoadingFreeAgents || isFetchingFreeAgents ? (
            <div className="card p-12 text-center text-slate-500 animate-pulse text-xs">
              Scouting free agents from public registrations...
            </div>
          ) : freeAgents.length === 0 ? (
            <EmptyState
              title="No free agents found"
              description="There are currently no unattached players matching your filter. Unaffiliated players register via the public portal."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {freeAgents.map((st) => {
                const isPending = pendingStudentIds.has(st.id);
                return (
                  <div
                    key={st.id}
                    className="card p-4 flex flex-col justify-between gap-3 hover:border-slate-300 dark:hover:border-white/20 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-pitch-800 border border-slate-300 dark:border-white/10 overflow-hidden flex items-center justify-center font-display font-bold text-slate-700 dark:text-white shrink-0">
                          {st.photo ? (
                            <img src={st.photo} alt={st.firstName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm">
                              {st.firstName[0]}
                              {st.lastName[0]}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            {st.firstName} {st.lastName}
                            <span className="pill pill-yellow !py-0 !px-2 text-2xs font-mono">
                              {st.ageGroup}
                            </span>
                          </div>
                          <p className="text-2xs text-slate-500 mt-0.5">
                            Position: <span className="text-slate-800 dark:text-slate-300 font-medium">{st.position || "Unspecified"}</span>
                          </p>
                          <p className="text-2xs text-slate-500">
                            Overall Rating:{" "}
                            <span className="font-mono font-bold text-field-500 dark:text-volt-400">
                              {st.overallRating ? Number(st.overallRating).toFixed(1) : "—"}
                            </span>
                          </p>
                        </div>
                      </div>

                      {st.publicProfileToken && (
                        <a
                          href={`${window.location.origin}/players/${st.publicProfileToken}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                          title="Open Public Card"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between">
                      <span className="text-2xs text-slate-400">
                        {st.guardian?.phone ? `Contact: ${st.guardian.phone}` : "Verified Free Agent"}
                      </span>

                      {isPending ? (
                        <span className="text-2xs font-mono font-semibold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md flex items-center gap-1">
                          <Mail size={12} /> Invite Pending
                        </span>
                      ) : isCapacityReached ? (
                        <Button
                          size="sm"
                          disabled
                          className="text-xs !py-1 !px-3 bg-slate-200 dark:bg-pitch-800 text-slate-400 cursor-not-allowed font-medium"
                          title="Player limit reached. Upgrade subscription or withdraw a pending invite to invite more players."
                        >
                          <Shield size={12} className="mr-1 text-slate-400" /> Limit Reached
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleOpenInvite(st)}
                          className="text-xs !py-1 !px-3 bg-volt-400 text-pitch-900 font-bold hover:bg-volt-300"
                        >
                          <UserPlus size={12} className="mr-1" /> Invite to Squad
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Invitations View */}
      {viewMode === "invitations" && (
        <>
          {isLoadingInvitations ? (
            <div className="card p-12 text-center text-slate-500 animate-pulse text-xs">
              Loading recruitment invitations...
            </div>
          ) : invitations.length === 0 ? (
            <EmptyState
              title="No invitations sent yet"
              description="Invitations sent to free agents will appear here with live tracking of their response."
            />
          ) : (
            <div className="space-y-2">
              {invitations.map((inv) => {
                const studentName =
                  typeof inv.studentId === "object" && inv.studentId
                    ? `${inv.studentId.firstName} ${inv.studentId.lastName}`
                    : "Student";
                const teamName =
                  typeof inv.teamId === "object" && inv.teamId
                    ? inv.teamId.name
                    : "Unassigned Team";

                const inviteId = inv.id || (inv as any)._id;

                return (
                  <div
                    key={inviteId}
                    className="card p-3 flex items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-volt-400/10 text-volt-500 font-display font-bold flex items-center justify-center shrink-0">
                        <Mail size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                          {studentName}
                          <span
                            className={`text-2xs font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                              inv.status === "pending"
                                ? "bg-amber-500/15 text-amber-500"
                                : inv.status === "accepted"
                                ? "bg-emerald-500/15 text-emerald-500"
                                : inv.status === "rejected"
                                ? "bg-rose-500/15 text-rose-500"
                                : "bg-slate-500/15 text-slate-400"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </div>
                        <div className="text-2xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Team: {teamName}</span>
                          {inv.position && (
                            <>
                              <span>•</span>
                              <span>Pos: {inv.position}</span>
                            </>
                          )}
                          {inv.jerseyNumber && (
                            <>
                              <span>•</span>
                              <span>Jersey: #{inv.jerseyNumber}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>Sent {new Date(inv.createdAt).toLocaleDateString()}</span>
                        </div>
                        {inv.notes && (
                          <p className="text-2xs text-slate-400 italic mt-1 max-w-md line-clamp-1">
                            "{inv.notes}"
                          </p>
                        )}
                        {inv.rejectionReason && (
                          <p className="text-2xs text-rose-400 mt-1">
                            Reason: {inv.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {inv.status === "pending" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCancelInvite(inviteId, studentName)}
                          loading={isCancelling}
                          className="text-xs text-rose-400 hover:text-rose-300"
                        >
                          Withdraw
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Invite Modal */}
      <InviteUnattachedStudentModal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          setSelectedStudentForInvite(null);
        }}
        franchiseId={franchiseId}
        teams={teams}
        preselectedStudent={selectedStudentForInvite}
        onInvited={() => {
          refetchInvitations();
          refetchFreeAgents();
          refetchSubStatus();
        }}
      />

      {/* Upgrade Subscription Modal */}
      {showUpgradeModal && academyId && (
        <SubscriptionModal
          academyId={academyId}
          mode="upgrade"
          onClose={() => setShowUpgradeModal(false)}
          onSuccess={() => {
            setShowUpgradeModal(false);
            refetchSubStatus();
          }}
        />
      )}

      {ConfirmDialog}
    </div>
  );
};

