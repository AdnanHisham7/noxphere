// src/components/layout/RoleProtectedRoute.tsx
import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import { RootState } from "@/store";
import { ROLE_ROUTES } from "@/constants/roleRoutes";

interface RoleProtectedRouteProps {
  allowedRoles: string[];
}

const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  allowedRoles,
}) => {
  const { user } = useSelector((s: RootState) => s.auth);
  const hasAccess = user && allowedRoles.includes(user.role);

  const redirectPath =
    user && ROLE_ROUTES[user.role]
      ? `${ROLE_ROUTES[user.role]}/dashboard`
      : "/";

  return hasAccess ? <Outlet /> : <Navigate to={redirectPath} replace />;
};

export default RoleProtectedRoute;
