// src/components/layout/MainLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { clsx } from 'clsx';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { RootState } from '../../store';
import { useSocket } from '../../hooks/useSocket';
import { SubscriptionGate } from './SubscriptionGate';

export const MainLayout: React.FC = () => {
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed);
  const activeFranchiseId = useSelector((s: RootState) => s.ui.activeFranchiseId);
  const user = useSelector((s: RootState) => s.auth.user);

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
      <div className="h-screen bg-pitch-950 flex overflow-hidden">
        {showSidebar && <Sidebar />}
        <div
          className={clsx(
            'flex-1 flex flex-col min-h-screen transition-all duration-300',
            showSidebar ? (collapsed ? 'ml-16' : 'ml-60') : 'ml-0'
          )}
        >
          <TopBar />
          <main className="flex-1 overflow-y-auto min-h-0 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SubscriptionGate>
  );
};