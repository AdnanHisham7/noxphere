// src/features/complaints/FileComplaintWidget.tsx
import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  MessageSquareWarning,
  Send,
  User,
  UserCheck,
  ShieldCheck,
  Plus,
  X,
  Search,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Tag,
} from "lucide-react";
import {
  useCreateComplaintMutation,
  useListMyComplaintsQuery,
  type Complaint,
} from "../../store/api/complaintApi";
import { useGetMyChildrenQuery } from "../../store/api/guardianApi";
import { Select } from "../../components/ui";
import {
  NoxStatCard,
  NoxSkeleton,
  NoxEmptyState,
} from "../../components/portal-ui";

const STATUS_CONFIG: Record<
  Complaint["status"],
  { label: string; bg: string; text: string; border: string }
> = {
  open: {
    label: "Awaiting Response",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/30",
  },
  in_progress: {
    label: "Under Review",
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-500/30",
  },
  resolved: {
    label: "Resolved",
    bg: "bg-field-500/10 dark:bg-field-500/20",
    text: "text-field-700 dark:text-field-400",
    border: "border-field-500/30",
  },
};

const CATEGORIES = [
  "General Inquiry",
  "Coaching & Training",
  "Pitch & Facilities",
  "Schedules & Timing",
  "Fees & Invoicing",
  "Medical & Welfare",
];

