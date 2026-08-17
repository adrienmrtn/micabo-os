/** Rôles applicatifs (table `user_roles`). */
export type Role = "admin" | "poster" | "hiring_manager" | "directing_manager";

/** HM et DM : même espace recrutement, mêmes créateurs. */
export function estRoleManager(role: string | null | undefined): boolean {
  return role === "hiring_manager" || role === "directing_manager";
}

/** Badge court : HM / DM. */
export function badgeManager(role: string | null | undefined): "HM" | "DM" | null {
  if (role === "directing_manager") return "DM";
  if (role === "hiring_manager") return "HM";
  return null;
}
