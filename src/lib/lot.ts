/** Nombre d'agents de nettoyage lancés en parallèle par défaut.
 *
 *  Chaque tâche = une invocation Edge Function indépendante (un vrai worker
 *  isolé). MAIS le vrai goulot n'est pas le client : c'est le backend du proxy
 *  (Gemini via Lovable), qui ne tient qu'une poignée de nettoyages à la fois.
 *  Mesuré : un appel seul passe en ~12 s quand le backend est sain, mais dès
 *  qu'on en lance plusieurs en même temps, la plupart pendent puis échouent —
 *  ils se battent pour la même capacité. Deux en parallèle est le compromis
 *  raisonnable : un peu de débit sans étrangler le proxy. Pour vraiment
 *  paralléliser davantage, le levier est CÔTÉ PROXY (plus de quota / plusieurs
 *  clés Gemini / une file), pas ici : monter ce chiffre ne ferait qu'aggraver
 *  les échecs. Le repli côté serveur (timeout+retry+budget, puis remplacement
 *  par une photo propre de la bibliothèque) garantit qu'un poster n'est jamais
 *  bloqué même quand le proxy sature. */
export const AGENTS_NETTOYAGE = 2;

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
