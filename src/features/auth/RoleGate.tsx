import { Navigate, Outlet } from "react-router-dom";

import { useAuth, type Role } from "./AuthContext";

const ACCUEIL: Record<Role, string> = {
  admin: "/admin",
  poster: "/calendrier",
  hiring_manager: "/embauche",
};

export function RoleGate({ allow }: { allow: Role[] }) {
  const { role } = useAuth();

  if (!role) return <Navigate to="/login" replace />;
  if (!allow.includes(role)) return <Navigate to={ACCUEIL[role]} replace />;

  return <Outlet />;
}
