/** HM et DM : mêmes droits recrutement de base. */
export function estRoleManager(role: string | null | undefined): boolean {
  return role === "hiring_manager" || role === "directing_manager";
}
