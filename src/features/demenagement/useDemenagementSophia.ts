import { useAuth } from "@/features/auth/AuthContext";
import { demenagementCommence, identifiantSophia } from "./demenagement";

/** Identifiant Sophia du créateur connecté, si le pop-up doit s'afficher. */
export function useDemenagementSophia(): string | null {
  const { user, profil } = useAuth();
  if (!demenagementCommence()) return null;
  return identifiantSophia(user?.email ?? profil?.email);
}
