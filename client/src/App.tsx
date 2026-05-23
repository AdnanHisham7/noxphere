// src/App.tsx
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from "react-redux";
import ToastProvider from "@/providers/ToastProvider";
import { Spinner } from "@/components/ui";
import { store } from "@/store";

// Layouts and route guards
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import RoleProtectedRoute from "@/components/layout/RoleProtectedRoute";

// Lazy loaded pages
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const AcademiesManagement = lazy(
  () => import("@/features/academies/AcademiesManagement"),
);

const PageLoader = () => (
  <div className="min-h-screen bg-pitch-950 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 bg-volt-400 rounded flex items-center justify-center">
        <span className="font-display font-900 text-pitch-900 text-base">
          FC
        </span>
      </div>
      <Spinner size="md" />
    </div>
  </div>
);

const App: React.FC = () => (
  <Provider store={store}>
    <BrowserRouter>
      <ToastProvider />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Authenticated */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              {/* Super Admin only */}
              <Route
                element={<RoleProtectedRoute allowedRoles={["super_admin"]} />}
              >
                <Route path="/dashboard" element={<div>Dashboard</div>} /> 
                <Route path="/academies" element={<AcademiesManagement />} />
              </Route>
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  </Provider>
);

export default App;