export const FileComplaintWidget: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("General Inquiry");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  const [activeFilter, setActiveFilter] = useState<
    "all" | "open" | "in_progress" | "resolved"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const [create, { isLoading: isSubmitting }] = useCreateComplaintMutation();
  const { data: mine, isLoading: isLoadingComplaints } = useListMyComplaintsQuery();
  const { data: children } = useGetMyChildrenQuery(undefined, {
    refetchOnMountOrArgChange: false,
  });

  // Pre-select if guardian has only 1 child
  useEffect(() => {
    if (children && children.length === 1 && !selectedStudentId) {
      setSelectedStudentId(children[0]._id || (children[0] as any).id);
    }
  }, [children, selectedStudentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      return toast.error("Please fill in both the subject and the details of your issue.");
    }
    try {
      const fullSubject = category ? `[${category}] ${subject.trim()}` : subject.trim();
      await create({
        subject: fullSubject,
        message: message.trim(),
        studentId: selectedStudentId || undefined,
      }).unwrap();
      toast.success("Complaint submitted! Our academy management will review it shortly.");
      setSubject("");
      setMessage("");
      setShowForm(false);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to submit — please try again.");
    }
  };

  const complaints = mine ?? [];
  const openCount = complaints.filter((c) => c.status === "open").length;
  const inProgressCount = complaints.filter((c) => c.status === "in_progress").length;
  const resolvedCount = complaints.filter((c) => c.status === "resolved").length;

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (activeFilter !== "all" && c.status !== activeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const subjectMatch = c.subject.toLowerCase().includes(query);
        const messageMatch = c.message.toLowerCase().includes(query);
        const studentMatch = c.studentName?.toLowerCase().includes(query);
        return subjectMatch || messageMatch || studentMatch;
      }
      return true;
    });
  }, [complaints, activeFilter, searchQuery]);

  const totalPages = Math.ceil(filteredComplaints.length / ITEMS_PER_PAGE);
  const pagedComplaints = filteredComplaints.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <NoxStatCard
          label="Total Concerns"
          value={complaints.length}
          icon={<MessageSquareWarning size={18} />}
          accent="ion"
        />
        <NoxStatCard
          label="Awaiting Response"
          value={openCount}
          icon={<Clock size={18} />}
          accent={openCount > 0 ? "core" : "ion"}
        />
        <NoxStatCard
          label="Under Review"
          value={inProgressCount}
          icon={<UserCheck size={18} />}
          accent="plasma"
        />
        <NoxStatCard
          label="Resolved"
          value={resolvedCount}
          icon={<CheckCircle2 size={18} />}
          accent="ion"
        />
      </div>

      {/* Action / Trigger Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 nox-card p-4 sm:p-5 border-pitch-200 dark:border-white/[0.06]">
        <div>
          <h3 className="font-orbital text-base font-semibold text-nox-high flex items-center gap-2">
            <MessageSquareWarning size={18} className="text-amber-500 dark:text-amber-400" />
            Academy Feedback &amp; Grievance Redressal
          </h3>
          <p className="text-xs text-nox-mid mt-0.5">
            Your submissions are routed directly to academy administrators and relevant head coaches.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="nox-btn-primary !bg-volt-400 hover:!bg-volt-300 !text-pitch-950 font-bold dark:!text-pitch-950 text-xs flex items-center justify-center gap-1.5 py-2 px-4 shadow-sm shrink-0"
        >
          {showForm ? <X size={14} className="text-pitch-950" /> : <Plus size={14} className="text-pitch-950" />}
          <span className="text-pitch-950 font-bold">
            {showForm ? "Cancel Submission" : "Raise New Concern"}
          </span>
        </button>
      </div>

      {/* Expandable Form Card */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="nox-card p-5 sm:p-6 border-volt-400/30 bg-volt-400/[0.02] space-y-4 animate-fade-in shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-pitch-200/50 dark:border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-volt-400/20 text-volt-600 dark:text-volt-400">
                <Plus size={16} />
              </span>
              <h4 className="font-orbital text-sm font-semibold text-nox-high">
                New Complaint or Concern Details
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-nox-low hover:text-nox-high transition-colors"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {children && children.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-nox-high mb-1.5">
                  Select Child / Student (Optional)
                </label>
                <Select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full text-xs"
                >
                  <option value="">General (Not specific to a child)</option>
                  {children.map((child) => (
                    <option
                      key={child._id || (child as any).id}
                      value={child._id || (child as any).id}
                    >
                      {child.firstName} {child.lastName}{" "}
                      {child.ageGroup ? `(${child.ageGroup})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-nox-high mb-1.5">
                Category
              </label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-nox-high mb-1.5">
              Subject / Headline <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Schedule clash on Friday, Medical note for recovery, Missing kit item"
              className="w-full rounded-xl bg-pitch-50 dark:bg-white/[0.04] border border-pitch-200 dark:border-white/10 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-volt-400 dark:focus:border-volt-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-nox-high mb-1.5">
              Detailed Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Provide specific details, dates, batch/field info, or coaching remarks so the academy team can assist you effectively..."
              className="w-full rounded-xl bg-pitch-50 dark:bg-white/[0.04] border border-pitch-200 dark:border-white/10 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-volt-400 dark:focus:border-volt-400 resize-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-pitch-200/50 dark:border-white/[0.06]">
            <span className="text-2xs text-nox-low font-mono">
              Confidential · Only accessible by academy manager &amp; head coaches
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="nox-btn-secondary text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="nox-btn-primary !bg-volt-400 hover:!bg-volt-300 !text-pitch-950 font-bold dark:!text-pitch-950 text-xs flex items-center gap-1.5 py-1.5 px-4 shadow-sm"
              >
                <Send size={13} className="text-pitch-950" />
                <span className="text-pitch-950 font-bold">
                  {isSubmitting ? "Submitting..." : "Submit to Management"}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02] p-2.5 rounded-xl border border-pitch-200/50 dark:border-white/[0.06]">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: "all", label: "All Concerns", count: complaints.length },
              { id: "open", label: "Awaiting", count: openCount },
              { id: "in_progress", label: "Under Review", count: inProgressCount },
              { id: "resolved", label: "Resolved", count: resolvedCount },
            ] as const
          ).map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  active
                    ? "bg-pitch-900 text-white dark:bg-white dark:text-pitch-950 font-semibold shadow-sm"
                    : "text-nox-mid hover:text-nox-high"
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-2xs font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-nox-mid">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nox-low" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search concerns..."
            className="w-full rounded-lg bg-pitch-50 dark:bg-white/[0.04] border border-pitch-200 dark:border-white/10 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-volt-400 transition-colors"
          />
        </div>
      </div>

      {/* Complaints List */}
      {isLoadingComplaints && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <NoxSkeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {!isLoadingComplaints && filteredComplaints.length === 0 && (
        <NoxEmptyState
          title={searchQuery ? "No matching concerns found" : "No concerns submitted yet"}
          body={
            searchQuery
              ? "Try adjusting your search keywords or filter tab."
              : "If you have any feedback or concerns regarding your child's training or academy operations, use the button above."
          }
          icon={<MessageSquareWarning size={28} />}
        />
      )}

      {!isLoadingComplaints && filteredComplaints.length > 0 && (
        <div className="space-y-4">
          {pagedComplaints.map((c) => {
            const statusStyle = STATUS_CONFIG[c.status] || STATUS_CONFIG.open;
            return (
              <div
                key={c.id}
                className="nox-card p-5 space-y-3.5 border-pitch-200/60 dark:border-white/[0.06] hover:border-core-400/30 transition-all shadow-sm"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-pitch-200/40 dark:border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <h4 className="font-orbital text-sm font-semibold text-nox-high">
                      {c.subject}
                    </h4>
                    {c.studentName && (
                      <span className="inline-flex items-center gap-1 text-2xs font-mono px-2 py-0.5 rounded-full bg-core-400/10 text-core-400 font-semibold border border-core-400/20">
                        <User size={11} />
                        <span>{c.studentName}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-2xs font-mono uppercase px-2.5 py-0.5 rounded-full font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                    >
                      {statusStyle.label}
                    </span>
                    <span className="text-2xs font-mono text-nox-low">
                      {new Date(c.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Complaint Message */}
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {c.message}
                </p>

                {/* Forwarded to coach notice */}
                {c.forwardedToCoaches && c.forwardedToCoaches.length > 0 && (
                  <div className="bg-volt-400/10 border border-volt-400/20 rounded-xl p-3 flex items-center gap-2 text-xs text-volt-600 dark:text-volt-400">
                    <UserCheck size={16} className="shrink-0" />
                    <span>
                      Forwarded for coach review:{" "}
                      <strong>
                        {c.forwardedToCoaches.map((fc) => fc.coachName).join(", ")}
                      </strong>
                    </span>
                  </div>
                )}

                {/* Coach Feedback Threads */}
                {c.coachResponses && c.coachResponses.length > 0 && (
                  <div className="pt-2 border-t border-pitch-200/40 dark:border-white/[0.06] space-y-2.5">
                    <p className="text-2xs font-mono uppercase tracking-wider text-core-400 font-semibold flex items-center gap-1.5">
                      <User size={12} /> Coach Response
                    </p>
                    {c.coachResponses.map((cr, idx) => (
                      <div
                        key={idx}
                        className="bg-pitch-50 dark:bg-white/[0.02] border border-pitch-200/50 dark:border-white/[0.06] rounded-xl p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between text-2xs">
                          <span className="font-semibold text-nox-high">{cr.coachName}</span>
                          <span className="text-nox-low font-mono">
                            {new Date(cr.respondedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                          "{cr.response}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Management Resolution Banner */}
                {c.response && (
                  <div className="mt-2 pt-3 border-t border-field-400/20 bg-field-500/[0.04] p-3 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-2xs uppercase tracking-wider text-field-600 dark:text-field-400 font-bold flex items-center gap-1.5">
                        <ShieldCheck size={13} />
                        Official Academy Resolution
                        {c.respondedByName ? ` · By ${c.respondedByName}` : ""}
                      </p>
                      {c.respondedAt && (
                        <span className="text-2xs font-mono text-field-600 dark:text-field-400">
                          {new Date(c.respondedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 dark:text-white/90 leading-relaxed font-medium">
                      {c.response}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-pitch-200/50 dark:border-white/[0.06] text-xs text-nox-mid">
              <span className="font-mono text-2xs">
                Showing page {page} of {totalPages} ({filteredComplaints.length} concerns)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-lg border border-pitch-200 dark:border-white/10 bg-pitch-100 dark:bg-white/[0.04] text-nox-high disabled:opacity-30 disabled:cursor-not-allowed hover:bg-pitch-200 dark:hover:bg-white/10 transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2 py-0.5 rounded font-mono text-2xs font-semibold bg-core-400/10 text-core-400">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-pitch-200 dark:border-white/10 bg-pitch-100 dark:bg-white/[0.04] text-nox-high disabled:opacity-30 disabled:cursor-not-allowed hover:bg-pitch-200 dark:hover:bg-white/10 transition-colors"
                  title="Next page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};