// src/features/students/ClaimUnattachedStudentModal.tsx
import React, { useState, useEffect } from "react";
import {
  useGetUnattachedStudentsQuery,
  useClaimUnattachedStudentMutation,
  type Student,
} from "@/store/api/studentsApi";
import { Button, Modal, Badge, EmptyState, Input } from "@/components/ui";
import {
  Search,
  UserPlus,
  UserCheck,
  Shield,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

interface ClaimUnattachedStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  franchiseId: string;
  teams: Array<{ id: string; name: string }>;
  onClaimed?: () => void;
}

export const ClaimUnattachedStudentModal: React.FC<ClaimUnattachedStudentModalProps> = ({
  isOpen,
  onClose,
  franchiseId,
  teams,
  onClaimed,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState("");

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

  const [claimStudent, { isLoading: claiming }] = useClaimUnattachedStudentMutation();

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    teamId: "",
    coachId: "",
    jerseyNumber: "",
    jerseySize: "M",
    position: "Midfielder",
  });

  const students: Student[] = data?.students ?? (data as any)?.items ?? [];

  const handleSelectToClaim = (student: Student) => {
    setSelectedStudent(student);
    setAssignmentForm({
      teamId: teams[0]?.id || "",
      coachId: "",
      jerseyNumber: student.jerseyNumber ? String(student.jerseyNumber) : "",
      jerseySize: student.jerseySize || "M",
      position: student.position || "Midfielder",
    });
  };

  const handleConfirmClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    try {
      await claimStudent({
        id: selectedStudent.id,
        data: {
          franchiseId,
          teamId: assignmentForm.teamId || undefined,
          coachId: assignmentForm.coachId || undefined,
          jerseyNumber: assignmentForm.jerseyNumber ? Number(assignmentForm.jerseyNumber) : undefined,
          jerseySize: assignmentForm.jerseySize,
          position: assignmentForm.position,
        },
      }).unwrap();

      toast.success(`${selectedStudent.firstName} ${selectedStudent.lastName} enrolled into your squad!`);
      setSelectedStudent(null);
      refetch();
      if (onClaimed) onClaimed();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to enroll unattached student");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enroll from Public / Free Agent Players" size="lg">
      <div className="space-y-4 pt-2">
        <p className="text-xs text-slate-500">
          Independent players registered without an academy can be claimed and enrolled into your franchise.
        </p>

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
            {students.map((st) => (
              <div
                key={st.id}
                className="card p-3 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-white/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-volt-400/15 text-volt-500 font-display font-bold text-sm flex items-center justify-center">
                    {st.firstName[0]}
                    {st.lastName[0]}
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
                      <span>Rating: {st.overallRating?.toFixed(1) || "—"}</span>
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
                  <Button
                    size="sm"
                    onClick={() => handleSelectToClaim(st)}
                    className="text-xs !py-1 !px-2.5 bg-volt-400 text-pitch-900 font-semibold hover:bg-volt-300"
                  >
                    <UserPlus size={12} /> Enroll
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal inside modal: Assignment Form */}
        {selectedStudent && (
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
              <h4 className="font-semibold text-xs text-slate-900 dark:text-white">
                Squad Placement for {selectedStudent.firstName} {selectedStudent.lastName}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleConfirmClaim} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Assign Team</label>
                  <select
                    value={assignmentForm.teamId}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, teamId: e.target.value })}
                    className="input text-xs"
                  >
                    <option value="">Unassigned</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Position</label>
                  <select
                    value={assignmentForm.position}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, position: e.target.value })}
                    className="input text-xs"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Jersey Number</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    placeholder="e.g. 7"
                    value={assignmentForm.jerseyNumber}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, jerseyNumber: e.target.value })}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="label">Jersey Size</label>
                  <select
                    value={assignmentForm.jerseySize}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, jerseySize: e.target.value })}
                    className="input text-xs"
                  >
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedStudent(null)}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={claiming}
                  className="bg-volt-400 text-pitch-900 font-bold"
                >
                  Enroll Player
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
    </Modal>
  );
};
