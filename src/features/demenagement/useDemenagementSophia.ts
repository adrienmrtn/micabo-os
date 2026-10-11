import { useAuth } from "@/features/auth/AuthContext";
import { identifiantADonner } from "./demenagement";

/** Identifiant Sophia du créateur connecté, si le pop-up doit s'afficher. */
export function useDemenagementSophia(): string | null {
  const { user, profil, role } = useAuth();
  return identifiantADonner({
    role,
    email: user?.email ?? profil?.email,
    creeLe: user?.created_at,
  });
}
