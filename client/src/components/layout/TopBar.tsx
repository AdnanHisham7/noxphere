// src/components/layout/TopBar.tsx
import { useSelector, useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { markAllRead } from "@/store/slices/notificationSlice";
import { Avatar } from "@/components/ui";
import { useState } from "react";
import clsx from "clsx";
import { RootState } from "@/store";

export const TopBar: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((s: RootState) => s.auth);
  const { unreadCount, items: notifications } = useSelector(
    (s: RootState) => s.notifications,
  );
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="h-16 bg-pitch-900/80 backdrop-blur-sm border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left: Camp selector / breadcrumb */}
      <div className="flex items-center gap-4">
         
      </div>

      {/* Right: Notifications + Profile */}
      <div className="flex items-center gap-3">

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-9 h-9 flex items-center justify-center rounded bg-pitch-800 border border-white/10 text-slate-400 hover:text-white hover:border-white/15 transition-colors"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-ember-500 rounded-full text-2xs text-white font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-12 w-80 card shadow-panel z-50 animate-slide-up">
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <span className="section-title">Alerts</span>
                <button
                  onClick={() => dispatch(markAllRead())}
                  className="text-2xs text-volt-400 hover:underline"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-8">
                    No notifications
                  </p>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      className={clsx(
                        "p-4 border-b border-white/4 hover:bg-white/3",
                        !n.isRead && "bg-volt-400/4",
                      )}
                    >
                      <p className="text-xs font-semibold text-white">
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-2xs text-slate-600 mt-1">
                        {n.createdAt}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 border-t border-white/5">
                <Link
                  to="/notifications"
                  className="block text-center text-xs text-volt-400 hover:underline"
                  onClick={() => setNotifOpen(false)}
                >
                  View all alerts
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <Avatar
          name={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`}
          src={user?.avatar}
          size="sm"
        />
      </div>
    </header>
  );
};
