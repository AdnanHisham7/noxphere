// src/components/layout/Sidebar.tsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { clsx } from "clsx";
import { RootState } from "@/store";
import { clearCredentials } from "@/store/slices/authSlice";
import { toggleSidebar } from "@/store/slices/uiSlice";
import { Avatar } from "@/components/ui";
import {
  Building2,
  Icon,
  LayoutDashboard,
  LogOut,
  LucideIcon,
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
}

const navConfig: Record<string, NavItem[]> = {
  super_admin: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/academies", label: "Academies", icon: Building2 },
  ],
};

export const Sidebar: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const { activeAcademyName, sidebarCollapsed, unreadCount } = useSelector(
    (s: RootState) => ({
      activeAcademyName: s.ui.activeAcademyName,
      sidebarCollapsed: s.ui.sidebarCollapsed,
      unreadCount: s.notifications.unreadCount,
    }),
  );

  const navItems = navConfig[user?.role || "manager"] || [];

  const handleLogout = () => {
    dispatch(clearCredentials());
    navigate("/login");
  };

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 h-full z-40 flex flex-col",
        "bg-pitch-900 border-r border-white/5",
        "transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo / Brand */}
      <div
        className={clsx(
          "flex items-center h-16 border-b border-white/5 px-4 gap-3",
          sidebarCollapsed && "justify-center",
        )}
      >
        <div className="w-8 h-8 bg-volt-400 rounded flex items-center justify-center flex-shrink-0 text-pitch-900 font-bold">
          {activeAcademyName ? activeAcademyName.charAt(0).toUpperCase() : "FC"}
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="font-display font-extrabold text-white uppercase tracking-wide text-sm leading-tight truncate">
              {activeAcademyName || "Football"}
            </p>
            <p className="font-display text-volt-400 uppercase tracking-widest text-xs">
              {activeAcademyName ? "Academy" : "Camp"}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto no-scrollbar">
        <div className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all duration-150 group",
                    isActive
                      ? "bg-volt-400/10 text-volt-400 border-l-2 border-volt-400 pl-[10px]"
                      : "text-slate-500 hover:text-slate-200 hover:bg-white/4 border-l-2 border-transparent",
                  )
                }
              >
                <Icon size={18} strokeWidth={2} className="flex-shrink-0" />

                {!sidebarCollapsed && (
                  <span className="font-body font-medium uppercase tracking-wide text-xs truncate">
                    {item.label}
                  </span>
                )}

                {item.label === "Alerts" &&
                  unreadCount > 0 &&
                  !sidebarCollapsed && (
                    <span className="ml-auto bg-ember-500 text-white text-2xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {unreadCount}
                    </span>
                  )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* User profile */}
      <div
        className={clsx(
          "border-t border-white/5 p-3",
          sidebarCollapsed ? "flex justify-center" : "flex items-center gap-3",
        )}
      >
        <Avatar
          name={`${user?.firstName} ${user?.lastName}`}
          src={user?.avatar}
          size="sm"
        />
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-2xs text-slate-500 uppercase tracking-wide">
              {user?.role?.replace("_", " ")}
            </p>
          </div>
        )}
        {!sidebarCollapsed && (
          <button
            onClick={handleLogout}
            className="text-slate-600 hover:text-ember-400 transition-colors text-sm"
            title="Logout"
          >
            <LogOut size={16} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => dispatch(toggleSidebar())}
        className="absolute -right-3 top-20 w-6 h-6 bg-pitch-800 border border-white/10 rounded-full flex items-center justify-center text-slate-500 hover:text-volt-400 transition-colors text-xs"
      >
        {sidebarCollapsed ? "›" : "‹"}
      </button>
    </aside>
  );
};
