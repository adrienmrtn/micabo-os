/**
 * Lecture de la consommation Apify — module à part, et non dans `apify.ts`.
 *
 * `apify.ts` est tiré par six autres bundles (assignation, revoquer-post,
 * burn…) : y ajouter une fonction, même éliminée par esbuild, permute leurs
 * identifiants minifiés et les ferait « changer » sans raison. Ici, seul
 * `rattrapage-elo` l'importe.
 */

/**
 * Consommation Apify du cycle de facturation en cours.
 *
 * Écrite dans `reglages.apify_usage` à chaque départ de drain pour que le
 * brief du matin la lise en SQL : le 28/09, le crédit s'est épuisé sans que
 * rien dans l'OS ne le montre. Ne lève jamais — un relevé ne doit pas tomber
 * parce que la page de facturation ne répond pas.
 */
export async function lireUsageApify(): Promise<
  | {
      usage_usd: number | null;
      limite_usd: number | null;
      cycle_debut: string | null;
      cycle_fin: string | null;
    }
  | { erreur: string }
> {
  const token = Deno.env.get("APIFY_TOKEN");
  if (!token) return { erreur: "APIFY_TOKEN manquant" };
  try {
    const res = await fetch(`https://api.apify.com/v2/users/me/limits?token=${token}`);
    if (!res.ok) return { erreur: `Apify ${res.status}` };
    // deno-lint-ignore no-explicit-any
    const d = ((await res.json()) as any)?.data ?? {};
    const nombre = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      usage_usd: nombre(d.current?.monthlyUsageUsd),
      limite_usd: nombre(d.limits?.maxMonthlyUsageUsd),
      cycle_debut: d.monthlyUsageCycle?.startAt ?? null,
      cycle_fin: d.monthlyUsageCycle?.endAt ?? null,
    };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : String(e) };
  }
}
