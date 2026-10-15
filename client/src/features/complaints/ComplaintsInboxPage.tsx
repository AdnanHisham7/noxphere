// src/features/complaints/ComplaintsInboxPage.tsx
import React, { useState } from "react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import {
  MessageSquareWarning,
  Send,
  LifeBuoy,
  User,
  UserCheck,
  Share2,
  CheckCircle2,
  Clock,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import {
  Badge,
  Button,
  Skeleton,
  EmptyState,
  PageHeader,
  Tabs,
  Select,
} from "../../components/ui";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import {
  useListAcademyComplaintsQuery,
  useRespondToComplaintMutation,
  useGetCandidateCoachesQuery,
  useForwardComplaintToCoachesMutation,
  useCoachRespondToComplaintMutation,
  type Complaint,
} from "../../store/api/complaintApi";
import { PlatformSupportTab } from "./PlatformSupportTab";

const STATUS_VARIANT: Record<Complaint["status"], "yellow" | "blue" | "green"> = {
  open: "yellow",
  in_progress: "blue",
  resolved: "green",
};

const ComplaintsInboxPage: React.FC = () => {
  const academyId = useCurrentAcademyId();
  const user = useSelector((s: RootState) => s.auth.user);
  const isCoach = user?.role === "coach";

  const [activeTab, setActiveTab] = useState<
    "academy_inquiries" | "platform_support"
  >("academy_inquiries");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<Complaint | null>(null);

  const { data: complaints, isLoading } = useListAcademyComplaintsQuery(
    { academyId: academyId ?? "", status: statusFilter || undefined },
    { skip: !academyId },
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow={isCoach ? "Coach Desk" : "Support & Helpdesk"}
        title={
          activeTab === "academy_inquiries"
            ? isCoach
              ? "Complaints Forwarded to You"
              : "Academy Complaints"
            : "Platform Support"
        }
        subtitle={
          isCoach
            ? "Review complaints forwarded to you regarding your students, and submit your feedback."
            : "Review complaints submitted by students or guardians, forward to coaches, and manage support tickets."
        }
        actions={
          !isCoach ? (
            <Tabs
              variant="pills"
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                {
                  id: "academy_inquiries",
                  label: "Academy Complaints",
                  icon: <MessageSquareWarning size={14} />,
                },
                {
                  id: "platform_support",
                  label: (
                    <span>
                      Platform Support{" "}
                      <span className="hidden sm:inline">(To Super Admin)</span>
                    </span>
                  ),
                  icon: <LifeBuoy size={14} />,
                },
              ]}
            />
          ) : undefined
        }
      />

      {activeTab === "platform_support" ? (
        <PlatformSupportTab />
      ) : !academyId ? (
        <EmptyState
          icon={<MessageSquareWarning size={28} />}
          title="No academy context"
          description="Select a franchise to view its academy's complaints."
        />
      ) : (
        <>
          <div className="flex justify-end">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="!text-xs !py-1.5 !px-3"
              wrapperClassName="w-full sm:w-auto"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded" />
                ))
              ) : !complaints?.length ? (
                <EmptyState
                  icon={<MessageSquareWarning size={28} />}
                  title={isCoach ? "No complaints forwarded" : "No complaints"}
                  description={
                    isCoach
                      ? "No complaints have been forwarded to you yet."
                      : "Nothing filed yet."
                  }
                />
              ) : (
                complaints.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={clsx(
                      "w-full text-left card p-4 space-y-2 transition-all border",
                      selected?.id === c.id
                        ? "border-volt-500 dark:border-volt-400 bg-volt-500/5 dark:bg-pitch-800 shadow-sm ring-1 ring-volt-500/20"
                        : "border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 hover:shadow-md",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {c.subject}
                      </p>
                      <Badge variant={STATUS_VARIANT[c.status || "open"]}>
                        {(c.status || "open").replace("_", " ")}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-2xs text-slate-500 dark:text-slate-400">
                      <span>{c.raisedByName}</span>
                      <span>·</span>
                      <span className="capitalize">{c.raisedByRole}</span>
                      {c.studentName && (
                        <>
                          <span>·</span>
                          <span className="font-mono px-1.5 py-0.5 rounded bg-core-400/10 text-core-400 font-semibold">
                            Student: {c.studentName}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>{new Date(c.createdAt).toLocaleDateString("en-IN")}</span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                      {c.message}
                    </p>

                    {/* Forwarded indicators */}
                    {c.forwardedToCoaches && c.forwardedToCoaches.length > 0 && (
                      <div className="pt-1 flex items-center gap-1.5 text-2xs text-volt-500 dark:text-volt-400 font-medium">
                        <UserCheck size={12} />
                        <span>
                          Forwarded to:{" "}
                          {c.forwardedToCoaches.map((fc) => fc.coachName).join(", ")}
                        </span>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>

            <div>
              {selected ? (
                <ComplaintDetail
                  academyId={academyId!}
                  complaint={selected}
                  isCoach={isCoach}
                  onResponded={setSelected}
                />
              ) : (
                <EmptyState
                  icon={<MessageSquareWarning size={28} />}
                  title="Select a complaint"
                  description="Pick one from the list to view, forward to coaches, or respond."
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const ComplaintDetail: React.FC<{
  academyId: string;
  complaint: Complaint;
  isCoach: boolean;
  onResponded: (c: Complaint) => void;
}> = ({ academyId, complaint, isCoach, onResponded }) => {
  const [respond, { isLoading: isResponding }] = useRespondToComplaintMutation();
  const [coachRespond, { isLoading: isCoachResponding }] =
    useCoachRespondToComplaintMutation();
  const [forwardComplaint, { isLoading: isForwarding }] =
    useForwardComplaintToCoachesMutation();

  const { data: candidatesData } = useGetCandidateCoachesQuery(
    { academyId, complaintId: complaint.id },
    { skip: isCoach },
  );

  const [response, setResponse] = useState(complaint.response ?? "");
  const [coachResponseText, setCoachResponseText] = useState("");
  const [status, setStatus] = useState<"in_progress" | "resolved">(
    complaint.status === "resolved" ? "resolved" : "in_progress",
  );

  // Forwarding console state
  const [showForwardPanel, setShowForwardPanel] = useState(false);
  const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([]);
  const [forwardNotes, setForwardNotes] = useState("");

  const isResolved = complaint.status === "resolved";

  const handleManagerSend = async () => {
    if (!response.trim()) return toast.error("Enter a response");
    try {
      const res: any = await respond({
        academyId,
        complaintId: complaint.id,
        response: response.trim(),
        status,
      }).unwrap();
      toast.success("Response recorded and alerts sent to guardian & coaches");
      const updated = res?.data || res;
      onResponded(updated);
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't send response — try again");
    }
  };

  const handleCoachSend = async () => {
    if (!coachResponseText.trim())
      return toast.error("Enter your feedback / response");
    try {
      const res: any = await coachRespond({
        academyId,
        complaintId: complaint.id,
        response: coachResponseText.trim(),
      }).unwrap();
      toast.success("Feedback submitted! Alert sent to manager & guardian");
      setCoachResponseText("");
      const updated = res?.data || res;
      onResponded(updated);
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't submit feedback — try again");
    }
  };

  const handleForward = async () => {
    if (selectedCoachIds.length === 0) {
      return toast.error("Select at least one coach to forward this complaint to");
    }
    try {
      const res: any = await forwardComplaint({
        academyId,
        complaintId: complaint.id,
        coachIds: selectedCoachIds,
        notes: forwardNotes.trim() || undefined,
      }).unwrap();
      toast.success("Complaint forwarded! System alerts sent to coaches & guardian");
      setShowForwardPanel(false);
      setSelectedCoachIds([]);
      setForwardNotes("");
      const updated = res?.data || res;
      onResponded(updated);
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't forward complaint — try again");
    }
  };

  const toggleCoachSelection = (coachId: string) => {
    setSelectedCoachIds((prev) =>
      prev.includes(coachId) ? prev.filter((id) => id !== coachId) : [...prev, coachId],
    );
  };

  return (
    <div className="card p-5 space-y-5 border-slate-200/80 dark:border-white/5 shadow-sm">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-1 gap-2">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {complaint.subject}
          </p>
          <Badge variant={STATUS_VARIANT[complaint.status || "open"]}>
            {(complaint.status || "open").replace("_", " ")}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-2xs text-slate-500 dark:text-slate-400">
          <span>{complaint.raisedByName}</span>
          <span>({complaint.raisedByRole})</span>
          {complaint.studentName && (
            <span className="font-mono px-2 py-0.5 rounded bg-core-400/10 text-core-400 font-semibold">
              Regarding: {complaint.studentName}
            </span>
          )}
          <span>·</span>
          <span>{new Date(complaint.createdAt).toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Message Body */}
      <div>
        <label className="label text-2xs uppercase tracking-wider text-slate-400">
          Complaint Details
        </label>
        <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-pitch-700/40 border border-slate-200/80 dark:border-white/5 rounded-lg p-3.5 leading-relaxed whitespace-pre-wrap">
          {complaint.message}
        </p>
      </div>

      {/* Forwarded to Coaches Information Banner */}
      {complaint.forwardedToCoaches && complaint.forwardedToCoaches.length > 0 && (
        <div className="bg-volt-400/5 border border-volt-400/20 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-volt-500 dark:text-volt-400">
            <span className="flex items-center gap-1.5">
              <UserCheck size={15} />
              Forwarded to Coaches ({complaint.forwardedToCoaches.length})
            </span>
            {complaint.forwardedByName && (
              <span className="text-2xs font-normal text-slate-500 dark:text-slate-400">
                by {complaint.forwardedByName}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {complaint.forwardedToCoaches.map((fc) => (
              <span
                key={fc.coachId}
                className="text-xs px-2.5 py-1 rounded-md bg-white dark:bg-pitch-800 border border-volt-400/20 text-slate-900 dark:text-white font-medium"
              >
                ⚽ {fc.coachName}
              </span>
            ))}
          </div>
          {complaint.forwardedNotes && (
            <p className="text-xs text-slate-600 dark:text-slate-400 italic pt-1">
              "Note: {complaint.forwardedNotes}"
            </p>
          )}
        </div>
      )}

      {/* Coach Responses / Feedback History */}
      {complaint.coachResponses && complaint.coachResponses.length > 0 && (
        <div className="space-y-2">
          <label className="label text-2xs uppercase tracking-wider text-core-400 font-semibold flex items-center gap-1.5">
            <User size={13} />
            Coach Feedback ({complaint.coachResponses.length})
          </label>
          <div className="space-y-2">
            {complaint.coachResponses.map((cr, idx) => (
              <div
                key={idx}
                className="bg-slate-50 dark:bg-pitch-700/50 border border-slate-200/80 dark:border-white/5 rounded-lg p-3 space-y-1"
              >
                <div className="flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Coach {cr.coachName}
                  </span>
                  <span>{new Date(cr.respondedAt).toLocaleString("en-IN")}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {cr.response}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COACH ACTION: Submit feedback if caller is coach */}
      {isCoach && !isResolved && (
        <div className="border-t border-slate-200 dark:border-white/10 pt-4 space-y-3">
          <label className="label text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Send size={13} className="text-volt-400" />
            Your Coach Feedback / Action Taken
          </label>
          <textarea
            className="input min-h-24 resize-none w-full text-xs"
            value={coachResponseText}
            onChange={(e) => setCoachResponseText(e.target.value)}
            placeholder="Share your feedback, explanation, or actions taken regarding this complaint…"
          />
          <Button
            className="w-full text-xs"
            loading={isCoachResponding}
            onClick={handleCoachSend}
          >
            Submit Feedback (Alerts Manager &amp; Parent)
          </Button>
        </div>
      )}

      {/* MANAGER ACTION 1: Forward to Coaches Panel */}
      {!isCoach && !isResolved && (
        <div className="border-t border-slate-200 dark:border-white/10 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Share2 size={14} className="text-volt-400" />
                Forward Complaint to Coaches
              </h4>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                {complaint.studentName
                  ? `Select ${complaint.studentName}'s coaches or other academy staff`
                  : "Select coaches to review and provide input"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForwardPanel((v) => !v)}
              className="text-xs text-volt-500 hover:text-volt-400 font-medium flex items-center gap-1 p-1"
            >
              <span>{showForwardPanel ? "Close" : "Forward..."}</span>
              {showForwardPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {showForwardPanel && (
            <div className="bg-slate-50 dark:bg-pitch-700/40 border border-slate-200/80 dark:border-white/5 rounded-xl p-4 space-y-3 animate-fade-in">
              <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Select Coaches to Notify
              </label>

              {candidatesData?.coaches && candidatesData.coaches.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {candidatesData.coaches.map((coach) => {
                    const isSelected = selectedCoachIds.includes(coach.id);
                    return (
                      <button
                        type="button"
                        key={coach.id}
                        onClick={() => toggleCoachSelection(coach.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-colors ${
                          isSelected
                            ? "bg-volt-400/10 border-volt-400 text-slate-900 dark:text-white font-semibold"
                            : "bg-white dark:bg-pitch-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] shrink-0 ${
                              isSelected
                                ? "bg-volt-400 border-volt-400 text-pitch-900"
                                : "border-slate-300 dark:border-white/20"
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                          <span className="truncate">{coach.name}</span>
                          {coach.isStudentCoach && (
                            <span className="text-3xs font-mono px-1.5 py-0.5 rounded bg-core-400/10 text-core-400 font-bold shrink-0">
                              {coach.relationship}
                            </span>
                          )}
                          {coach.isAlreadyForwarded && (
                            <span className="text-3xs font-mono text-slate-400 shrink-0">
                              (Already forwarded)
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  No active coaches found in this academy.
                </p>
              )}

              <div>
                <label className="block text-2xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Instructions / Notes for Coaches (Optional)
                </label>
                <input
                  type="text"
                  value={forwardNotes}
                  onChange={(e) => setForwardNotes(e.target.value)}
                  placeholder="e.g. Please check attendance records and advise parent's concern"
                  className="input text-xs w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowForwardPanel(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  loading={isForwarding}
                  onClick={handleForward}
                  icon={<Share2 size={13} />}
                >
                  Forward &amp; Send Alerts
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MANAGER ACTION 2: Final Resolution / Manager Response */}
      {!isCoach && (
        <div className="border-t border-slate-200 dark:border-white/10 pt-4 space-y-3">
          {isResolved ? (
            <>
              {complaint.response && (
                <div>
                  <label className="label text-2xs uppercase tracking-wider text-slate-400">
                    Official Response Sent {complaint.respondedByName ? `by ${complaint.respondedByName}` : ""}
                  </label>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-pitch-700/40 border border-slate-200/80 dark:border-white/5 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                    {complaint.response}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/40 px-4 py-3">
                <CheckCircle2
                  size={16}
                  className="shrink-0 text-green-600 dark:text-green-400"
                />
                <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                  This complaint has been resolved and is closed.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label text-xs font-semibold text-slate-900 dark:text-white">
                  Management Response to Guardian
                </label>
                <textarea
                  className="input min-h-24 resize-none w-full text-xs"
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Write the official response or update to the guardian…"
                />
              </div>

              <div>
                <label className="label text-2xs uppercase tracking-wider text-slate-400">
                  Update Status
                </label>
                <div className="flex gap-2">
                  {(["in_progress", "resolved"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={clsx(
                        "flex-1 rounded-lg px-3 py-2 text-xs font-semibold border transition-colors",
                        status === s
                          ? "bg-volt-400 border-volt-400 text-pitch-900"
                          : "bg-slate-50 dark:bg-pitch-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                      )}
                    >
                      {s === "in_progress" ? "In Progress" : "Mark as Resolved"}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full text-xs"
                icon={<Send size={14} />}
                loading={isResponding}
                onClick={handleManagerSend}
              >
                Send Response &amp; Notify Guardian
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ComplaintsInboxPage;