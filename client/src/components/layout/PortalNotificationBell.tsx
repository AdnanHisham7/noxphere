import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { Bell, FileText, Download, Check } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";
import { RootState } from "../../store";
import {
  setNotifications,
  markOneRead,
  markAllRead,
} from "../../store/slices/notificationSlice";
import {
  useGetMyNotificationsQuery,
  useMarkMyNotificationReadMutation,
  useMarkAllMyNotificationsReadMutation,
  type MyNotification,
} from "../../store/api/myNotificationsApi";
import { getNotificationTarget } from "../../utils/notificationRouter";

// Guardians and students notification bell with navigation and mark-as-read
export const PortalNotificationBell: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((s: RootState) => s.auth);
  const { unreadCount, items: notifications } = useSelector(
    (s: RootState) => s.notifications,
  );
  const [open, setOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  useClickOutside(notifRef, () => setOpen(false), open);

  const { data } = useGetMyNotificationsQuery(
    { limit: 20 },
    { skip: !isAuthenticated },
  );
  useEffect(() => {
    if (data) dispatch(setNotifications(data.items));
  }, [data, dispatch]);

  const [markOneReadOnServer] = useMarkMyNotificationReadMutation();
  const [markAllReadOnServer] = useMarkAllMyNotificationsReadMutation();

  const handleNotificationClick = (n: MyNotification) => {
    if (!n.isRead) {
      dispatch(markOneRead(n.id));
      markOneReadOnServer(n.id).catch(() => undefined);
    }
    setOpen(false);

    const target = getNotificationTarget(n, user?.role);
    if (target?.url) {
      if (target.url.startsWith("http")) {
        window.open(target.url, "_blank");
      } else {
        navigate(target.url);
      }
    }
  };

  const handleMarkOneReadExplicit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(markOneRead(id));
    markOneReadOnServer(id).catch(() => undefined);
  };

  const handleMarkAllRead = () => {
    dispatch(markAllRead());
    markAllReadOnServer().catch(() => undefined);
  };

  return (
    <div className="relative" ref={notifRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-nox-mid hover:text-slate-900 dark:hover:text-nox-high hover:bg-slate-200/70 dark:hover:bg-white/[0.08] transition-colors"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-orbit-cta rounded-full text-[10px] text-white font-bold flex items-center justify-center shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-11 sm:w-80 max-w-sm bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/60 dark:bg-transparent shrink-0">
              <span className="text-xs font-mono uppercase tracking-wide text-slate-500 dark:text-nox-low font-semibold">
                Alerts
              </span>
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-core-600 dark:text-core-400 hover:underline"
              >
                Mark all read
              </button>
            </div>
            <div className="overflow-y-auto min-h-0 flex-1 divide-y divide-slate-100 dark:divide-white/[0.04] custom-scrollbar">
              {notifications.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-nox-low text-sm py-8">
                  No notifications
                </p>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer group flex items-start justify-between gap-3 ${
                      !n.isRead
                        ? "bg-core-400/[0.08] dark:bg-core-400/[0.06]"
                        : "bg-white dark:bg-transparent"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-nox-high">
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-nox-low mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      {n.data?.imageUrl && (
                        <img
                          src={n.data.imageUrl}
                          alt=""
                          className="mt-1.5 max-h-24 w-full rounded object-cover border border-slate-200 dark:border-white/10"
                        />
                      )}
                      {/* Attachments */}
                      {(() => {
                        let atts: { name: string; url: string }[] = [];
                        if (Array.isArray(n.data?.attachments)) {
                          atts = [...n.data.attachments];
                        } else if (typeof n.data?.attachments === "string") {
                          try {
                            const p = JSON.parse(n.data.attachments);
                            if (Array.isArray(p)) atts = [...p];
                          } catch {}
                        }
                        if (atts.length === 0 && n.data?.documentUrl) {
                          atts.push({
                            name:
                              (n.data.documentFilename as string) ||
                              "Attached Document",
                            url: n.data.documentUrl as string,
                          });
                        }
                        if (atts.length === 0) return null;
                        return (
                          <div
                            className="mt-1.5 flex flex-wrap gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {atts.map((at, idx) => (
                              <a
                                key={idx}
                                href={at.url}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className="inline-flex items-center gap-1 text-[11px] text-core-500 dark:text-core-400 bg-core-400/10 border border-core-400/20 px-2 py-0.5 rounded font-medium hover:underline"
                              >
                                <Download size={11} />
                                <span className="truncate max-w-[140px]">
                                  {at.name}
                                </span>
                              </a>
                            ))}
                          </div>
                        );
                      })()}
                      <p className="text-[10px] text-slate-400 dark:text-nox-low/70 font-mono mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Separate Tick Button to mark as read without navigating */}
                    {!n.isRead && (
                      <button
                        type="button"
                        title="Mark as read"
                        aria-label="Mark as read"
                        onClick={(e) => handleMarkOneReadExplicit(n.id, e)}
                        className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] text-slate-400 hover:text-core-500 dark:hover:text-core-400 hover:border-core-400/30 hover:bg-core-400/10 transition-all cursor-pointer shadow-2xs mt-0.5"
                      >
                        <Check size={13} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="p-2.5 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] text-center">
              <Link
                to={user?.role === "guardian" ? "/guardian/alerts" : "/notifications"}
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-core-500 hover:text-core-400 dark:text-core-400 inline-flex items-center gap-1"
              >
                View all alerts →
              </Link>
            </div>
          </div>
      )}
    </div>
  );
};
