import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

import { ROLE_ROUTES } from "@/constants/roleRoutes";
import { RootState } from "@/store";

const RedirectByRole: React.FC = () => {
  const { isAuthenticated, user } = useSelector(
    (state: RootState) => state.auth,
  );

  // Not logged in
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Unknown role fallback
  const redirectPath = ROLE_ROUTES[user.role] || "/login";

  return <Navigate to={redirectPath} replace />;
};

export default RedirectByRole;
