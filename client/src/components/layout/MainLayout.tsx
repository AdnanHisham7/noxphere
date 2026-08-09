// src/components/layout/MainLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { clsx } from 'clsx';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { RootState } from '../../store';

export const MainLayout: React.FC = () => {
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed);
  const activeFranchiseId = useSelector((s: RootState) => s.ui.activeFranchiseId);
  const user = useSelector((s: RootState) => s.auth.user);

  // Show sidebar only if a franchise is active, or if user is super admin (not tied to franchise), or if user is a manager (to support Head Office view)
  const showSidebar = !!activeFranchiseId || user?.role === 'super_admin' || user?.role === 'manager';

  return (
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
  );
};

