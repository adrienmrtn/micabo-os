/**
 * Comptes d'un créateur : lequel afficher, lequel garder d'une visite à l'autre.
 *
 * Ce qui reste de `comptesCm.ts` après le retrait de CM paper (14/09/2026) :
 * un créateur n'a plus qu'un type de compte, donc « le compte principal » est
 * simplement le premier.
 */

export function comptePrincipal<T>(comptes: T[]): T | undefined {
  return comptes[0];
}

export function cleCompteActif(userId: string): string {
  return `compte-actif-${userId}`;
}

export function lireCompteActif(userId: string, comptes: Array<{ id: string }>): string | null {
  if (comptes.length === 0) return null;
  try {
    const sauve = localStorage.getItem(cleCompteActif(userId));
    if (sauve && comptes.some((c) => c.id === sauve)) return sauve;
  } catch {
    /* private mode */
  }
  return null;
}

export function ecrireCompteActif(userId: string, compteId: string): void {
  try {
    localStorage.setItem(cleCompteActif(userId), compteId);
  } catch {
    /* private mode */
  }
}

/**
 * Un login peut naître sans compte TikTok. Il en reçoit un si on le demande
 * ET qu'une langue est fournie — un compte sans langue n'est pas assignable.
 */
export function premierCompteDemande(
  avecCompte: boolean | undefined,
  langue?: string | null,
): "perso" | "aucun" {
  if (avecCompte === false) return "aucun";
  return String(langue ?? "").trim() ? "perso" : "aucun";
}
