// src/features/students/RegistrationRequestsTab.tsx
import React, { useState } from "react";
import {
  useGetRegistrationRequestsQuery,
  useApproveRegistrationRequestMutation,
  useRejectRegistrationRequestMutation,
} from "@/store/api/studentsApi";
import { Button, Modal, Badge, EmptyState } from "@/components/ui";
import {
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  UserPlus,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  Inbox,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

interface RegistrationRequestsTabProps {
  academyId: string;
  franchiseId?: string;
  teams: Array<{ id: string; name: string }>;
  onApprovedStudent?: () => void;
}

export const RegistrationRequestsTab: React.FC<RegistrationRequestsTabProps> = ({
  academyId,
  franchiseId,
  teams,
  onApprovedStudent,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [scope, setScope] = useState<"all" | "franchise">("all");
  const { data, isLoading, refetch } = useGetRegistrationRequestsQuery(
    {
      academyId,
      franchiseId: scope === "franchise" ? franchiseId : undefined,
      status: filterStatus || undefined,
    },
    { skip: !academyId }
  );

  const [approveRequest, { isLoading: approving }] = useApproveRegistrationRequestMutation();
  const [rejectRequest, { isLoading: rejecting }] = useRejectRegistrationRequestMutation();

  // Approve Modal State
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [approvalForm, setApprovalForm] = useState({
    teamId: "",
    coachId: "",
    jerseyNumber: "",
    jerseySize: "M",
    position: "Midfielder",
    firstName: "",
    lastName: "",
  });

  // Reject Modal State
  const [rejectingRequest, setRejectingRequest] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const requests = data?.requests ?? [];

  const handleOpenApproveModal = (req: any) => {
    setSelectedRequest(req);
    setApprovalForm({
      teamId: teams[0]?.id || "",
      coachId: "",
      jerseyNumber: req.studentDetails?.jerseyNumber ? String(req.studentDetails.jerseyNumber) : "",
      jerseySize: req.studentDetails?.jerseySize || "M",
      position: req.studentDetails?.position || "Midfielder",
      firstName: req.studentDetails?.firstName || "",
      lastName: req.studentDetails?.lastName || "",
    });
  };

  const handleConfirmApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      await approveRequest({
        id: selectedRequest.id,
        data: {
          franchiseId: selectedRequest.franchiseId,
          teamId: approvalForm.teamId || undefined,
          coachId: approvalForm.coachId || undefined,
          jerseyNumber: approvalForm.jerseyNumber ? Number(approvalForm.jerseyNumber) : undefined,
          jerseySize: approvalForm.jerseySize,
          position: approvalForm.position,
          studentDetails: {
            firstName: approvalForm.firstName.trim(),
            lastName: approvalForm.lastName.trim(),
          },
        },
      }).unwrap();

      toast.success(`Player ${approvalForm.firstName} enrolled into squad successfully!`);
      setSelectedRequest(null);
      refetch();
      if (onApprovedStudent) onApprovedStudent();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to approve registration");
    }
  };

  const handleConfirmRejection = async () => {
    if (!rejectingRequest) return;

    try {
      await rejectRequest({
        id: rejectingRequest.id,
        reason: rejectionReason.trim() || undefined,
      }).unwrap();

      toast.success("Registration request rejected");
      setRejectingRequest(null);
      setRejectionReason("");
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to reject registration");
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter and stats row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterStatus === "pending"
                ? "bg-volt-400 text-pitch-900"
                : "bg-slate-100 dark:bg-pitch-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Pending Review
          </button>
          <button
            onClick={() => setFilterStatus("approved")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterStatus === "approved"
                ? "bg-volt-400 text-pitch-900"
                : "bg-slate-100 dark:bg-pitch-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setFilterStatus("rejected")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterStatus === "rejected"
                ? "bg-volt-400 text-pitch-900"
                : "bg-slate-100 dark:bg-pitch-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Rejected
          </button>
          <button
            onClick={() => setFilterStatus("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterStatus === ""
                ? "bg-volt-400 text-pitch-900"
                : "bg-slate-100 dark:bg-pitch-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            All Requests
          </button>

          {franchiseId && (
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "all" | "franchise")}
              className="ml-2 text-xs bg-slate-100 dark:bg-pitch-800 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-medium outline-none cursor-pointer"
            >
              <option value="all">All Academy Branches</option>
              <option value="franchise">This Branch Only</option>
            </select>
          )}
        </div>

        <span className="text-xs text-slate-500">
          {requests.length} request{requests.length !== 1 ? "s" : ""} found
        </span>
      </div>

      {/* Content Table / List */}
      {isLoading ? (
        <div className="card p-8 text-center text-slate-500 animate-pulse">
          Loading registration requests…
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<Inbox size={32} className="text-slate-500" />}
          title="No registration requests"
          description={
            filterStatus === "pending"
              ? "All caught up! New applications submitted via your registration link will appear here."
              : "No applications match the selected filter."
          }
        />
      ) : (
        <div className="card overflow-hidden border-slate-200 dark:border-white/10 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-pitch-900/60 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono text-2xs border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Position</th>
                  <th className="py-3 px-4">Account Type</th>
                  <th className="py-3 px-4">Guardian Contact</th>
                  <th className="py-3 px-4">Applied</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-pitch-700/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {r.studentDetails?.firstName} {r.studentDetails?.lastName}
                      {r.studentDetails?.dateOfBirth && (
                        <div className="text-2xs font-normal text-slate-500">
                          DOB: {new Date(r.studentDetails.dateOfBirth).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-medium">{r.studentDetails?.ageGroup || "—"}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span>{r.studentDetails?.position || "—"}</span>
                      {r.studentDetails?.jerseyNumber && (
                        <span className="text-2xs text-slate-500 ml-1">#{r.studentDetails.jerseyNumber}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {r.existingStudentId ? (
                        <span className="inline-flex items-center gap-1 text-2xs text-field-600 dark:text-field-400 bg-field-400/10 px-2 py-0.5 rounded-full font-semibold">
                          <UserCheck size={11} /> Existing Player
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-2xs text-ice-600 dark:text-ice-400 bg-ice-400/10 px-2 py-0.5 rounded-full">
                          <UserPlus size={11} /> New Account
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 space-y-0.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {r.guardianDetails?.name || "—"}
                      </div>
                      <div className="text-2xs text-slate-500 flex items-center gap-1">
                        <Mail size={10} /> {r.guardianDetails?.email}
                      </div>
                      <div className="text-2xs text-slate-500 flex items-center gap-1">
                        <Phone size={10} /> {r.guardianDetails?.phone}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-2xs text-slate-500 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      {r.status === "pending" && (
                        <Badge variant="yellow">Pending</Badge>
                      )}
                      {r.status === "approved" && (
                        <Badge variant="green">Approved</Badge>
                      )}
                      {r.status === "rejected" && (
                        <Badge variant="red">Rejected</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {r.status === "pending" ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleOpenApproveModal(r)}
                            className="text-xs !py-1 !px-2.5 bg-volt-400 text-pitch-900 hover:bg-volt-300"
                          >
                            <CheckCircle2 size={13} /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setRejectingRequest(r)}
                            className="text-xs !py-1 !px-2.5 text-ember-500 hover:text-ember-400"
                          >
                            <XCircle size={13} /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-2xs text-slate-400">Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Approve Request */}
      {selectedRequest && (
        <Modal
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          title="Approve Player Enrollment"
          size="md"
        >
          <form onSubmit={handleConfirmApproval} className="space-y-4 pt-2">
            <div className="p-3 bg-slate-100 dark:bg-pitch-900 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-slate-900 dark:text-white">
                Applicant: {selectedRequest.studentDetails?.firstName} {selectedRequest.studentDetails?.lastName}
              </p>
              <p className="text-slate-500">
                Category: <strong>{selectedRequest.studentDetails?.ageGroup}</strong> • DOB:{" "}
                {new Date(selectedRequest.studentDetails?.dateOfBirth).toLocaleDateString()}
              </p>
              <p className="text-slate-500">
                Guardian: {selectedRequest.guardianDetails?.name} ({selectedRequest.guardianDetails?.email})
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First Name</label>
                <input
                  type="text"
                  required
                  value={approvalForm.firstName}
                  onChange={(e) => setApprovalForm({ ...approvalForm, firstName: e.target.value })}
                  className="input text-xs"
                />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input
                  type="text"
                  required
                  value={approvalForm.lastName}
                  onChange={(e) => setApprovalForm({ ...approvalForm, lastName: e.target.value })}
                  className="input text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Assign Team / Squad</label>
                <select
                  value={approvalForm.teamId}
                  onChange={(e) => setApprovalForm({ ...approvalForm, teamId: e.target.value })}
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
                  value={approvalForm.position}
                  onChange={(e) => setApprovalForm({ ...approvalForm, position: e.target.value })}
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
                  placeholder="e.g. 10"
                  value={approvalForm.jerseyNumber}
                  onChange={(e) => setApprovalForm({ ...approvalForm, jerseyNumber: e.target.value })}
                  className="input text-xs"
                />
              </div>
              <div>
                <label className="label">Jersey Size</label>
                <select
                  value={approvalForm.jerseySize}
                  onChange={(e) => setApprovalForm({ ...approvalForm, jerseySize: e.target.value })}
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

            <p className="text-2xs text-slate-500">
              Upon approval, the player will be enrolled under this franchise and an official welcome alert will be dispatched to the player&apos;s account.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
              <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedRequest(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={approving} className="bg-volt-400 text-pitch-900 font-bold">
                Confirm Enrollment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Reject Request */}
      {rejectingRequest && (
        <Modal
          isOpen={!!rejectingRequest}
          onClose={() => setRejectingRequest(null)}
          title="Reject Registration Request"
          size="sm"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Reject application from{" "}
              <strong>
                {rejectingRequest.studentDetails?.firstName} {rejectingRequest.studentDetails?.lastName}
              </strong>
              ?
            </p>

            <div>
              <label className="label">Reason for Rejection (Optional)</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Squad capacity full for U-15 category this term"
                className="input text-xs w-full min-h-[70px]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setRejectingRequest(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={rejecting}
                onClick={handleConfirmRejection}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
