// src/components/layout/PortalNotificationBell.tsx
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Bell, FileText, Download } from "lucide-react";
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
} from "../../store/api/myNotificationsApi";

// Guardians and students never had a bell at all — PortalLayout has no
// equivalent of the admin TopBar's notification dropdown, so this is new,
// not a fix to something broken. Reuses the same /notifications/me feed
// and Redux slice as the admin-side bell so both surfaces agree on what
// counts as read.
export const PortalNotificationBell: React.FC = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((s: RootState) => s.auth);
  const { unreadCount, items: notifications } = useSelector(
    (s: RootState) => s.notifications,
  );
  const [open, setOpen] = useState(false);

  const { data } = useGetMyNotificationsQuery(
    { limit: 20 },
    { skip: !isAuthenticated },
  );
  useEffect(() => {
    if (data) dispatch(setNotifications(data.items));
  }, [data, dispatch]);

  const [markOneReadOnServer] = useMarkMyNotificationReadMutation();
  const [markAllReadOnServer] = useMarkAllMyNotificationsReadMutation();

  const handleOpenNotification = (id: string, isRead: boolean) => {
    if (isRead) return;
    dispatch(markOneRead(id));
    markOneReadOnServer(id).catch(() => undefined);
  };

  const handleMarkAllRead = () => {
    dispatch(markAllRead());
    markAllReadOnServer().catch(() => undefined);
  };

  return (
    <div className="relative">
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
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 w-80 max-w-[90vw] bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/60 dark:bg-transparent">
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
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.04]">
              {notifications.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-nox-low text-sm py-8">
                  No notifications
                </p>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleOpenNotification(n.id, n.isRead)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] ${
                      !n.isRead
                        ? "bg-core-400/[0.08] dark:bg-core-400/[0.06]"
                        : "bg-white dark:bg-transparent"
                    }`}
                  >
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
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
