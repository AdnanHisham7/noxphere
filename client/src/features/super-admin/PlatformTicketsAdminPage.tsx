// src/features/super-admin/PlatformTicketsAdminPage.tsx
import React, { useState, useMemo } from "react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import {
  LifeBuoy,
  Search,
  Filter,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Bug,
  CreditCard,
  Sparkles,
  UserCheck,
  HelpCircle,
  Building2,
  Mail,
  User,
  MessageSquare,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Skeleton, EmptyState } from "../../components/ui";
import {
  useListAllPlatformTicketsQuery,
  useReplyPlatformTicketMutation,
  useUpdatePlatformTicketStatusMutation,
  type PlatformTicket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "../../store/api/platformTicketApi";

const CATEGORY_META: Record<
  TicketCategory,
  { label: string; icon: LucideIcon }
> = {
  bug_technical: { label: "Bug / Technical", icon: Bug },
  billing_subscription: { label: "Billing & Subscriptions", icon: CreditCard },
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

export const PlatformTicketsAdminPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const { data: tickets, isLoading } = useListAllPlatformTicketsQuery({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    category: categoryFilter || undefined,
    search: searchQuery || undefined,
  });

  // Calculate ticket counts
  const stats = useMemo(() => {
    if (!tickets) return { total: 0, open: 0, inProgress: 0, resolved: 0, urgent: 0 };
    return {
      total: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      inProgress: tickets.filter((t) => t.status === "in_progress").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      urgent: tickets.filter((t) => (t.priority === "urgent" || t.priority === "high") && t.status !== "resolved" && t.status !== "closed").length,
    };
  }, [tickets]);

  const selectedTicket =
    tickets?.find((t) => t.id === selectedTicketId) || (tickets && tickets.length > 0 ? tickets[0] : null);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <p className="section-title mb-1">Super Administration</p>
        <h1 className="font-display font-extrabold text-white text-xl sm:text-2xl uppercase tracking-tight flex items-center gap-2.5">
          <LifeBuoy className="text-volt-400" size={26} />
          Platform Issues & Support Tickets
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Review issues, questions, and bug reports submitted by Academy Owners, and reply directly back.
        </p>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div className="card p-3.5 bg-pitch-900/60 border-white/10 space-y-1">
          <p className="text-3xs uppercase font-bold text-slate-400 tracking-wider">Total Filed</p>
          <p className="text-xl sm:text-2xl font-black text-white">{stats.total}</p>
        </div>
        <div className="card p-3.5 bg-amber-500/5 border-amber-500/20 space-y-1">
          <p className="text-3xs uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
            <Clock size={11} /> Open
          </p>
          <p className="text-xl sm:text-2xl font-black text-amber-300">{stats.open}</p>
        </div>
        <div className="card p-3.5 bg-blue-500/5 border-blue-500/20 space-y-1">
          <p className="text-3xs uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1">
            <Clock size={11} /> In Progress
          </p>
          <p className="text-xl sm:text-2xl font-black text-blue-300">{stats.inProgress}</p>
        </div>
        <div className="card p-3.5 bg-emerald-500/5 border-emerald-500/20 space-y-1">
          <p className="text-3xs uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
            <CheckCircle2 size={11} /> Resolved
          </p>
          <p className="text-xl sm:text-2xl font-black text-emerald-300">{stats.resolved}</p>
        </div>
        <div className="card p-3.5 bg-red-500/5 border-red-500/20 space-y-1 col-span-2 sm:col-span-1">
          <p className="text-3xs uppercase font-bold text-red-400 tracking-wider flex items-center gap-1">
            <Flame size={11} /> Urgent / High
          </p>
          <p className="text-xl sm:text-2xl font-black text-red-300">{stats.urgent}</p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="card p-4 bg-pitch-900/80 border-white/10 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ticket #, academy name, manager name, or subject…"
            className="input w-full pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-xs py-1.5 px-3 flex-1 sm:flex-none"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="input text-xs py-1.5 px-3 flex-1 sm:flex-none"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input text-xs py-1.5 px-3 flex-1 sm:flex-none"
          >
            <option value="">All Categories</option>
            <option value="bug_technical">Bug / Technical</option>
            <option value="billing_subscription">Billing & Subscriptions</option>
            <option value="feature_request">Feature Request</option>
            <option value="account_access">Account & Access</option>
            <option value="other">General Platform Query</option>
          </select>
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Tickets Queue */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : !tickets?.length ? (
            <div className="card p-8 text-center space-y-2">
              <CheckCircle2 className="mx-auto text-emerald-400" size={32} />
              <p className="text-sm font-semibold text-white">All Clear</p>
              <p className="text-xs text-slate-400">No support tickets match the selected filters.</p>
            </div>
          ) : (
            tickets.map((ticket) => {
              const CategoryIcon = CATEGORY_META[ticket.category]?.icon || HelpCircle;
              const isSelected = selectedTicket?.id === ticket.id;
              const needsAdminReply =
                ticket.lastRepliedRole === "manager" && ticket.status !== "resolved" && ticket.status !== "closed";

              return (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={clsx(
                    "w-full text-left card p-4 space-y-2.5 transition-all relative overflow-hidden",
                    isSelected
                      ? "border-volt-400 bg-pitch-900/95 shadow-lg shadow-volt-400/5 ring-1 ring-volt-400/30"
                      : "hover:border-white/20 bg-pitch-900/50"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-2xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-volt-400 font-bold">
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

                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-volt-400/90 flex items-center gap-1">
                      <Building2 size={12} />
                      {ticket.academyName}
                    </p>
                    <p className="text-sm font-semibold text-white line-clamp-1">{ticket.subject}</p>
                  </div>

                  <div className="flex items-center justify-between text-2xs text-slate-400 pt-1 border-t border-white/5">
                    <span className="truncate max-w-[170px]">
                      By {ticket.raisedByName}
                    </span>
                    <span>{new Date(ticket.createdAt).toLocaleDateString("en-IN")}</span>
                  </div>

                  {needsAdminReply && (
                    <div className="flex items-center gap-1.5 text-2xs text-amber-400 font-semibold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                      <AlertTriangle size={12} />
                      Awaiting response from Super Admin
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Right Column: Active Ticket Thread & Response Workspace */}
        <div className="lg:col-span-7">
          {selectedTicket ? (
            <AdminTicketWorkspace ticket={selectedTicket} />
          ) : (
            <EmptyState
              icon={<LifeBuoy size={36} />}
              title="No ticket selected"
              description="Select a ticket from the queue on the left to review its conversation and respond back to the academy owner."
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Super Admin Ticket Workspace ──────────────────────────────────────────────
const AdminTicketWorkspace: React.FC<{ ticket: PlatformTicket }> = ({ ticket }) => {
  const [replyText, setReplyText] = useState("");
  const [targetStatus, setTargetStatus] = useState<TicketStatus>(ticket.status);
  const [replyMutation, { isLoading: isReplying }] = useReplyPlatformTicketMutation();
  const [updateStatusMutation, { isLoading: isUpdatingStatus }] = useUpdatePlatformTicketStatusMutation();

  // Sync target status when ticket changes
  React.useEffect(() => {
    setTargetStatus(ticket.status);
  }, [ticket.id, ticket.status]);

  const handleSendResponse = async (statusOverride?: TicketStatus) => {
    if (!replyText.trim()) return toast.error("Please enter a response message for the owner");

    const statusToSend = statusOverride || targetStatus;

    try {
      await replyMutation({
        ticketId: ticket.id,
        message: replyText.trim(),
        status: statusToSend,
      }).unwrap();
      toast.success("Response sent directly to academy owner!");
      setReplyText("");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to send response");
    }
  };

  const handleStatusChangeOnly = async (newStatus: TicketStatus) => {
    try {
      await updateStatusMutation({
        ticketId: ticket.id,
        status: newStatus,
      }).unwrap();
      toast.success(`Ticket status updated to ${newStatus.replace("_", " ")}`);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update status");
    }
  };

  const CategoryIcon = CATEGORY_META[ticket.category]?.icon || HelpCircle;

  return (
    <div className="card p-5 sm:p-6 space-y-5 bg-pitch-900/80 border-white/10">
      {/* Header Info */}
      <div className="border-b border-white/10 pb-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-volt-400/10 border border-volt-400/20 text-volt-400 font-bold">
              {ticket.ticketNumber}
            </span>
            <span
              className={clsx(
                "text-2xs uppercase font-bold px-2 py-0.5 rounded border",
                PRIORITY_BADGES[ticket.priority]?.color
              )}
            >
              {PRIORITY_BADGES[ticket.priority]?.label} Priority
            </span>
          </div>

          {/* Direct Status Selector */}
          <div className="flex items-center gap-2">
            <span className="text-2xs text-slate-400 font-medium">Status:</span>
            <select
              value={ticket.status}
              disabled={isUpdatingStatus}
              onChange={(e) => handleStatusChangeOnly(e.target.value as TicketStatus)}
              className="input text-xs py-1 px-2.5 font-semibold bg-pitch-800"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-white">{ticket.subject}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-1">
            <span className="flex items-center gap-1.5 font-semibold text-volt-400">
              <Building2 size={13} />
              {ticket.academyName}
            </span>
            <span className="flex items-center gap-1.5">
              <User size={13} className="text-slate-400" />
              {ticket.raisedByName}
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Mail size={13} />
              {ticket.raisedByEmail}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
          <span className="flex items-center gap-1.5">
            <CategoryIcon size={14} className="text-slate-400" />
            Category: {CATEGORY_META[ticket.category]?.label || ticket.category}
          </span>
          <span>Submitted on: {new Date(ticket.createdAt).toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Messages Thread */}
      <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
        {ticket.messages?.map((msg, idx) => {
          const isSuperAdmin = msg.senderRole === "super_admin";

          return (
            <div
              key={msg.id || idx}
              className={clsx(
                "p-4 rounded-xl space-y-2 border transition-colors",
                isSuperAdmin
                  ? "bg-purple-950/40 border-purple-500/30 ml-2 sm:ml-6"
                  : "bg-pitch-800/90 border-white/10 mr-2 sm:mr-6"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={clsx(
                    "text-xs font-semibold flex items-center gap-1.5",
                    isSuperAdmin ? "text-purple-400" : "text-volt-400"
                  )}
                >
                  {isSuperAdmin ? (
                    <>
                      <LifeBuoy size={14} />
                      You (Platform Super Admin)
                    </>
                  ) : (
                    <>
                      <Building2 size={14} />
                      {msg.senderName} ({ticket.academyName})
                    </>
                  )}
                </span>
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

      {/* Response Box to Owner */}
      <div className="pt-3 border-t border-white/10 space-y-3">
        <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
          <Send size={13} className="text-volt-400" />
          Respond to {ticket.raisedByName} ({ticket.academyName})
        </label>
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Write your official response or solution here. This will be sent directly to the Academy Manager…"
          rows={4}
          className="input w-full text-xs sm:text-sm p-3 resize-none bg-pitch-900"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xs text-slate-400">Update status on reply:</span>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as TicketStatus)}
              className="input text-xs py-1 px-2.5 font-semibold bg-pitch-800"
            >
              <option value="in_progress">In Progress</option>
              <option value="resolved">Mark as Resolved</option>
              <option value="open">Keep Open</option>
              <option value="closed">Close Ticket</option>
            </select>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="secondary"
              loading={isReplying}
              onClick={() => handleSendResponse("resolved")}
              className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            >
              Reply & Mark Resolved
            </Button>
            <Button
              size="sm"
              loading={isReplying}
              onClick={() => handleSendResponse()}
              icon={<Send size={14} />}
            >
              Send Response
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformTicketsAdminPage;
