import React, { useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import logoSrc from '../../assets/logo.png';
import { useDispatch, useSelector } from 'react-redux';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  School,
  Building2,
  Users,
  Wallet,
  Shirt,
  Shield,
  UserCog,
  CreditCard,
  Target,
  Repeat2,
  CalendarClock,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Settings,
  MessageSquareWarning,
  type LucideIcon,
} from 'lucide-react';
import { RootState } from '../../store';
import { clearCredentials } from '../../store/slices/authSlice';
import { toggleSidebar, setActiveFranchise, clearActiveFranchise } from '../../store/slices/uiSlice';
import { clearNotifications } from '../../store/slices/notificationSlice';
import { baseApi } from '../../store/api/baseApi';
import { Avatar, Modal } from '../ui';
import { useLogoutMutation } from '../../store/api/authApi';
import { useGetFranchisesQuery } from '../../store/api/franchiseApi';
import { useCurrentAcademyId } from '../../hooks/useCurrentAcademyId';
import { isFranchiseRequiredPage } from '../../hooks/useCurrentFranchiseId';
import { useTransferWallEnabled } from '../../hooks/useTransferWallEnabled';

type EmployeePermissionKey =
  | 'canManageUsers'
  | 'canManageFranchises'
  | 'canManageSessions'
  | 'canManageFinance'
  | 'canViewReports'
  | 'canManageAttendance'
  | 'canManagePerformance'
  | 'canManageSelection'
  | 'canSendNotifications';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  // Approximate mapping onto the app's 9 generic permission keys — those
  // were designed for coarse role gating (manager/coach/etc.), not
  // fine-grained per-page ACLs, so this is a best-effort fit rather than
  // an exact one. Only used for the 'employee' role below; every other
  // role ignores this and sees its full fixed list as before.
  requiredPermission?: EmployeePermissionKey;
}

const EMPLOYEE_NAV: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/franchises', label: 'Franchise', icon: Building2, requiredPermission: 'canManageFranchises' },
  { path: '/students', label: 'Squad', icon: Shirt, requiredPermission: 'canManageAttendance' },
  { path: '/teams', label: 'Team', icon: Shield, requiredPermission: 'canManagePerformance' },
  { path: '/coaches', label: 'Coaches', icon: UserCog, requiredPermission: 'canManageUsers' },
  { path: '/schedule', label: 'Sessions', icon: CalendarClock, requiredPermission: 'canManageSessions' },
  { path: '/resources', label: 'Resources', icon: FolderOpen },
  { path: '/fees', label: 'Fees', icon: CreditCard, requiredPermission: 'canManageFinance' },
  { path: '/notifications', label: 'Alerts', icon: Bell, requiredPermission: 'canSendNotifications' },
];

const navConfig: Record<string, NavItem[]> = {
  super_admin: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/academies', label: 'Academies', icon: School },
    { path: '/franchises', label: 'Franchises', icon: Building2 },
    { path: '/users', label: 'Users', icon: Users },
    { path: '/finance', label: 'Finance', icon: Wallet },
    { path: '/nfc-cards', label: 'NFC Cards', icon: CreditCard },
  ],
  manager: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/franchises', label: 'Franchise', icon: Building2 },
    { path: '/students', label: 'Squad', icon: Shirt },
    { path: '/nfc-cards', label: 'NFC Cards', icon: CreditCard },
    { path: '/teams', label: 'Team', icon: Shield },
    { path: '/coaches', label: 'Coaches', icon: UserCog },
    { path: '/employees', label: 'Employees', icon: Users },
    { path: '/complaints', label: 'Complaints', icon: MessageSquareWarning },
    { path: '/schedule', label: 'Sessions', icon: CalendarClock },
    { path: '/resources', label: 'Resources', icon: FolderOpen },
    { path: '/fees', label: 'Fees', icon: CreditCard },
    { path: '/subscription', label: 'Subscription', icon: Wallet },
    { path: '/notifications', label: 'Alerts', icon: Bell },
    { path: '/settings', label: 'Settings', icon: Settings },
  ],
  coach: [
    { path: '/coach/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/students', label: 'Squad', icon: Shirt },
    { path: '/schedule', label: 'Sessions', icon: CalendarClock },
    { path: '/resources', label: 'Resources', icon: FolderOpen },
    { path: '/notifications', label: 'Alerts', icon: Bell },
  ],
  employee: EMPLOYEE_NAV,
};

