import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { clsx } from 'clsx';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { RootState } from '../../store';
import { useSocket } from '../../hooks/useSocket';
import { SubscriptionGate } from './SubscriptionGate';
import { closeMobileSidebar } from '../../store/slices/uiSlice';

export const MainLayout: React.FC = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed);
  const activeFranchiseId = useSelector((s: RootState) => s.ui.activeFranchiseId);
  const user = useSelector((s: RootState) => s.auth.user);

  // Close mobile sidebar drawer whenever route changes
  useEffect(() => {
    dispatch(closeMobileSidebar());
  }, [location.pathname, dispatch]);

  // Connects once per authenticated session and joins this user's and
  // franchise's rooms (see index.ts) so live events — starting with the
  // notification bell — reach the client. This previously existed only
  // as an unused hook; nothing ever called it, so no socket connection
  // was ever established and the bell only ever updated on next login.
  useSocket();

  // Show sidebar only if a franchise is active, or if user is super admin (not tied to franchise), or if user is a manager (to support Head Office view), or an employee (academy-scoped, not franchise-scoped)
  const showSidebar = !!activeFranchiseId || user?.role === 'super_admin' || user?.role === 'manager' || user?.role === 'employee';

  return (
    <SubscriptionGate>
      <div className="h-screen bg-slate-50 dark:bg-pitch-950 text-slate-900 dark:text-slate-100 flex overflow-hidden transition-colors duration-200">
        {showSidebar && <Sidebar />}
        <div
          className={clsx(
            'flex-1 flex flex-col min-h-screen transition-all duration-300 min-w-0',
            showSidebar ? (collapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-60') : 'ml-0'
          )}
        >
          <TopBar />
          <main className="flex-1 overflow-y-auto min-h-0 p-3.5 sm:p-5 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SubscriptionGate>
  );
};