// src/features/complaints/FileComplaintWidget.tsx
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { MessageSquareWarning, Send } from "lucide-react";
import { useCreateComplaintMutation, useListMyComplaintsQuery, type Complaint } from "../../store/api/complaintApi";

const STATUS_LABEL: Record<Complaint["status"], string> = {
  open: "Awaiting response",
  in_progress: "In progress",
  resolved: "Resolved",
};

// Used from the guardian portal. Kept in plain, portable Tailwind
// classes rather than the portal's own component kit so it could also
// drop into a coach or employee context later without a redesign.
export const FileComplaintWidget: React.FC = () => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [create, { isLoading }] = useCreateComplaintMutation();
  const { data: mine } = useListMyComplaintsQuery();

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return toast.error("Fill in both fields");
    try {
      await create({ subject: subject.trim(), message: message.trim() }).unwrap();
      toast.success("Complaint submitted to your academy manager");
      setSubject("");
      setMessage("");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't submit — try again");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquareWarning size={16} className="text-amber-400" />
          <p className="text-sm font-semibold">Raise a complaint</p>
        </div>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/30"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the issue…"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/30 min-h-24 resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="flex items-center gap-2 text-sm font-semibold bg-white text-black rounded-lg px-4 py-2 disabled:opacity-50"
        >
          <Send size={13} /> Submit
        </button>
      </div>

      {mine && mine.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Your complaints</p>
          {mine.map((c) => (
            <div key={c.id} className="rounded-lg border border-white/10 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{c.subject}</p>
                <span className="text-2xs text-white/50">{STATUS_LABEL[c.status]}</span>
              </div>
              <p className="text-xs text-white/60">{c.message}</p>
              {c.response && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className="text-2xs text-white/40 uppercase mb-1">Manager's response</p>
                  <p className="text-xs text-white/70">{c.response}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};