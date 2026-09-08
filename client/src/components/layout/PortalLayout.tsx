// src/components/layout/PortalLayout.tsx
import React, { useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import logoSrc from "../../assets/logo.png";
import { useSelector, useDispatch } from "react-redux";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { RootState } from "../../store";
import { clearCredentials } from "../../store/slices/authSlice";
import { clearActiveFranchise } from "../../store/slices/uiSlice";
import { clearNotifications } from "../../store/slices/notificationSlice";
import { baseApi } from "../../store/api/baseApi";
import { useSocket } from "../../hooks/useSocket";
import { PortalNotificationBell } from "./PortalNotificationBell";
import { ConsentGate } from "./ConsentGate";
import { ThemeToggle } from "../common/ThemeToggle";
import { useGetMyDashboardQuery } from "../../store/api/studentPortalApi";
import { useLogoutMutation } from "../../store/api/authApi";
import { Modal } from "../ui";


export interface PortalNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface PortalLayoutProps {
  navItems: PortalNavItem[];
  portalLabel: string;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ navItems, portalLabel }) => {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isStudent = user?.role === "student";
  const { data: studentDashboard } = useGetMyDashboardQuery(undefined, { skip: !isStudent });
  const isFreeAgent = isStudent && studentDashboard && !studentDashboard.profile?.franchiseId;

  const displayNavItems = navItems.filter((item) => {
    if (isFreeAgent && item.to === "/student/progress") {
      return false;
    }
    return true;
  });

  // Guardians and students previously had no live connection at all —
  // joins this user's room the same way MainLayout does for staff roles,
  // so the bell below can receive live pushes, not just what was in the
  // feed on page load.
  useSocket();

  const [logoutRequest] = useLogoutMutation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    try {
      await logoutRequest({}).unwrap();
    } catch {
      // Non-fatal
    }
    dispatch(clearCredentials());
    dispatch(clearActiveFranchise());
    dispatch(clearNotifications());
    dispatch(baseApi.util.resetApiState());
    navigate("/login", { replace: true });
  };

  const initials = user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}` : "";

  return (
    <div className="nox-landing min-h-screen flex">
      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-3 bg-white/95 border-b border-slate-200 text-slate-900 dark:bg-ink-950/95 dark:border-white/[0.06] dark:text-white backdrop-blur">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logoSrc} alt="Noxphere" className="w-7 h-7 object-contain drop-shadow" />
          <span className="font-orbital font-bold text-slate-900 dark:text-nox-high">Noxphere</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle size="sm" />
          <PortalNotificationBell />
          <button onClick={() => setMobileOpen((v) => !v)} className="text-slate-500 hover:text-slate-900 dark:text-nox-mid dark:hover:text-white p-2">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky md:top-0 inset-y-0 left-0 z-30 w-64 h-screen flex-shrink-0 border-r border-slate-200 bg-white text-slate-800 dark:border-white/[0.06] dark:bg-ink-900 dark:text-slate-200 flex flex-col transition-transform duration-200 shadow-sm dark:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="hidden md:flex items-center gap-3 px-6 py-6 border-b border-slate-100 dark:border-white/[0.06] flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/5 p-1 flex items-center justify-center border border-slate-200/60 dark:border-white/10 shadow-sm flex-shrink-0">
            <img src={logoSrc} alt="Noxphere" className="w-full h-full object-contain drop-shadow" />
          </div>
          <div>
            <div className="font-orbital font-bold text-slate-900 dark:text-nox-high leading-tight">Noxphere</div>
            <div className="text-[10px] font-mono uppercase tracking-wide text-slate-500 dark:text-nox-low">{portalLabel}</div>
          </div>
        </div>

        <nav className="flex-1 px-3 mt-4 md:mt-0 space-y-1 overflow-y-auto min-h-0 custom-scrollbar">
          {displayNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    isActive
                      ? "bg-core-400/15 text-core-500 dark:bg-core-400/[0.1] dark:text-core-400 border border-core-400/30 dark:border-core-400/20 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-nox-mid dark:hover:text-nox-high dark:hover:bg-white/[0.03] border border-transparent"
                  }`
                }
              >
                <Icon size={17} strokeWidth={1.75} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-white/[0.06] flex items-center gap-3 flex-shrink-0 mt-auto">
          <Link
            to={isStudent ? "/student/profile" : "/guardian/profile"}
            className="flex items-center gap-3 min-w-0 flex-1 p-1 -m-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            title="View profile"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-ion-400/15 text-ion-500 dark:text-ion-300 font-orbital text-xs font-semibold flex-shrink-0">
              {initials || "?"}
            </span>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm text-slate-900 dark:text-nox-high font-medium truncate">
                {user ? `${user.firstName} ${user.lastName}` : ""}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-nox-low capitalize">{user?.role}</div>
            </div>
          </Link>
          <button
            onClick={() => setShowLogoutModal(true)}
            aria-label="Sign out"
            className="text-slate-400 hover:text-ember-500 dark:text-nox-low dark:hover:text-nox-high transition-colors p-1.5"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Content */}
      <main className="flex-1 min-w-0 pt-16 md:pt-0">
        <div className="hidden md:flex items-center justify-end px-8 pt-6 gap-3">
          <ThemeToggle size="sm" />
          <PortalNotificationBell />
        </div>
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-8">

          <ConsentGate>
            <Outlet />
          </ConsentGate>
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <Modal isOpen onClose={() => setShowLogoutModal(false)} title="Confirm Sign Out" size="sm">
          <div className="space-y-4 py-2 text-sm text-slate-600 dark:text-slate-300">
            <p>Are you sure you want to sign out of your Noxphere account?</p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="btn-secondary text-xs py-1.5 px-3.5"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold shadow-sm transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PortalLayout;
