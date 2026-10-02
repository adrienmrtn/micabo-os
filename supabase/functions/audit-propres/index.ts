/**
 * Audit des images « propres » (0295) : reste-t-il du texte incrusté ?
 *
 *   { offset, limit } → { ok, offset, n, fin, bilan }
 *
 * Lit `limit` images `propre/…` de `media_library` (ordre stable : création,
 * puis id), demande au modèle de vision si le texte que le TikTok d'origine
 * avait posé sur la photo est encore lisible, et range le verdict dans
 * `audit_propres_0295`. N'écrit NULLE PART ailleurs : ni image, ni
 * `texte_restant`.
 *
 * Pourquoi : `texte_restant` ne vaut rien, l'import écrit `false` après chaque
 * nettoyage sans rien vérifier. Le 02/10, `85379b9e` est parti en allemand avec
 * le texte français d'origine encore dans ses images.
 *
 * Le modèle reçoit le texte du deck source à la même position, pour séparer le
 * texte incrusté (à effacer) du texte de la scène (cahier, livre, écran), qui
 * fait partie de la photo et doit rester.
 */

import { callWithFallback, fetchImageAsInline, textOf, TEXT_MODELS } from "../_shared/gemini.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

type Verdict = { reste: "aucun" | "partiel" | "complet"; extrait: string };

/** 8 images décodées en parallèle dépassaient la mémoire de l'Edge (546 WORKER_RESOURCE_LIMIT). */
const PARALLELE_DEFAUT = 3;

function consigne(reference: string): string {
  return `Cette image vient d'un slideshow TikTok. Le texte que l'auteur avait AJOUTÉ par-dessus la photo (police d'application, souvent centré, avec contour, ombre ou fond coloré) devait être effacé.

Pour référence, le texte de cette slide était à peu près : « ${reference || "(inconnu)"} ». Il a pu être réécrit depuis : ne cherche pas une copie exacte, cherche du texte ajouté par-dessus la photo.

Question : reste-t-il, sur cette image, du texte ajouté par-dessus la photo, même en partie, même flou ou à moitié effacé ?

N'en tiens PAS compte : le texte qui fait partie de la scène photographiée (pages de cahier ou de livre, tableau, écran d'ordinateur ou de téléphone filmé, panneau, emballage, vêtement), les logos du décor, la barre d'état d'un téléphone.

Réponds en JSON strict, sans rien d'autre :
{"reste": "aucun" | "partiel" | "complet", "extrait": "le texte ajouté encore lisible, tel quel, ou une chaîne vide"}`;
}

function lireVerdict(brut: string): Verdict {
  const m = brut.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`réponse sans JSON : ${brut.slice(0, 120)}`);
  const v = JSON.parse(m[0]) as Partial<Verdict>;
  const reste = v.reste === "partiel" || v.reste === "complet" ? v.reste : "aucun";
  return { reste, extrait: String(v.extrait ?? "").slice(0, 600) };
}

Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();
  try {
    const corps = await request.json().catch(() => ({}));
    const offset = Math.max(0, Math.floor(Number(corps?.offset ?? 0)) || 0);
    const limit = Math.min(30, Math.max(1, Math.floor(Number(corps?.limit ?? 15)) || 15));
    const parallele = Math.min(4, Math.max(1, Math.floor(Number(corps?.parallele ?? PARALLELE_DEFAUT)) || PARALLELE_DEFAUT));

    const { data: medias, error } = await supabase
      .from("media_library")
      .select("id, url, storage_path, contenu_id")
      .like("storage_path", "propre/%")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    const lot = (medias ?? []) as Array<{ id: string; url: string; storage_path: string; contenu_id: string | null }>;

    // Le texte du deck source à la même position : la référence du modèle.
    const contenuIds = [...new Set(lot.map((m) => m.contenu_id).filter((x): x is string => !!x))];
    const references = new Map<string, string>();
    if (contenuIds.length > 0) {
      const [{ data: contenus }, { data: decks }] = await Promise.all([
        supabase.from("contenus").select("id, langue_source").in("id", contenuIds),
        supabase.from("contenu_langues").select("contenu_id, langue, slides").in("contenu_id", contenuIds),
      ]);
      const source = new Map((contenus ?? []).map((c) => [c.id as string, (c.langue_source as string) ?? "fr"]));
      for (const d of decks ?? []) {
        if (source.get(d.contenu_id as string) !== d.langue) continue;
        for (const s of (Array.isArray(d.slides) ? d.slides : []) as Array<{ position: number; texte_overlay?: string | null }>) {
          references.set(`${d.contenu_id}:${Number(s.position)}`, (s.texte_overlay ?? "").trim());
        }
      }
    }

    const bilan = { aucun: 0, partiel: 0, complet: 0, erreur: 0 };
    let i = 0;
    async function suivant(): Promise<void> {
      while (i < lot.length) {
        const m = lot[i++];
        const pos = Number(m.storage_path.match(/\/(\d+)\.[a-z]+$/i)?.[1] ?? NaN);
        const reference = references.get(`${m.contenu_id}:${pos}`) ?? "";
        let ligne: Record<string, unknown>;
        try {
          const image = await fetchImageAsInline(m.url);
          const v = lireVerdict(textOf(await callWithFallback(TEXT_MODELS, [{ text: consigne(reference) }, image])));
          bilan[v.reste] += 1;
          ligne = { reste: v.reste, extrait: v.extrait || null, erreur: null };
        } catch (e) {
          bilan.erreur += 1;
          ligne = { reste: "erreur", extrait: null, erreur: messageErreur(e).slice(0, 500) };
        }
        await supabase.from("audit_propres_0295").upsert({
          media_id: m.id,
          contenu_id: m.contenu_id,
          position: Number.isFinite(pos) ? pos : null,
          reference: reference || null,
          modele: TEXT_MODELS[0],
          fait_le: new Date().toISOString(),
          ...ligne,
        });
      }
    }
    await Promise.all(Array.from({ length: Math.min(parallele, lot.length) }, () => suivant()));

    return json({ ok: true, offset, n: lot.length, fin: lot.length < limit, bilan });
  } catch (e) {
    return json({ ok: false, error: messageErreur(e) }, 500);
  }
});
