// src/features/notifications/NotificationsPage.tsx
import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  LucideIcon,
  Bell,
  Plus,
  FileText,
  CheckCheck,
  Check,
  Radio,
  Clock,
  Filter,
  AlertCircle,
  MessageSquare,
  Users,
  Calendar,
  CreditCard,
  Layers,
  Mail,
  Smartphone,
} from "lucide-react";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import {
  Card,
  Badge,
  Button,
  Input,
  Modal,
  Skeleton,
  EmptyState,
  ImageUploadField,
  DocumentUploadField,
} from "../../components/ui";
import { RootState } from "../../store";
import { useCurrentFranchiseId } from "../../hooks/useCurrentFranchiseId";
import { useListTeamsQuery } from "../../store/api/teamsApi";
import { useGetFranchisesQuery } from "../../store/api/franchiseApi";
import { setActiveFranchise } from "../../store/slices/uiSlice";
import {
  useListNotificationsQuery,
  useCreateNotificationMutation,
  AdminNotification,
} from "../../store/api/adminNotificationsApi";
import {
  useGetMyNotificationsQuery,
  useMarkMyNotificationReadMutation,
  useMarkAllMyNotificationsReadMutation,
} from "../../store/api/myNotificationsApi";
import { markOneRead, markAllRead } from "../../store/slices/notificationSlice";

const AUDIENCE_LABEL: Record<AdminNotification["audience"], string> = {
  players: "Players Only",
  guardians: "Guardians Only",
  coaches: "Coaches Only",
  managers: "Managers Only",
  franchise: "Entire Franchise",
  academy: "Entire Academy",
  team: "One Team",
};

const CHANNEL_META: Record<
  string,
  { label: string; color: string; icon: LucideIcon }
> = {
  push: {
    label: "Push / In-App",
    color: "bg-volt-400/10 text-volt-600 dark:text-volt-400 border-volt-400/20",
    icon: Bell,
  },
  whatsapp: {
    label: "WhatsApp",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    icon: MessageSquare,
  },
  email: {
    label: "Email",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    icon: Mail,
  },
  sms: {
    label: "SMS",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    icon: Smartphone,
  },
};

const getTypeMeta = (type?: string) => {
  switch (type) {
    case "complaint":
      return {
        variant: "yellow" as const,
        label: "Complaint",
        icon: MessageSquare,
        color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
      };
    case "session":
    case "session_rsvp":
      return {
        variant: "blue" as const,
        label: "Session",
        icon: Calendar,
        color: "text-ice-400 bg-ice-400/10 border-ice-400/20",
      };
    case "student":
    case "registration":
    case "registration_request":
      return {
        variant: "green" as const,
        label: "Squad / Player",
        icon: Users,
        color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
      };
    case "fee":
    case "payment":
    case "subscription":
      return {
        variant: "green" as const,
        label: "Payment & Billing",
        icon: CreditCard,
        color: "text-volt-400 bg-volt-400/10 border-volt-400/20",
      };
    default:
      return {
        variant: "gray" as const,
        label: (type || "Alert").toUpperCase(),
        icon: Bell,
        color: "text-slate-400 bg-slate-400/10 border-slate-400/20",
      };
  }
};

