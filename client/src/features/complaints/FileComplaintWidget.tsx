// src/features/complaints/FileComplaintWidget.tsx
import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { MessageSquareWarning, Send, User, UserCheck, ShieldAlert } from "lucide-react";
import {
  useCreateComplaintMutation,
  useListMyComplaintsQuery,
  type Complaint,
} from "../../store/api/complaintApi";
import { useGetMyChildrenQuery } from "../../store/api/guardianApi";
import { Select } from "../../components/ui";

const STATUS_LABEL: Record<Complaint["status"], string> = {
  open: "Awaiting response",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const FileComplaintWidget: React.FC = () => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  const [create, { isLoading }] = useCreateComplaintMutation();
  const { data: mine } = useListMyComplaintsQuery();
  const { data: children } = useGetMyChildrenQuery(undefined, {
    // only runs if user is authenticated; if not guardian, returns []
    refetchOnMountOrArgChange: false,
  });

  // Pre-select if guardian has only 1 child
  useEffect(() => {
    if (children && children.length === 1 && !selectedStudentId) {
      setSelectedStudentId(children[0]._id || (children[0] as any).id);
    }
  }, [children, selectedStudentId]);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return toast.error("Fill in both subject and description");
    try {
      await create({
        subject: subject.trim(),
        message: message.trim(),
        studentId: selectedStudentId || undefined,
      }).unwrap();
      toast.success("Complaint submitted to your academy manager");
      setSubject("");
      setMessage("");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't submit — try again");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-white/10 p-5 space-y-3 bg-white dark:bg-pitch-900/40">
        <div className="flex items-center gap-2">
          <MessageSquareWarning size={16} className="text-amber-400" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Raise a complaint</p>
        </div>

        {children && children.length > 0 && (
          <Select
            label="Select Child / Student (Optional)"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
          >
            <option value="">Regarding child (Select student)...</option>
            {children.map((child) => (
              <option key={child._id || (child as any).id} value={child._id || (child as any).id}>
                {child.firstName} {child.lastName} {child.ageGroup ? `(${child.ageGroup})` : ""}
              </option>
            ))}
          </Select>
        )}

        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject / Summary"
          className="w-full rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white/30"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the concern or issue in detail…"
          className="w-full rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-white/30 min-h-24 resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="flex items-center gap-2 text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-black rounded-lg px-4 py-2 disabled:opacity-50 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
        >
          <Send size={13} /> Submit Complaint
        </button>
      </div>

      {mine && mine.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/50">
            Your complaints ({mine.length})
          </p>
          {mine.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-2 bg-slate-50/50 dark:bg-pitch-900/40"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.subject}</p>
                  {c.studentName && (
                    <span className="text-2xs font-mono px-2 py-0.5 rounded bg-core-400/10 text-core-400 font-medium">
                      Student: {c.studentName}
                    </span>
                  )}
                </div>
                <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{c.message}</p>

              {/* Forwarded to coach notice */}
              {c.forwardedToCoaches && c.forwardedToCoaches.length > 0 && (
                <div className="bg-volt-400/5 border border-volt-400/20 rounded-lg p-2.5 flex items-center gap-2 text-xs text-volt-400">
                  <UserCheck size={14} className="shrink-0" />
                  <span>
                    Forwarded to coach:{" "}
                    <strong>{c.forwardedToCoaches.map((fc) => fc.coachName).join(", ")}</strong>
                  </span>
                </div>
              )}

              {/* Coach Responses */}
              {c.coachResponses && c.coachResponses.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-2">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-core-400 flex items-center gap-1.5">
                    <User size={12} /> Coach Feedback
                  </p>
                  {c.coachResponses.map((cr, idx) => (
                    <div
                      key={idx}
                      className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between text-2xs text-slate-400">
                        <span className="font-semibold text-slate-200">{cr.coachName}</span>
                        <span>{new Date(cr.respondedAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{cr.response}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Manager's Response */}
              {c.response && (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-white/10">
                  <p className="text-2xs text-slate-400 dark:text-white/40 uppercase mb-1 font-semibold">
                    Management's Response {c.respondedByName ? `(${c.respondedByName})` : ""}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-white/80">{c.response}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};