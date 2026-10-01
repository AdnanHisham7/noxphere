// src/features/guardian/GuardianAlertsPage.tsx
import React, { useState } from "react";
import {
  Bell,
  CheckCheck,
  Check,
  Calendar,
  AlertCircle,
  FileText,
  Download,
  Clock,
  Radio,
  Filter,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  useGetMyNotificationsQuery,
  useMarkMyNotificationReadMutation,
  useMarkAllMyNotificationsReadMutation,
  type MyNotification,
} from "../../store/api/myNotificationsApi";
import {
  NoxPageHeader,
  NoxEmptyState,
  NoxSkeleton,
} from "../../components/portal-ui";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "announcement":
    case "broadcast":
      return <Radio size={18} className="text-core-400" />;
    case "schedule_update":
    case "session_cancelled":
    case "session_reminder":
      return <Calendar size={18} className="text-ion-400" />;
    case "payment_received":
    case "fee_due":
      return <FileText size={18} className="text-plasma-400" />;
    default:
      return <Bell size={18} className="text-core-400" />;
  }
};

const GuardianAlertsPage: React.FC = () => {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { data, isLoading, isError, refetch } = useGetMyNotificationsQuery({
    limit: 50,
  });
  const [markOneRead, { isLoading: markingOne }] =
    useMarkMyNotificationReadMutation();
  const [markAllRead, { isLoading: markingAll }] =
    useMarkAllMyNotificationsReadMutation();

  const notifications = data?.items || [];
  const unreadCount = data?.unreadCount || 0;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    return true;
  });

  const handleMarkAllRead = async () => {
    try {
      await markAllRead().unwrap();
      toast.success("All alerts marked as read");
      refetch();
    } catch {
      toast.error("Couldn't mark all as read");
    }
  };

  const handleMarkOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markOneRead(id).unwrap();
    } catch {
      // silent
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <NoxPageHeader
          eyebrow="Guardian portal"
          title="Academy Alerts & Updates"
          subtitle="Official announcements, session alerts, and notifications regarding your children."
        />
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-core-400/10 hover:bg-core-400/20 text-core-400 border border-core-400/30 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <CheckCheck size={14} />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === "all"
              ? "bg-core-400/15 text-core-400 border border-core-400/30"
              : "bg-white/[0.04] text-nox-mid hover:text-nox-high border border-white/5"
          }`}
        >
          All Alerts ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            filter === "unread"
              ? "bg-core-400/15 text-core-400 border border-core-400/30"
              : "bg-white/[0.04] text-nox-mid hover:text-nox-high border border-white/5"
          }`}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-orbit-cta text-black font-extrabold shadow-xs">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <NoxSkeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <NoxEmptyState
          title="Couldn't load alerts"
          body="There was an error retrieving notifications. Please refresh or try again later."
          icon={<AlertCircle size={28} />}
        />
      )}

      {/* Empty list */}
      {!isLoading && !isError && filteredNotifications.length === 0 && (
        <NoxEmptyState
          title={filter === "unread" ? "No unread alerts" : "No alerts yet"}
          body={
            filter === "unread"
              ? "You're all caught up! There are no unread notifications right now."
              : "When your academy manager sends announcements, session changes, or fee notices, they will appear here."
          }
          icon={<Bell size={28} />}
        />
      )}

      {/* Notifications list */}
      {!isLoading && !isError && filteredNotifications.length > 0 && (
        <div className="space-y-3">
          {filteredNotifications.map((n) => {
            const attachments: { name: string; url: string }[] = (() => {
              if (!n.data?.attachments) return [];
              if (Array.isArray(n.data.attachments)) return n.data.attachments;
              if (typeof n.data.attachments === "string") {
                try {
                  const parsed = JSON.parse(n.data.attachments);
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              }
              return [];
            })();

            return (
              <div
                key={n.id}
                className={`nox-card p-5 transition-all ${
                  !n.isRead
                    ? "border-core-400/40 bg-core-400/[0.03] shadow-sm"
                    : "hover:border-white/10"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center shrink-0 mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-orbital text-sm font-semibold text-nox-high">
                          {n.title}
                        </h3>
                        {!n.isRead && (
                          <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-mono uppercase font-bold tracking-wider bg-core-400/15 text-core-400 border border-core-400/30">
                            New
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-nox-low flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(n.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {!n.isRead && (
                          <button
                            onClick={(e) => handleMarkOne(n.id, e)}
                            title="Mark as read"
                            className="p-1 rounded text-nox-low hover:text-core-400 hover:bg-white/[0.05] transition-colors"
                          >
                            <Check size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-nox-mid leading-relaxed whitespace-pre-wrap">
                      {n.body}
                    </p>

                    {/* Image preview if provided */}
                    {n.data?.imageUrl && (
                      <div className="mt-3">
                        <img
                          src={n.data.imageUrl}
                          alt="Attachment preview"
                          className="max-h-60 rounded-xl border border-white/10 object-cover shadow-sm"
                        />
                      </div>
                    )}

                    {/* Attachments */}
                    {attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-white/5">
                        {attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="inline-flex items-center gap-1.5 text-xs text-core-400 bg-core-400/10 border border-core-400/20 px-3 py-1.5 rounded-lg hover:bg-core-400/20 font-medium transition-colors"
                          >
                            <Download size={13} />
                            <span className="truncate max-w-[200px]">
                              {att.name}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GuardianAlertsPage;