const NotificationsPage: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((s: RootState) => s.auth);
  const franchiseId = useCurrentFranchiseId();

  const [activeTab, setActiveTab] = useState<"system" | "broadcasts">("system");
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  // 1. Internal System Alerts query (for the current user)
  const {
    data: myAlertsData,
    isLoading: isMyAlertsLoading,
    isError: isMyAlertsError,
    refetch: refetchMyAlerts,
  } = useGetMyNotificationsQuery({ limit: 50 });

  const [markOneReadOnServer] = useMarkMyNotificationReadMutation();
  const [markAllReadOnServer, { isLoading: isMarkingAllRead }] =
    useMarkAllMyNotificationsReadMutation();

  // 2. Franchise Broadcast Announcements query
  const {
    data: broadcastsData,
    isLoading: isBroadcastsLoading,
    isError: isBroadcastsError,
  } = useListNotificationsQuery(
    { franchiseId: franchiseId ?? "" },
    { skip: !franchiseId }
  );

  const canManageBroadcasts =
    user?.role === "manager" ||
    user?.role === "coach" ||
    user?.role === "super_admin";

  // Automatically select the first franchise upon opening alerts page if none is active
  const { data: franchises } = useGetFranchisesQuery(
    user?.academyId ? { academyId: user.academyId, isActive: true } : undefined,
    { skip: !canManageBroadcasts || !!franchiseId }
  );

  useEffect(() => {
    if (!franchiseId && franchises && franchises.length > 0) {
      dispatch(setActiveFranchise(franchises[0].id));
    }
  }, [franchiseId, franchises, dispatch]);

  const rawItems = myAlertsData?.items ?? [];
  const systemAlerts = filterUnreadOnly
    ? rawItems.filter((item) => !item.isRead)
    : rawItems;
  const unreadAlertsCount = myAlertsData?.unreadCount ?? 0;

  const handleMarkOneRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    dispatch(markOneRead(id));
    try {
      await markOneReadOnServer(id).unwrap();
    } catch {
      // Handled silently
    }
  };

  const handleMarkAllRead = async () => {
    dispatch(markAllRead());
    try {
      await markAllReadOnServer().unwrap();
      toast.success("All system alerts marked as read");
      refetchMyAlerts();
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              Notifications & Alerts
            </h1>
            {unreadAlertsCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-ember-500 text-white animate-pulse">
                {unreadAlertsCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            System operational alerts and community-wide broadcasts
          </p>
        </div>

        {/* Tab navigation + Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-pitch-800 p-1 rounded-lg border border-slate-200 dark:border-white/5">
            <button
              onClick={() => setActiveTab("system")}
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
                activeTab === "system"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-pitch-900 dark:text-volt-400"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Bell size={14} />
              <span>System Alerts</span>
              {unreadAlertsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-ember-500 text-white">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {canManageBroadcasts && (
              <button
                onClick={() => setActiveTab("broadcasts")}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
                  activeTab === "broadcasts"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-pitch-900 dark:text-volt-400"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Radio size={14} />
                <span>Sent Broadcasts</span>
              </button>
            )}
          </div>

          {activeTab === "broadcasts" && franchiseId && (
            <Button
              icon={<Plus size={16} />}
              onClick={() => setShowCompose(true)}
              className="bg-volt-400 hover:bg-volt-300 text-pitch-900 font-bold"
            >
              Compose
            </Button>
          )}
        </div>
      </div>

      {/* TAB 1: SYSTEM ALERTS */}
      {activeTab === "system" && (
        <div className="space-y-4">
          {/* Action Bar (Filters + Mark all read) */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-pitch-900/60 p-3 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-400 ml-1" />
              <button
                onClick={() => setFilterUnreadOnly(false)}
                className={clsx(
                  "px-2.5 py-1 text-xs rounded font-medium transition-colors",
                  !filterUnreadOnly
                    ? "bg-slate-200 text-slate-800 dark:bg-white/10 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                All ({rawItems.length})
              </button>
              <button
                onClick={() => setFilterUnreadOnly(true)}
                className={clsx(
                  "px-2.5 py-1 text-xs rounded font-medium transition-colors flex items-center gap-1.5",
                  filterUnreadOnly
                    ? "bg-volt-400/20 text-volt-600 dark:text-volt-400 border border-volt-400/30"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                <span>Unread</span>
                {unreadAlertsCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-ember-500" />
                )}
              </button>
            </div>

            {unreadAlertsCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={<CheckCheck size={14} />}
                onClick={handleMarkAllRead}
                loading={isMarkingAllRead}
                className="text-xs text-volt-600 dark:text-volt-400 hover:text-volt-700 dark:hover:text-volt-300"
              >
                Mark all as read
              </Button>
            )}
          </div>

          {/* Loading Skeletons */}
          {isMyAlertsLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          )}

          {/* Error State */}
          {isMyAlertsError && (
            <EmptyState
              icon={<AlertCircle size={28} className="text-ember-400" />}
              title="Couldn't load system alerts"
              description="Please check your connection or try again."
              action={
                <Button size="sm" onClick={() => refetchMyAlerts()}>
                  Retry
                </Button>
              }
            />
          )}

          {/* Empty State */}
          {!isMyAlertsLoading && systemAlerts.length === 0 && (
            <EmptyState
              icon={<Bell size={28} />}
              title={
                filterUnreadOnly
                  ? "No unread alerts"
                  : "You're completely up to date"
              }
              description={
                filterUnreadOnly
                  ? "All your notifications have been marked as read."
                  : "Any session updates, complaint responses, registration requests, or system events will appear here in real-time."
              }
              action={
                filterUnreadOnly ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setFilterUnreadOnly(false)}
                  >
                    Show all alerts
                  </Button>
                ) : undefined
              }
            />
          )}

          {/* Alerts Feed */}
          <div className="space-y-3">
            {systemAlerts.map((alert) => {
              const meta = getTypeMeta(alert.type);
              const Icon = meta.icon;

              return (
                <div
                  key={alert.id}
                  onClick={() => handleMarkOneRead(alert.id, alert.isRead)}
                  className={clsx(
                    "group relative p-4 sm:p-5 rounded-xl border transition-all duration-200 cursor-pointer",
                    !alert.isRead
                      ? "bg-white dark:bg-pitch-800/90 border-slate-300 dark:border-volt-400/30 shadow-sm hover:border-volt-400"
                      : "bg-slate-50/70 dark:bg-pitch-900/40 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10"
                  )}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Icon Bubble */}
                    <div
                      className={clsx(
                        "w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 mt-0.5",
                        meta.color
                      )}
                    >
                      <Icon size={18} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="flex items-center gap-2">
                          <h3
                            className={clsx(
                              "font-display text-sm font-semibold truncate",
                              !alert.isRead
                                ? "text-slate-900 dark:text-white"
                                : "text-slate-700 dark:text-slate-300"
                            )}
                          >
                            {alert.title}
                          </h3>
                          {!alert.isRead && (
                            <span className="inline-block w-2 h-2 rounded-full bg-volt-400 shrink-0" />
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant={meta.variant} size="sm">
                            {meta.label}
                          </Badge>
                          <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-500 font-mono">
                            <Clock size={11} />
                            {new Date(alert.createdAt).toLocaleString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                        {alert.body}
                      </p>
                    </div>

                    {/* Mark as read button */}
                    {!alert.isRead && (
                      <button
                        title="Mark as read"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkOneRead(alert.id, false);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-400 hover:text-volt-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-opacity"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: SENT BROADCASTS */}
      {activeTab === "broadcasts" && (
        <div className="space-y-4">
          {!franchiseId ? (
            <Card className="p-8 text-center border-dashed">
              <Layers size={32} className="mx-auto text-slate-400 mb-3" />
              <h3 className="font-display font-semibold text-slate-900 dark:text-white">
                Branch / Franchise Selection Needed
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Broadcast announcements are scoped to an academy branch. Please
                select a specific franchise from the switcher in the top bar to
                view or send announcements.
              </p>
            </Card>
          ) : (
            <>
              {isBroadcastsLoading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-xl" />
                  ))}
                </div>
              )}

              {isBroadcastsError && (
                <EmptyState
                  title="Couldn't load announcements"
                  description="Please try again shortly."
                />
              )}

              {broadcastsData && broadcastsData.items.length === 0 && (
                <EmptyState
                  icon={<Radio size={28} />}
                  title="No broadcast announcements sent yet"
                  description="Compose updates to parents, players, or coaches via WhatsApp, SMS, Push, and Email."
                  action={
                    <Button onClick={() => setShowCompose(true)}>
                      Compose Announcement
                    </Button>
                  }
                />
              )}

              <div className="space-y-3">
                {(broadcastsData?.items ?? []).map((n) => (
                  <Card key={n.id} className="p-5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-display font-semibold text-slate-900 dark:text-white">
                        {n.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        {n.channels &&
                          n.channels.map((ch) => {
                            const meta = CHANNEL_META[ch];
                            const Icon = meta?.icon;
                            return (
                              <span
                                key={ch}
                                className={clsx(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border",
                                  meta?.color || "bg-slate-100 text-slate-600 border-slate-200"
                                )}
                              >
                                {Icon && <Icon size={10} />}
                                {ch}
                              </span>
                            );
                          })}
                        <Badge variant="blue">
                          {AUDIENCE_LABEL[n.audience] || n.audience}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      {n.body}
                    </p>
                    {n.imageUrl && (
                      <img
                        src={n.imageUrl}
                        alt=""
                        className="mt-3 max-h-48 rounded-lg border border-slate-200 dark:border-white/10 object-cover"
                      />
                    )}

                    {/* Render Multiple Attachments */}
                    {n.attachments && n.attachments.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {n.attachments.map((at, idx) => (
                          <a
                            key={idx}
                            href={at.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-volt-600 dark:text-volt-400 hover:underline bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 px-2.5 py-1 rounded-md"
                          >
                            <FileText size={12} /> {at.name}
                          </a>
                        ))}
                      </div>
                    ) : n.documentUrl ? (
                      <a
                        href={n.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs text-volt-600 dark:text-volt-400 hover:underline"
                      >
                        <FileText size={13} />{" "}
                        {n.documentFilename ?? "Attached document"}
                      </a>
                    ) : null}

                    <p className="text-xs text-slate-500 font-mono mt-3">
                      {new Date(n.createdAt).toLocaleString()} ·{" "}
                      {n.readBy.length} read
                    </p>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Compose Announcement Modal */}
      {franchiseId && (
        <ComposeModal
          isOpen={showCompose}
          onClose={() => setShowCompose(false)}
          franchiseId={franchiseId}
        />
      )}
    </div>
  );
};

const ComposeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  franchiseId: string;
}> = ({ isOpen, onClose, franchiseId }) => {
  const [createNotification, { isLoading }] = useCreateNotificationMutation();
  const { data: teams } = useListTeamsQuery(
    { franchiseId },
    { skip: !franchiseId }
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] =
    useState<AdminNotification["audience"]>("franchise");
  const [teamId, setTeamId] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [channels, setChannels] = useState<string[]>(["push", "whatsapp"]);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>(
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;
    if (audience === "team" && !teamId) {
      toast.error("Select a team");
      return;
    }
    if (channels.length === 0) {
      toast.error("Select at least one communication channel");
      return;
    }
    try {
      await createNotification({
        franchiseId,
        title,
        body,
        audience,
        teamId: audience === "team" ? teamId : undefined,
        imageUrl,
        documentUrl: attachments[0]?.url,
        documentFilename: attachments[0]?.name,
        attachments,
        channels,
      }).unwrap();
      toast.success("Notification sent");
      onClose();
      setTitle("");
      setBody("");
      setImageUrl(undefined);
      setChannels(["push", "whatsapp"]);
      setAttachments([]);
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't send notification — try again");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose announcement"
      size="lg"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 no-scrollbar"
      >
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <div className="space-y-1.5">
          <label className="label">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="input resize-none text-xs"
            placeholder="Write announcement details..."
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="label font-bold text-slate-700 dark:text-slate-400">
            Communication Channels (Select all that apply)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(["push", "whatsapp", "email"] as const).map((ch) => {
              const meta = CHANNEL_META[ch];
              const Icon = meta?.icon || Bell;
              const isSelected = channels.includes(ch);
              return (
                <button
                  type="button"
                  key={ch}
                  onClick={() => {
                    if (isSelected) {
                      setChannels(channels.filter((c) => c !== ch));
                    } else {
                      setChannels([...channels, ch]);
                    }
                  }}
                  className={clsx(
                    "flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-semibold transition-all text-left",
                    isSelected
                      ? "bg-volt-400/10 border-volt-400/40 text-slate-900 dark:text-white ring-1 ring-volt-400/30"
                      : "bg-slate-50 dark:bg-pitch-900/60 border-slate-200 dark:border-white/5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <div
                    className={clsx(
                      "w-4 h-4 rounded flex items-center justify-center border text-xs transition-colors shrink-0",
                      isSelected
                        ? "bg-volt-400 border-volt-400 text-pitch-950 font-bold"
                        : "border-slate-300 dark:border-white/20 bg-white dark:bg-pitch-950"
                    )}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                  <Icon size={14} className={isSelected ? "text-volt-500 dark:text-volt-400 shrink-0" : "text-slate-400 shrink-0"} />
                  <span className="capitalize truncate">{meta?.label || ch}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="label">Target Audience</label>
          <select
            value={audience}
            onChange={(e) =>
              setAudience(e.target.value as AdminNotification["audience"])
            }
            className="input text-xs"
          >
            <option value="franchise">
              Entire Franchise (Guardians + Players + Coaches + Managers)
            </option>
            <option value="academy">
              Entire Academy (All Sibling Franchises)
            </option>
            <option value="players">Players Only</option>
            <option value="guardians">Guardians Only</option>
            <option value="coaches">Coaches Only</option>
            <option value="managers">Managers Only</option>
            <option value="team">One specific team roster</option>
          </select>
        </div>

        {audience === "team" && (
          <div className="space-y-1.5">
            <label className="label">Team</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="input text-xs"
              required
            >
              <option value="" disabled>
                Select a team
              </option>
              {(teams ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.ageGroup})
                </option>
              ))}
            </select>
          </div>
        )}

        <ImageUploadField
          label="Banner Image (optional)"
          category="notification_image"
          value={imageUrl}
          onChange={setImageUrl}
          shape="wide"
          helperText="Shown in-app and sent as part of the WhatsApp message."
        />

        <div className="space-y-2">
          <label className="label">Documents & Attachments (Optional)</label>
          <DocumentUploadField
            label="Add attachment (PDF/Word)"
            category="notification_document"
            onChange={(file) => {
              if (file) {
                setAttachments([
                  ...attachments,
                  {
                    name: file.filename || "Attachment File",
                    url: file.url,
                  },
                ]);
              }
            }}
          />
          {attachments.length > 0 && (
            <div className="space-y-1.5 mt-2 bg-slate-50 dark:bg-pitch-900/50 p-2 border border-slate-200 dark:border-white/5 rounded-lg max-h-24 overflow-y-auto">
              {attachments.map((at, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-2xs text-slate-700 dark:text-slate-300"
                >
                  <span className="truncate max-w-[80%] font-mono">
                    {at.name}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments(attachments.filter((_, i) => i !== idx))
                    }
                    className="text-slate-400 hover:text-ember-500 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          type="submit"
          loading={isLoading}
          className="w-full bg-volt-400 hover:bg-volt-300 text-pitch-900 font-bold uppercase py-2.5"
        >
          Broadcast Announcement
        </Button>
      </form>
    </Modal>
  );
};

export default NotificationsPage;
