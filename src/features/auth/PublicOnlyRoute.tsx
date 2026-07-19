import { Navigate, Outlet } from "react-router-dom";

import { FullPageLoader } from "@/components/layout/FullPageLoader";
import { useAuth } from "./AuthContext";

/**
 * Garde /login et /signup. Sans ça, se connecter laisse l'utilisateur sur
 * l'écran d'auth : la session change mais l'URL non. Le renvoi vers "/" laisse
 * RoleHome aiguiller vers le bon espace.
 */
export function PublicOnlyRoute() {
  const { user, loading } = useAuth();

  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to="/" replace />;

  return <Outlet />;
}
