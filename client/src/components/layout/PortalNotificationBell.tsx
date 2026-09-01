// src/components/layout/PortalNotificationBell.tsx
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Bell } from "lucide-react";
import { RootState } from "../../store";
import { setNotifications, markOneRead, markAllRead } from "../../store/slices/notificationSlice";
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
  const { unreadCount, items: notifications } = useSelector((s: RootState) => s.notifications);
  const [open, setOpen] = useState(false);

  const { data } = useGetMyNotificationsQuery({ limit: 20 }, { skip: !isAuthenticated });
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
        className="relative w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.08] text-nox-mid hover:text-nox-high transition-colors"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-orbit-cta rounded-full text-[10px] text-white font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 w-80 max-w-[90vw] bg-ink-900 border border-white/[0.08] rounded-xl shadow-xl z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-xs font-mono uppercase tracking-wide text-nox-low">Alerts</span>
              <button onClick={handleMarkAllRead} className="text-[11px] text-core-400 hover:underline">
                Mark all read
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center text-nox-low text-sm py-8">No notifications</p>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleOpenNotification(n.id, n.isRead)}
                    className={`w-full text-left px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] ${
                      !n.isRead ? "bg-core-400/[0.06]" : ""
                    }`}
                  >
                    <p className="text-xs font-semibold text-nox-high">{n.title}</p>
                    <p className="text-xs text-nox-low mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-nox-low/70 font-mono mt-1">
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