// src/features/complaints/PlatformSupportTab.tsx
import React, { useState } from "react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import {
  LifeBuoy,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldAlert,
  HelpCircle,
  Bug,
  CreditCard,
  Sparkles,
  UserCheck,
  X,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Skeleton, EmptyState } from "../../components/ui";
import {
  useListMyPlatformTicketsQuery,
  useCreatePlatformTicketMutation,
  useReplyPlatformTicketMutation,
  useUpdatePlatformTicketStatusMutation,
  type PlatformTicket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "../../store/api/platformTicketApi";

const CATEGORY_LABELS: Record<TicketCategory, { label: string; icon: LucideIcon }> = {
  bug_technical: { label: "Technical Issue / Bug", icon: Bug },
  billing_subscription: { label: "Billing & Subscription", icon: CreditCard },
  feature_request: { label: "Feature Request", icon: Sparkles },
  account_access: { label: "Account & Access", icon: UserCheck },
  other: { label: "General Platform Query", icon: HelpCircle },
};

const PRIORITY_BADGES: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  medium: { label: "Medium", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  high: { label: "High", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  urgent: { label: "Urgent", color: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const STATUS_VARIANTS: Record<TicketStatus, { label: string; variant: "yellow" | "blue" | "green" | "gray" }> = {
  open: { label: "Open", variant: "yellow" },
  in_progress: { label: "In Progress", variant: "blue" },
  resolved: { label: "Resolved", variant: "green" },
  closed: { label: "Closed", variant: "gray" },
};

export const PlatformSupportTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: tickets, isLoading } = useListMyPlatformTicketsQuery(
    statusFilter ? { status: statusFilter } : undefined
  );

  const selectedTicket = tickets?.find((t) => t.id === selectedTicketId) || (tickets && tickets.length > 0 ? tickets[0] : null);

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-pitch-900/60 p-4 rounded-xl border border-white/5">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <LifeBuoy className="text-volt-400" size={18} />
            Platform Support Tickets
          </h2>
          <p className="text-xs text-slate-400">
            Submit inquiries, bug reports, and assistance requests directly to the Platform Super Admin.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-xs py-1.5 px-3 w-full sm:w-auto"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <Button
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => setShowCreateModal(true)}
            className="whitespace-nowrap"
          >
            Submit Query / Issue
          </Button>
        </div>
      </div>

      {/* Main split view */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tickets List */}
        <div className="lg:col-span-5 space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : !tickets?.length ? (
            <div className="card p-8 text-center space-y-3">
              <LifeBuoy className="mx-auto text-slate-600" size={36} />
              <p className="text-sm font-medium text-white">No platform tickets filed yet</p>
              <p className="text-xs text-slate-400">
                Have an issue with the platform or need help from the Super Admin? Click below to submit a ticket.
              </p>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)}>
                Submit New Ticket
              </Button>
            </div>
          ) : (
            tickets.map((ticket) => {
              const CategoryIcon = CATEGORY_LABELS[ticket.category]?.icon || HelpCircle;
              const isSelected = selectedTicket?.id === ticket.id;
              const hasSuperAdminReply = ticket.messages?.some((m) => m.senderRole === "super_admin");

              return (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={clsx(
                    "w-full text-left card p-4 space-y-2.5 transition-all relative overflow-hidden",
                    isSelected
                      ? "border-volt-400 bg-pitch-900/90 shadow-md shadow-volt-400/5"
                      : "hover:border-white/20 bg-pitch-900/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-2xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-volt-400 font-medium">
                      {ticket.ticketNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={clsx(
                          "text-3xs uppercase font-bold px-1.5 py-0.5 rounded border",
                          PRIORITY_BADGES[ticket.priority]?.color
                        )}
                      >
                        {PRIORITY_BADGES[ticket.priority]?.label}
                      </span>
                      <Badge variant={STATUS_VARIANTS[ticket.status].variant}>
                        {STATUS_VARIANTS[ticket.status].label}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-white line-clamp-1">{ticket.subject}</p>

                  <div className="flex items-center justify-between text-2xs text-slate-400">
                    <span className="flex items-center gap-1 text-slate-300">
                      <CategoryIcon size={12} className="text-slate-400" />
                      {CATEGORY_LABELS[ticket.category]?.label || ticket.category}
                    </span>
                    <span>{new Date(ticket.createdAt).toLocaleDateString("en-IN")}</span>
                  </div>

                  {hasSuperAdminReply && (
                    <div className="flex items-center gap-1.5 text-2xs text-emerald-400 font-medium pt-1 border-t border-white/5">
                      <CheckCircle2 size={12} />
                      Super Admin has responded
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Selected Ticket Thread & Reply */}
        <div className="lg:col-span-7">
          {selectedTicket ? (
            <TicketDetailView ticket={selectedTicket} />
          ) : (
            <EmptyState
              icon={<LifeBuoy size={32} />}
              title="Select a ticket"
              description="Choose a platform ticket from the list to view the conversation history and Super Admin replies."
            />
          )}
        </div>
      </div>

      {/* Create Ticket Modal */}
      {showCreateModal && <CreateTicketModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
};

// ─── Ticket Detail & Conversation View ──────────────────────────────────────────
const TicketDetailView: React.FC<{ ticket: PlatformTicket }> = ({ ticket }) => {
  const [replyText, setReplyText] = useState("");
  const [replyMutation, { isLoading: isReplying }] = useReplyPlatformTicketMutation();
  const [updateStatusMutation, { isLoading: isUpdatingStatus }] = useUpdatePlatformTicketStatusMutation();

  const handleSendReply = async () => {
    if (!replyText.trim()) return toast.error("Please enter a reply message");
    try {
      await replyMutation({
        ticketId: ticket.id,
        message: replyText.trim(),
      }).unwrap();
      toast.success("Reply sent to Super Admin");
      setReplyText("");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to send reply");
    }
  };

  const handleCloseTicket = async () => {
    try {
      await updateStatusMutation({
        ticketId: ticket.id,
        status: "closed",
      }).unwrap();
      toast.success("Ticket closed");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to close ticket");
    }
  };

  const CategoryIcon = CATEGORY_LABELS[ticket.category]?.icon || HelpCircle;

  return (
    <div className="card p-5 space-y-5 bg-pitch-900/70">
      {/* Header */}
      <div className="border-b border-white/10 pb-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-volt-400/10 border border-volt-400/20 text-volt-400 font-bold">
              {ticket.ticketNumber}
            </span>
            <Badge variant={STATUS_VARIANTS[ticket.status].variant}>
              {STATUS_VARIANTS[ticket.status].label}
            </Badge>
            <span
              className={clsx(
                "text-2xs uppercase font-bold px-2 py-0.5 rounded border",
                PRIORITY_BADGES[ticket.priority]?.color
              )}
            >
              {PRIORITY_BADGES[ticket.priority]?.label} Priority
            </span>
          </div>

          {ticket.status !== "closed" && (
            <button
              onClick={handleCloseTicket}
              disabled={isUpdatingStatus}
              className="text-2xs text-slate-400 hover:text-white px-2.5 py-1 rounded border border-white/10 hover:border-white/20 transition-colors"
            >
              Close Ticket
            </button>
          )}
        </div>

        <h3 className="text-base sm:text-lg font-bold text-white">{ticket.subject}</h3>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <CategoryIcon size={14} className="text-slate-400" />
            {CATEGORY_LABELS[ticket.category]?.label || ticket.category}
          </span>
          <span>Submitted: {new Date(ticket.createdAt).toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
        {ticket.messages?.map((msg, index) => {
          const isSuperAdmin = msg.senderRole === "super_admin";

          return (
            <div
              key={msg.id || index}
              className={clsx(
                "p-4 rounded-xl space-y-2 border transition-colors",
                isSuperAdmin
                  ? "bg-purple-950/30 border-purple-500/30 ml-2 sm:ml-6"
                  : "bg-pitch-800/80 border-white/10 mr-2 sm:mr-6"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "text-xs font-semibold flex items-center gap-1.5",
                      isSuperAdmin ? "text-purple-400" : "text-volt-400"
                    )}
                  >
                    {isSuperAdmin ? (
                      <>
                        <LifeBuoy size={14} />
                        Super Admin (Platform Support)
                      </>
                    ) : (
                      <>
                        <MessageSquare size={14} />
                        {msg.senderName} (Academy Owner)
                      </>
                    )}
                  </span>
                </div>
                <span className="text-3xs text-slate-400">
                  {new Date(msg.createdAt).toLocaleString("en-IN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                {msg.message}
              </p>
            </div>
          );
        })}
      </div>

      {/* Reply Section */}
      {ticket.status === "closed" ? (
        <div className="p-3.5 bg-slate-900/60 border border-white/5 rounded-xl text-center text-xs text-slate-400">
          This ticket is closed. If you have another query, please submit a new ticket.
        </div>
      ) : (
        <div className="pt-2 border-t border-white/10 space-y-3">
          <label className="text-xs font-medium text-slate-300 block">
            Add a reply or clarification to Super Admin
          </label>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your response to the Super Admin here…"
            className="input w-full min-h-[90px] resize-none text-xs sm:text-sm p-3"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              icon={<Send size={14} />}
              loading={isReplying}
              onClick={handleSendReply}
            >
              Send Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Create Platform Ticket Modal ──────────────────────────────────────────────
const CreateTicketModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [createTicket, { isLoading }] = useCreatePlatformTicketMutation();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("bug_technical");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return toast.error("Please enter a subject");
    if (description.trim().length < 10) return toast.error("Description must be at least 10 characters");

    try {
      await createTicket({
        subject: subject.trim(),
        category,
        priority,
        description: description.trim(),
      }).unwrap();
      toast.success("Platform ticket submitted to Super Admin!");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to submit ticket");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-lg p-6 bg-pitch-900 border-white/10 space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X size={18} />
        </button>

        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <LifeBuoy className="text-volt-400" size={20} />
            Submit Query / Issue to Super Admin
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Our platform support team and Super Admin will review your query and reply back directly.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="input w-full text-xs"
              >
                <option value="bug_technical">Technical Issue / Bug</option>
                <option value="billing_subscription">Billing & Subscriptions</option>
                <option value="feature_request">Feature Request</option>
                <option value="account_access">Account & Access</option>
                <option value="other">General Platform Query</option>
              </select>
            </div>

            <div>
              <label className="label">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="input w-full text-xs"
              >
                <option value="low">Low - General query</option>
                <option value="medium">Medium - Standard operational</option>
                <option value="high">High - Feature hindered</option>
                <option value="urgent">Urgent - Critical blocker</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Issue generating installment receipts"
              maxLength={150}
              className="input w-full text-sm"
              required
            />
          </div>

          <div>
            <label className="label">Detailed Explanation</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe the issue or query in detail. Include steps to reproduce if reporting a glitch…"
              rows={5}
              className="input w-full text-sm resize-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" loading={isLoading} type="submit" icon={<Send size={14} />}>
              Submit to Super Admin
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
