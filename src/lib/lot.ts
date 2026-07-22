/** Nombre d'agents de nettoyage lancés en parallèle par défaut.
 *
 *  Chaque tâche = une invocation Edge Function indépendante : un vrai worker
 *  isolé, avec son propre budget CPU/temps. Cinq en parallèle vident un lot vite
 *  sans trop faire contendre le backend Gemini (au-delà, les 503 « surchargé »
 *  se multiplient plus qu'ils n'accélèrent). Le repli retry+jitter côté serveur
 *  absorbe les collisions résiduelles. */
export const AGENTS_NETTOYAGE = 5;

/**
 * Exécute `tache` sur chaque élément avec un pool borné de workers parallèles.
 * Un échec isolé ne stoppe pas le lot (on nettoie le maximum). `onProgres` est
 * appelé après CHAQUE élément terminé, pour une barre de progression fluide.
 */
export async function executerEnLot<T>(
  items: T[],
  tache: (item: T) => Promise<unknown>,
  options: { largeur?: number; onProgres?: (fait: number, total: number) => void } = {},
): Promise<void> {
  const total = items.length;
  if (total === 0) return;
  const largeur = Math.min(options.largeur ?? AGENTS_NETTOYAGE, total);

  let index = 0;
  let fait = 0;
  async function travailleur() {
    while (index < total) {
      const item = items[index++];
      try {
        await tache(item);
      } catch {
        // un échec isolé ne stoppe pas le lot
      }
      fait += 1;
      options.onProgres?.(fait, total);
    }
  }
  await Promise.all(Array.from({ length: largeur }, travailleur));
}
