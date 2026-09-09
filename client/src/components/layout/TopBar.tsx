import { useSelector, useDispatch } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { Building2, ChevronDown, Check, Bell, Repeat2, Menu } from "lucide-react";
import logoSrc from "../../assets/logo.png";
import {
  setNotifications,
  markOneRead,
  markAllRead,
} from "../../store/slices/notificationSlice";
import {
  setActiveFranchise,
  clearActiveFranchise,
  toggleMobileSidebar,
} from "../../store/slices/uiSlice";
import { Avatar } from "../ui";
import { useState, useEffect } from "react";
import clsx from "clsx";
import { RootState } from "../../store";
import { useCurrentFranchiseId, isNoFranchiseSwitchPage } from "../../hooks/useCurrentFranchiseId";
import {
  useGetFranchiseByIdQuery,
  useGetFranchisesQuery,
} from "../../store/api/franchiseApi";
import { useGetMyFranchisesQuery } from "../../store/api/coachPortalApi";
import { useTransferWallEnabled } from "../../hooks/useTransferWallEnabled";
import { ThemeToggle } from "../common/ThemeToggle";
import {
  useGetMyNotificationsQuery,
  useMarkMyNotificationReadMutation,
  useMarkAllMyNotificationsReadMutation,
} from "../../store/api/myNotificationsApi";

const FranchiseSwitcher: React.FC = () => {
  const dispatch = useDispatch();
  const currentFranchiseId = useCurrentFranchiseId();
  const [open, setOpen] = useState(false);
  const { user } = useSelector((s: RootState) => s.auth);
  const isFranchiseManager = user?.role === "manager" && !!user?.franchiseId;

  // Resolve the current franchise's academy, then list sibling franchises
  // under that same academy so a manager/coach can switch between them.
  const { data: currentFranchise } = useGetFranchiseByIdQuery(
    currentFranchiseId ?? "",
    {
      skip: !currentFranchiseId,
    },
  );

  const activeAcademyId = user?.academyId || currentFranchise?.academyId;

  const { data: franchises } = useGetFranchisesQuery(
    activeAcademyId
      ? { academyId: activeAcademyId, isActive: true }
      : undefined,
    { skip: !activeAcademyId || isFranchiseManager },
  );

  useEffect(() => {
    if (isFranchiseManager || !franchises || franchises.length === 0) return;
    if (!currentFranchiseId) {
      // Auto-select the first franchise on pages requiring a franchise instead of remaining on Academy Overview
      dispatch(setActiveFranchise(franchises[0].id));
      return;
    }
    const stillValid = franchises.some((f) => f.id === currentFranchiseId);
    if (!stillValid) {
      dispatch(setActiveFranchise(franchises[0].id));
    }
  }, [franchises, currentFranchiseId, isFranchiseManager, dispatch]);

  if (isFranchiseManager) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 border border-slate-200 text-slate-700 dark:bg-pitch-800 dark:border-white/10 dark:text-slate-300 rounded px-2.5 sm:px-3 py-1.5 max-w-[130px] sm:max-w-xs">
        <Building2 size={13} className="text-volt-600 dark:text-volt-400 shrink-0" />
        <span className="text-xs font-medium truncate">
          {currentFranchise?.name ?? "Loading…"}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 border border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-pitch-800 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20 rounded px-2.5 sm:px-3 py-1.5 transition-colors max-w-[140px] sm:max-w-xs"
      >
        <Building2 size={13} className="text-volt-600 dark:text-volt-400 shrink-0" />
        <span className="text-xs font-medium truncate">
          {currentFranchiseId
            ? (currentFranchise?.name ?? "Loading…")
            : "Academy Overview"}
        </span>
        <ChevronDown size={12} className="text-slate-500 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-11 w-64 card shadow-panel z-50 animate-slide-up py-1.5">
            <p className="px-3 py-1.5 section-title">Switch franchise</p>

            <button
              onClick={() => {
                dispatch(clearActiveFranchise());
                setOpen(false);
              }}
              className={clsx(
                "w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/4 transition-colors",
                !currentFranchiseId
                  ? "text-volt-600 dark:text-volt-400 font-semibold"
                  : "text-slate-700 dark:text-slate-300",
              )}
            >
              <span>Academy Overview</span>
              {!currentFranchiseId && <Check size={13} />}
            </button>

            {franchises &&
              franchises.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    dispatch(setActiveFranchise(f.id));
                    setOpen(false);
                  }}
                  className={clsx(
                    "w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/4 transition-colors",
                    f.id === currentFranchiseId
                      ? "text-volt-600 dark:text-volt-400 font-semibold"
                      : "text-slate-700 dark:text-slate-300",
                  )}
                >
                  <span className="truncate">{f.name}</span>
                  {f.id === currentFranchiseId && <Check size={13} />}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
};

