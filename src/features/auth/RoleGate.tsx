import { Navigate, Outlet } from "react-router-dom";

import { useAuth, type Role } from "./AuthContext";

const DASHBOARD_BY_ROLE: Record<Role, string> = {
  admin: "/admin",
  poster: "/dashboard",
};

export function RoleGate({ allow }: { allow: Role[] }) {
  const { role } = useAuth();

  if (!role) return <Navigate to="/login" replace />;
  if (!allow.includes(role)) return <Navigate to={DASHBOARD_BY_ROLE[role]} replace />;

  return <Outlet />;
}
