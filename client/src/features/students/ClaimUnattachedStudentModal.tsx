// src/features/students/ClaimUnattachedStudentModal.tsx
import React, { useState, useEffect } from "react";
import {
  useGetUnattachedStudentsQuery,
  type Student,
} from "@/store/api/studentsApi";
import {
  useSendSquadInvitationMutation,
  useGetAcademySquadInvitationsQuery,
} from "@/store/api/squadInvitationApi";
import { Button, Modal, Badge, EmptyState, Input } from "@/components/ui";
import {
  Search,
  UserPlus,
  Send,
  Shield,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  X,
  Mail,
  AlertTriangle,
} from "lucide-react";
import { useCurrentAcademyId } from "@/hooks/useCurrentAcademyId";
import { useGetAcademySubscriptionStatusQuery } from "@/store/api/academySubscriptionApi";
import { SubscriptionModal } from "../subscription/SubscriptionModal";
import toast from "react-hot-toast";

interface InviteUnattachedStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  franchiseId: string;
  teams: Array<{ id: string; name: string }>;
  preselectedStudent?: Student | null;
  onInvited?: () => void;
}

export const InviteUnattachedStudentModal: React.FC<InviteUnattachedStudentModalProps> = ({
  isOpen,
  onClose,
  franchiseId,
  teams,
  preselectedStudent,
  onInvited,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const academyId = useCurrentAcademyId();
  const {
    data: subStatus,
    refetch: refetchSubStatus,
  } = useGetAcademySubscriptionStatusQuery(academyId ?? "", {
    skip: !isOpen || !academyId,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, refetch } = useGetUnattachedStudentsQuery(
    { search: debouncedSearch || undefined, ageGroup: ageFilter || undefined, limit: 50 },
    { skip: !isOpen }
  );

  const { data: sentInvitations, refetch: refetchInvitations } = useGetAcademySquadInvitationsQuery(
    undefined,
    { skip: !isOpen }
  );

  const [sendInvitation, { isLoading: sending }] = useSendSquadInvitationMutation();

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    teamId: "",
    jerseyNumber: "",
    position: "Midfielder",
    notes: "",
  });

  // Capacity calculations
  const pendingInvitations = (sentInvitations || []).filter((inv) => inv.status === "pending");
  const pendingCount = pendingInvitations.length;
  const provisionedCapacity = subStatus?.provisionedCapacity ?? 0;
  const activeStudentCount = subStatus?.activeStudentCount ?? 0;
  const totalOccupiedSlots = activeStudentCount + pendingCount;
  const remainingInviteSlots = Math.max(0, provisionedCapacity - totalOccupiedSlots);
  const hasActiveSubscription = !!subStatus?.hasSubscription && !!subStatus?.isActive;
  const isCapacityReached = hasActiveSubscription && provisionedCapacity > 0 && remainingInviteSlots <= 0;

  useEffect(() => {
    if (preselectedStudent) {
      handleSelectToInvite(preselectedStudent);
    }
  }, [preselectedStudent]);

  const students: Student[] = data?.students ?? (data as any)?.items ?? [];

  const handleSelectToInvite = (student: Student) => {
    if (isCapacityReached) {
      toast.error(
        `Player limit reached (${totalOccupiedSlots}/${provisionedCapacity} slots committed). Upgrade your subscription or withdraw a pending invite to invite more players.`
      );
      return;
    }
    setSelectedStudent(student);
    setAssignmentForm({
      teamId: teams[0]?.id || "",
      jerseyNumber: student.jerseyNumber ? String(student.jerseyNumber) : "",
      position: student.position || "Midfielder",
      notes: "We'd love to have you join our squad! Review our offer and accept to enroll.",
    });
  };

  const handleConfirmInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    if (isCapacityReached) {
      toast.error(
        `Player limit reached (${totalOccupiedSlots}/${provisionedCapacity} slots committed). Upgrade your plan or withdraw a pending invite.`
      );
      return;
    }

    try {
      await sendInvitation({
        studentId: selectedStudent.id,
        franchiseId,
        teamId: assignmentForm.teamId || undefined,
        jerseyNumber: assignmentForm.jerseyNumber ? Number(assignmentForm.jerseyNumber) : undefined,
        position: assignmentForm.position || undefined,
        notes: assignmentForm.notes.trim() || undefined,
      }).unwrap();

      toast.success(
        `Invitation sent to ${selectedStudent.firstName} ${selectedStudent.lastName}! They will appear in your squad once accepted.`
      );
      setSelectedStudent(null);
      refetch();
      refetchInvitations();
      refetchSubStatus();
      if (onInvited) onInvited();
      onClose();
    } catch (err: any) {
      const code = err?.data?.code;
      if (code === "SUBSCRIPTION_CAPACITY_EXCEEDED" && academyId) {
        toast.error(err?.data?.message || "Roster capacity exceeded.");
        setShowUpgradeModal(true);
      } else {
        toast.error(err?.data?.message || "Failed to send squad invitation");
      }
    }
  };

  const pendingStudentIds = new Set(
    (sentInvitations || [])
      .filter((inv) => inv.status === "pending")
      .map((inv) => (typeof inv.studentId === "object" ? inv.studentId?.id || inv.studentId?._id : inv.studentId))
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Free Agent to Squad"
      size="lg"
    >
      <div className="space-y-4 pt-2">
        <p className="text-xs text-slate-500">
          Search independent free agents and send an official squad invitation. Players will review the invitation in their portal before joining your roster.
        </p>

        {/* Capacity Indicator Banner */}
        {hasActiveSubscription && (
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              isCapacityReached
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                : remainingInviteSlots <= 2
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                : "bg-slate-100 dark:bg-pitch-800/60 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {isCapacityReached ? (
                <AlertTriangle size={16} className="text-rose-400 shrink-0" />
              ) : (
                <Shield size={16} className="text-volt-500 dark:text-volt-400 shrink-0" />
              )}
              <div>
                <span className="font-semibold">
                  Plan Capacity: {totalOccupiedSlots} / {provisionedCapacity} slots committed
                </span>
                <span className="opacity-75 block sm:inline sm:ml-1 text-2xs">
                  ({activeStudentCount} active, {pendingCount} pending)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isCapacityReached ? (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-rose-400 text-2xs uppercase tracking-wide">
                    Limit Reached
                  </span>
                  {academyId && (
                    <Button
                      size="sm"
                      onClick={() => setShowUpgradeModal(true)}
                      className="text-2xs !py-0.5 !px-2 bg-rose-500 hover:bg-rose-600 text-white font-bold"
                    >
                      Upgrade
                    </Button>
                  )}
                </div>
              ) : (
                <span className="font-mono text-2xs text-volt-600 dark:text-volt-400 font-bold">
                  {remainingInviteSlots} slot{remainingInviteSlots === 1 ? "" : "s"} left
                </span>
              )}
            </div>
          </div>
        )}

        {!selectedStudent && (
          <>
            {/* Search & filter */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Input
                  placeholder="Search by player name or position..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={<Search className="h-4 w-4 text-slate-400" />}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 transition-colors"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="w-36">
                <select
                  className="input text-xs"
                  value={ageFilter}
                  onChange={(e) => setAgeFilter(e.target.value)}
                >
                  <option value="">All Age Groups</option>
                  {Array.from({ length: 15 }, (_, i) => `U-${i + 6}`).map((ag) => (
                    <option key={ag} value={ag}>
                      {ag}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Student list */}
            {isLoading || isFetching ? (
              <div className="card p-8 text-center text-slate-500 animate-pulse text-xs">
                Searching available free agents…
              </div>
            ) : students.length === 0 ? (
              <EmptyState
                title="No free agent players found"
                description="No unattached students match your current search criteria."
              />
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {students.map((st) => {
                  const isPending = pendingStudentIds.has(st.id);
                  return (
                    <div
                      key={st.id}
                      className="card p-3 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-volt-400/15 text-volt-500 font-display font-bold text-sm flex items-center justify-center overflow-hidden">
                          {st.photo ? (
                            <img src={st.photo} alt={st.firstName} className="w-full h-full object-cover" />
                          ) : (
                            <>
                              {st.firstName[0]}
                              {st.lastName[0]}
                            </>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                            {st.firstName} {st.lastName}
                            <span className="pill pill-yellow !py-0 !px-2 text-2xs font-mono">
                              {st.ageGroup}
                            </span>
                          </div>
                          <div className="text-2xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>Pos: {st.position || "—"}</span>
                            <span>•</span>
                            <span>Rating: {st.overallRating ? Number(st.overallRating).toFixed(1) : "—"}</span>
                            {st.guardian?.phone && (
                              <>
                                <span>•</span>
                                <span>Contact: {st.guardian.phone}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {st.publicProfileToken && (
                          <a
                            href={`${window.location.origin}/players/${st.publicProfileToken}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-2xs text-slate-400 hover:text-slate-600 dark:hover:text-white inline-flex items-center gap-1"
                          >
                            Profile <ExternalLink size={10} />
                          </a>
                        )}
                        {isPending ? (
                          <span className="text-2xs font-mono font-semibold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md flex items-center gap-1">
                            <Mail size={12} /> Invite Pending
                          </span>
                        ) : isCapacityReached ? (
                          <Button
                            size="sm"
                            disabled
                            className="text-xs !py-1 !px-2.5 bg-slate-200 dark:bg-pitch-800 text-slate-400 cursor-not-allowed font-semibold"
                            title="Player limit reached. Upgrade capacity to invite more players."
                          >
                            Limit Reached
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleSelectToInvite(st)}
                            className="text-xs !py-1 !px-2.5 bg-volt-400 text-pitch-900 font-semibold hover:bg-volt-300"
                          >
                            <UserPlus size={12} /> Invite to Squad
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

        {/* Assignment & Invitation Form */}
        {selectedStudent && (
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
              <div>
                <h4 className="font-semibold text-xs text-slate-900 dark:text-white">
                  Send Squad Invitation to {selectedStudent.firstName} {selectedStudent.lastName}
                </h4>
                <p className="text-2xs text-slate-500">
                  Player will receive this invitation in their Student Portal to accept or decline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                Back to search
              </button>
            </div>

            {isCapacityReached && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                <span>
                  <strong>Limit Reached:</strong> Your subscription allows up to {provisionedCapacity} players ({activeStudentCount} enrolled + {pendingCount} pending invites). Upgrade your plan or withdraw pending invites to send this invitation.
                </span>
                {academyId && (
                  <button
                    type="button"
                    onClick={() => setShowUpgradeModal(true)}
                    className="underline font-bold text-rose-300 hover:text-rose-200 shrink-0 ml-2 text-2xs"
                  >
                    Upgrade Plan
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleConfirmInvite} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Target Team</label>
                  <select
                    value={assignmentForm.teamId}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, teamId: e.target.value })}
                    className="input text-xs"
                    disabled={isCapacityReached}
                  >
                    <option value="">Unassigned Team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Offered Position</label>
                  <select
                    value={assignmentForm.position}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, position: e.target.value })}
                    className="input text-xs"
                    disabled={isCapacityReached}
                  >
                    <option value="Forward">Forward</option>
                    <option value="Winger">Winger</option>
                    <option value="Midfielder">Midfielder</option>
                    <option value="Defensive Midfielder">Defensive Midfielder</option>
                    <option value="Defender">Defender</option>
                    <option value="Full Back">Full Back</option>
                    <option value="Goalkeeper">Goalkeeper</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Proposed Jersey Number (Optional)</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  placeholder="e.g. 10"
                  value={assignmentForm.jerseyNumber}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, jerseyNumber: e.target.value })}
                  className="input text-xs"
                  disabled={isCapacityReached}
                />
              </div>

              <div>
                <label className="label">Personal Message / Recruitment Note</label>
                <textarea
                  rows={3}
                  value={assignmentForm.notes}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })}
                  placeholder="Add a message for the player regarding their squad placement, training days, or welcome note..."
                  className="input text-xs"
                  disabled={isCapacityReached}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedStudent(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={sending}
                  disabled={isCapacityReached}
                  className="bg-volt-400 text-pitch-900 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={12} className="mr-1.5" /> Send Invitation
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

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
    </Modal>
  );
};

// Backwards compatibility alias
export const ClaimUnattachedStudentModal = InviteUnattachedStudentModal;