// A coach can now operate in any franchise of their academy where they
// have an assigned team or session — this list comes straight from
// /coach/franchises, so it can never show (or let them switch into) a
// franchise they don't actually have anything in. If nothing is active
// yet (fresh login, or a stale selection from a franchise they've since
// lost access to), the first result is auto-selected.
const CoachFranchiseSwitcher: React.FC = () => {
  const dispatch = useDispatch();
  const currentFranchiseId = useCurrentFranchiseId();
  const [open, setOpen] = useState(false);
  const { data: franchises } = useGetMyFranchisesQuery();

  useEffect(() => {
    if (!franchises || franchises.length === 0) return;
    const stillValid = franchises.some((f) => f.id === currentFranchiseId);
    if (!stillValid) {
      dispatch(setActiveFranchise(franchises[0].id));
    }
  }, [franchises, currentFranchiseId, dispatch]);

  const currentFranchise = franchises?.find((f) => f.id === currentFranchiseId);

  if (!franchises || franchises.length === 0) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 border border-slate-200 text-slate-700 dark:bg-pitch-800 dark:border-white/10 dark:text-slate-300 rounded px-2.5 sm:px-3 py-1.5">
        <Building2 size={13} className="text-volt-600 dark:text-volt-400 shrink-0" />
        <span className="text-xs text-slate-500 font-medium truncate max-w-[120px] sm:max-w-none">
          No franchise assigned yet
        </span>
      </div>
    );
  }

  if (franchises.length === 1) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 border border-slate-200 text-slate-700 dark:bg-pitch-800 dark:border-white/10 dark:text-slate-300 rounded px-2.5 sm:px-3 py-1.5">
        <Building2 size={13} className="text-volt-600 dark:text-volt-400 shrink-0" />
        <span className="text-xs font-medium max-w-[120px] sm:max-w-40 truncate">
          {franchises[0].name}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 border border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-pitch-800 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20 rounded px-2.5 sm:px-3 py-1.5 transition-colors"
      >
        <Building2 size={13} className="text-volt-600 dark:text-volt-400 shrink-0" />
        <span className="text-xs font-medium max-w-[120px] sm:max-w-40 truncate">
          {currentFranchise?.name ?? "Loading…"}
        </span>
        <ChevronDown size={12} className="text-slate-500 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-11 w-64 max-w-[85vw] card shadow-panel z-50 animate-slide-up py-1.5">
            <p className="px-3 py-1.5 section-title">Switch franchise</p>
            {franchises.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  dispatch(setActiveFranchise(f.id));
                  setOpen(false);
                }}
                className={clsx(
                  "w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/4 transition-colors",
                  f.id === currentFranchiseId
                    ? "text-volt-600 dark:text-volt-400 font-semibold"
                    : "text-slate-700 dark:text-slate-300",
                )}
              >
                <span className="truncate">{f.name}</span>
                {f.id === currentFranchiseId && <Check size={13} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const TopBar: React.FC = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const { unreadCount, items: notifications } = useSelector(
    (s: RootState) => s.notifications,
  );
  const currentFranchiseId = useCurrentFranchiseId();
  const [notifOpen, setNotifOpen] = useState(false);
  const transferWallEnabled = useTransferWallEnabled();
  const showTransferWallLink = user?.role === "manager" && transferWallEnabled;

  const isAcademyOwner = user?.role === "manager" && !user?.franchiseId;
  const hideFranchiseSwitcher = isNoFranchiseSwitchPage(location.pathname);

  // If a page doesn't need franchise switching, automatically set the franchise
  // to Academy Overview (null activeFranchiseId) for academy owners.
  useEffect(() => {
    if (!isAcademyOwner) return;
    if (hideFranchiseSwitcher && currentFranchiseId !== null) {
      dispatch(clearActiveFranchise());
    }
  }, [location.pathname, hideFranchiseSwitcher, isAcademyOwner, currentFranchiseId, dispatch]);

  // Close notifications dropdown on navigation
  useEffect(() => {
    setNotifOpen(false);
  }, [location.pathname]);

  // Hydrate the bell from the server on load/login — previously this only
  // ever reflected whatever arrived over a live socket connection during
  // the current tab, so it always started empty on refresh.
  const { data: myNotifications } = useGetMyNotificationsQuery(
    { limit: 20 },
    { skip: !isAuthenticated },
  );
  useEffect(() => {
    if (myNotifications) dispatch(setNotifications(myNotifications.items));
  }, [myNotifications, dispatch]);

  const [markOneReadOnServer] = useMarkMyNotificationReadMutation();
  const [markAllReadOnServer] = useMarkAllMyNotificationsReadMutation();

  const handleOpenNotification = (id: string, isRead: boolean) => {
    if (!isRead) {
      dispatch(markOneRead(id));
      markOneReadOnServer(id).catch(() => undefined);
    }
    setNotifOpen(false);
  };

  const handleMarkAllRead = () => {
    dispatch(markAllRead());
    markAllReadOnServer().catch(() => undefined);
  };

  return (
    <header className="h-16 bg-white/90 dark:bg-pitch-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-3.5 sm:px-6 sticky top-0 z-30 transition-colors duration-200">
      {/* Left: Mobile hamburger menu + Mobile logo + Franchise selector / breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          type="button"
          onClick={() => dispatch(toggleMobileSidebar())}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-pitch-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white shrink-0 transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <Menu size={18} />
        </button>

        <Link to="/" className="md:hidden flex items-center shrink-0">
          <img src={logoSrc} alt="Noxphere" className="h-7 w-auto object-contain" />
        </Link>

        {user?.role === "coach" ? (
          <CoachFranchiseSwitcher />
        ) : (
          user?.role !== "super_admin" &&
          !hideFranchiseSwitcher && <FranchiseSwitcher />
        )}
      </div>

      {/* Right: Theme Toggle + Notifications + Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Transfer Wall quick link — manager only, and only while the
            academy hasn't disabled it */}
        {showTransferWallLink && (
          <Link
            to="/transfer-wall"
            className="hidden md:flex items-center gap-1.5 text-xs text-ice-600 dark:text-ice-400 border border-ice-400/30 dark:border-ice-400/20 rounded px-3 py-1.5 hover:bg-ice-400/10 transition-colors"
          >
            <Repeat2 size={13} />
            <span className="uppercase tracking-wide font-semibold">
              Transfer Wall
            </span>
          </Link>
        )}

        {/* Theme Mode Switch */}
        <ThemeToggle size="md" />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-9 h-9 flex items-center justify-center rounded bg-slate-100 dark:bg-pitch-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/15 transition-colors"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-ember-500 rounded-full text-2xs text-white font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setNotifOpen(false)}
              />
              <div className="absolute right-0 top-12 w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm card shadow-panel z-50 animate-slide-up">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/5">
                  <span className="section-title">Alerts</span>
                  <button
                    onClick={handleMarkAllRead}
                    className="text-2xs text-volt-500 dark:text-volt-400 hover:underline"
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
                      <button
                        key={n.id}
                        onClick={() => handleOpenNotification(n.id, n.isRead)}
                        className={clsx(
                          "w-full text-left p-4 border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5",
                          !n.isRead && "bg-volt-400/10",
                        )}
                      >
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {n.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-2xs text-slate-400 dark:text-slate-600 mt-1">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </button>
                    ))
                  )}
                </div>
                <div className="p-3 border-t border-slate-200 dark:border-white/5">
                  <Link
                    to="/notifications"
                    className="block text-center text-xs text-volt-500 dark:text-volt-400 hover:underline"
                    onClick={() => setNotifOpen(false)}
                  >
                    View all alerts
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Avatar / Profile */}
        <Link
          to="/profile"
          className="rounded-full ring-2 ring-transparent hover:ring-volt-400/50 transition-all cursor-pointer p-0.5"
          title="View profile"
        >
          <Avatar
            name={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`}
            src={user?.avatar}
            size="sm"
          />
        </Link>
      </div>
    </header>
  );
};