export const Sidebar: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const { sidebarCollapsed, unreadCount, activeFranchiseId } = useSelector((s: RootState) => ({
    sidebarCollapsed: s.ui.sidebarCollapsed,
    unreadCount: s.notifications.unreadCount,
    activeFranchiseId: s.ui.activeFranchiseId ?? s.auth.user?.franchiseId ?? null,
  }));
  const transferWallEnabled = useTransferWallEnabled();

  const isHeadOfficeUser = user?.role === 'manager' && !user?.franchiseId;
  const activeAcademyId = useCurrentAcademyId();
  const { data: franchises } = useGetFranchisesQuery(
    activeAcademyId ? { academyId: activeAcademyId, isActive: true } : undefined,
    { skip: !activeAcademyId || !isHeadOfficeUser }
  );

  const navItems = (navConfig[user?.role || 'manager'] || [])
    .filter((item) => item.path !== '/transfer-wall' || transferWallEnabled)
    .filter((item) => !item.requiredPermission || !!user?.permissions?.[item.requiredPermission]);
  const [logoutRequest] = useLogoutMutation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    try {
      await logoutRequest({}).unwrap();
    } catch {
      // Non-fatal — proceed to clear local session regardless
    }
    dispatch(clearCredentials());
    dispatch(clearActiveFranchise());
    dispatch(clearNotifications());
    dispatch(baseApi.util.resetApiState());
    navigate('/login');
  };


  return (
    <>
      <aside
      className={clsx(
        'fixed left-0 top-0 h-full z-40 flex flex-col',
        'bg-white border-r border-slate-200 text-slate-800 dark:bg-pitch-900 dark:border-white/5 dark:text-slate-200 shadow-sm dark:shadow-none',
        'transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo / Brand */}
      <div className={clsx('flex items-center h-16 border-b border-slate-200 dark:border-white/5 px-4 gap-3', sidebarCollapsed && 'justify-center')}>
        <div className="w-8 h-8 rounded-lg bg-pitch-950/5 dark:bg-white/5 p-1 flex items-center justify-center flex-shrink-0">
          <img src={logoSrc} alt="Noxphere" className="w-full h-full object-contain drop-shadow" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="font-display font-black text-slate-900 dark:text-white uppercase tracking-wider text-base leading-tight">Noxphere</p>
            <p className="text-[10px] font-semibold text-volt-600 dark:text-volt-400 uppercase tracking-widest">Academy OS</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto no-scrollbar">
        {isHeadOfficeUser && (
          <button
            onClick={() => {
              dispatch(clearActiveFranchise());
              navigate('/dashboard');
            }}
            className="flex items-center gap-3 px-3 py-2.5 mx-2 mb-4 bg-volt-400/10 border border-volt-400/20 text-volt-600 dark:text-volt-400 rounded text-xs font-bold hover:bg-volt-400/20 transition-all duration-150 w-[calc(100%-1rem)]"
          >
            <Building2 size={14} className="flex-shrink-0" />
            {!sidebarCollapsed && <span className="uppercase tracking-wider">Academy Overview</span>}
          </button>
        )}
        <div className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (isHeadOfficeUser && isFranchiseRequiredPage(item.path)) {
                    if ((!activeFranchiseId || !franchises?.some((f) => f.id === activeFranchiseId)) && franchises && franchises.length > 0) {
                      dispatch(setActiveFranchise(franchises[0].id));
                    }
                  }
                }}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all duration-150 group',
                    isActive
                      ? 'bg-volt-400/15 text-slate-900 dark:text-volt-400 border-l-2 border-volt-400 pl-[10px] font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5 border-l-2 border-transparent'
                  )
                }
              >
                <Icon size={16} className="flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="font-body font-medium uppercase tracking-wide text-xs truncate">
                    {item.label}
                  </span>
                )}
                {item.label === 'Alerts' && unreadCount > 0 && !sidebarCollapsed && (
                  <span className="ml-auto bg-ember-500 text-white text-2xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center" data-keep-white>
                    {unreadCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Transfer Wall quick access */}
      {!sidebarCollapsed && transferWallEnabled && (
        <div className="px-4 py-3 mx-2 mb-3 bg-ice-400/10 border border-ice-400/20 dark:bg-ice-400/8 dark:border-ice-400/15 rounded">
          <p className="text-2xs text-ice-600 dark:text-ice-400 uppercase tracking-widest font-bold mb-1">Transfer Wall</p>
          <p className="text-xs text-slate-500">Public portal active</p>
        </div>
      )}

      {/* User profile */}
      <div className={clsx('border-t border-slate-200 dark:border-white/5 p-3 flex items-center', sidebarCollapsed ? 'justify-center' : 'gap-2')}>
        <Link
          to="/profile"
          className={clsx(
            'flex items-center gap-3 min-w-0 flex-1 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors',
            sidebarCollapsed && 'justify-center flex-initial'
          )}
          title="View profile"
        >
          <Avatar name={`${user?.firstName} ${user?.lastName}`} src={user?.avatar} size="sm" />
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-2xs text-slate-500 uppercase tracking-wide">{user?.role?.replace('_', ' ')}</p>
            </div>
          )}
        </Link>
        {!sidebarCollapsed && (
          <button
            onClick={() => setShowLogoutModal(true)}
            className="text-slate-400 hover:text-ember-500 transition-colors p-1"
            title="Logout"
          >
            <LogOut size={15} />
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => dispatch(toggleSidebar())}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 shadow-sm rounded-full flex items-center justify-center text-slate-500 hover:text-volt-600 dark:bg-pitch-800 dark:border-white/10 dark:text-slate-400 dark:hover:text-volt-400 transition-colors"
      >
        {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
    </aside>

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
  </>
  );
};