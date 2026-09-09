// src/features/complaints/ComplaintsInboxPage.tsx
import React, { useState } from "react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { MessageSquareWarning, Send, LifeBuoy } from "lucide-react";
import { Badge, Button, Skeleton, EmptyState } from "../../components/ui";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import {
  useListAcademyComplaintsQuery,
  useRespondToComplaintMutation,
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
  const [activeTab, setActiveTab] = useState<"academy_inquiries" | "platform_support">("academy_inquiries");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<Complaint | null>(null);
  const { data: complaints, isLoading } = useListAcademyComplaintsQuery(
    { academyId: academyId ?? "", status: statusFilter || undefined },
    { skip: !academyId },
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="section-title mb-1">Support & Helpdesk</p>
          <h1 className="font-display font-extrabold text-white text-xl sm:text-2xl uppercase tracking-tight">
            {activeTab === "academy_inquiries" ? "Academy Complaints" : "Platform Support"}
          </h1>
        </div>

        <div className="flex items-center gap-2 bg-pitch-900/80 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("academy_inquiries")}
            className={clsx(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
              activeTab === "academy_inquiries"
                ? "bg-volt-400 text-pitch-900 shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
          >
            <MessageSquareWarning size={14} />
            Academy Complaints
          </button>
          <button
            onClick={() => setActiveTab("platform_support")}
            className={clsx(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
              activeTab === "platform_support"
                ? "bg-volt-400 text-pitch-900 shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
          >
            <LifeBuoy size={14} />
            Platform Support (To Super Admin)
          </button>
        </div>
      </div>

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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input text-xs py-1.5 px-3 w-full sm:w-auto"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded" />)
          ) : !complaints?.length ? (
            <EmptyState icon={<MessageSquareWarning size={28} />} title="No complaints" description="Nothing filed yet." />
          ) : (
            complaints.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={clsx(
                  "w-full text-left card p-4 space-y-1.5 transition-colors",
                  selected?.id === c.id ? "border-volt-400/40" : "hover:border-white/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white truncate">{c.subject}</p>
                  <Badge variant={STATUS_VARIANT[c.status || "open"]}>{(c.status || "open").replace("_", " ")}</Badge>
                </div>
                <p className="text-2xs text-slate-500">
                  {c.raisedByName} · {c.raisedByRole} · {new Date(c.createdAt).toLocaleDateString("en-IN")}
                </p>
                <p className="text-xs text-slate-400 line-clamp-1">{c.message}</p>
              </button>
            ))
          )}
        </div>

        <div>
          {selected ? (
            <ComplaintDetail academyId={academyId!} complaint={selected} onResponded={setSelected} />
          ) : (
            <EmptyState icon={<MessageSquareWarning size={28} />} title="Select a complaint" description="Pick one from the list to view and respond." />
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
  onResponded: (c: Complaint) => void;
}> = ({ academyId, complaint, onResponded }) => {
  const [respond, { isLoading }] = useRespondToComplaintMutation();
  const [response, setResponse] = useState(complaint.response ?? "");
  const [status, setStatus] = useState<"in_progress" | "resolved">(
    complaint.status === "resolved" ? "resolved" : "in_progress",
  );

  const handleSend = async () => {
    if (!response.trim()) return toast.error("Enter a response");
    try {
      const res: any = await respond({ academyId, complaintId: complaint.id, response: response.trim(), status }).unwrap();
      toast.success("Response sent");
      const updated = res?.data || res;
      onResponded(updated);
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't send response — try again");
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-white">{complaint.subject}</p>
          <Badge variant={STATUS_VARIANT[complaint.status || "open"]}>{(complaint.status || "open").replace("_", " ")}</Badge>
        </div>
        <p className="text-2xs text-slate-500">
          {complaint.raisedByName} · {complaint.raisedByRole} · {new Date(complaint.createdAt).toLocaleString("en-IN")}
        </p>
      </div>
      <p className="text-sm text-slate-300 bg-pitch-800 border border-white/10 rounded p-3">{complaint.message}</p>

      <div>
        <label className="label">Your response</label>
        <textarea
          className="input min-h-24 resize-none w-full"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Write a response…"
        />
      </div>
      <div>
        <label className="label">Mark as</label>
        <div className="flex gap-2">
          {(["in_progress", "resolved"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={clsx(
                "flex-1 rounded px-3 py-2 text-sm font-semibold border transition-colors",
                status === s ? "bg-volt-400 border-volt-400 text-pitch-900" : "bg-pitch-800 border-white/10 text-slate-400"
              )}
            >
              {s === "in_progress" ? "In Progress" : "Resolved"}
            </button>
          ))}
        </div>
      </div>
      <Button className="w-full" icon={<Send size={14} />} loading={isLoading} onClick={handleSend}>
        Send Response
      </Button>
    </div>
  );
};

export default ComplaintsInboxPage;