/**
 * Essai à blanc du placement micabo (0289) : l'ancien et le nouveau moteur sur
 * le MÊME deck, sans rien écrire.
 *
 *   { contenuId, langue } → { ok, deck, avant, apres }
 *
 * Le deck est celui que la production fabriquerait pour cette langue : la
 * source telle quelle, ou sa traduction avec le prompt de traduction courant.
 * Puis, sur ce même deck :
 *  - `avant` : l'ancien placement (`integrateSophiaAvant`, figé), avec le prompt
 *    maître en vigueur (`placement_micabo`), sans les règles de la marque, comme
 *    avant 0289. Les concurrents restants y sont signalés : l'ancien moteur en
 *    aurait fait un second micabo.
 *  - `apres` : le nouveau moteur. Les concurrents d'abord, une mention par deck ;
 *    si une slide cite alors micabo, c'est le placement ; sinon le nouveau
 *    placement avec le prompt v2 (`placement_micabo_v2`), seconde moitié du deck.
 *
 * Aucune écriture : ni deck, ni passage, ni journal. Sert à juger le prompt v2
 * à l'aveugle avant de basculer `placement_micabo`.
 */

import {
  appliquerVerdicts,
  type Concurrent,
  CONCURRENTS_DEFAUT,
  nomsSansMarque,
  slidesAJuger,
  versMicaboDepuis,
} from "../_shared/concurrents.ts";
import { corrigerMentionsConcurrents, integrateSophia, translateSlideshow } from "../_shared/gemini.ts";
import { nettoyerTexteDeck } from "../_shared/marque.ts";
import { citeMicabo, slideCitantMicabo } from "../_shared/placement.ts";
import { assertAuthorised, chargerPrompt, json, messageErreur, serviceClient } from "../_shared/supabase.ts";
import { integrateSophiaAvant } from "./avant.ts";

type Slide = { position: number; texte_overlay: string | null };

Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();
  try {
    const corps = await request.json().catch(() => ({}));
    const contenuId = String(corps?.contenuId ?? "").trim();
    const langue = String(corps?.langue ?? "fr").trim().toLowerCase();
    if (!contenuId) return json({ ok: false, error: "contenuId manquant" }, 400);

    const { data: contenu } = await supabase
      .from("contenus")
      .select("id, titre, langue_source, compte_reference_id")
      .eq("id", contenuId)
      .single();
    if (!contenu) return json({ ok: false, error: "contenu introuvable" }, 404);
    const langueSource = contenu.langue_source ?? "fr";

    const { data: clSource } = await supabase
      .from("contenu_langues")
      .select("slides")
      .eq("contenu_id", contenuId)
      .eq("langue", langueSource)
      .maybeSingle();
    const source = ((clSource?.slides ?? []) as Slide[]).filter((s) => s.position != null);
    if (!source.some((s) => s.texte_overlay)) return json({ ok: false, error: "deck source vide" }, 400);

    // 1. Le deck de cette langue, comme la production le fabriquerait.
    let deck: Slide[];
    if (langue === langueSource) {
      deck = source.map((s) => ({ position: s.position, texte_overlay: nettoyerTexteDeck(s.texte_overlay ?? "", langue) }));
    } else {
      const { data: ref } = contenu.compte_reference_id
        ? await supabase.from("comptes_reference").select("style_profile").eq("id", contenu.compte_reference_id).maybeSingle()
        : { data: null };
      const dedie = await chargerPrompt(supabase, `traduction_${langue}`);
      const base = dedie ?? (langue === "fr" ? await chargerPrompt(supabase, "traduction") : undefined);
      const voix = (ref as { style_profile?: string | null } | null)?.style_profile ?? null;
      const regles = [base, voix ? `Voix propre à cette source :\n${voix}` : null].filter(Boolean).join("\n\n");
      const t = await translateSlideshow({
        slides: source.map((s) => ({ position: s.position, original: s.texte_overlay ?? "" })),
        sourceTitle: contenu.titre ?? "",
        rules: regles || undefined,
        langue,
        variation: false,
      });
      const parPos = new Map(t.slides.map((x) => [x.position, x.translated]));
      deck = source.map((s) => ({ position: s.position, texte_overlay: nettoyerTexteDeck(parPos.get(s.position) ?? "", langue) }));
    }

    const [{ data: liste }, sm] = await Promise.all([
      supabase.from("concurrents").select("nom, motif").eq("actif", true),
      supabase.from("concurrents_sans_marque").select("nom"),
    ]);
    const concurrents: Concurrent[] = liste
      ? versMicaboDepuis(liste as Concurrent[], sm.error ? null : (sm.data as Array<{ nom: string }>))
      : CONCURRENTS_DEFAUT;
    const ancien = (await chargerPrompt(supabase, "placement_micabo")) ?? "";
    const nouveau = (await chargerPrompt(supabase, "placement_micabo_v2")) ?? "";
    const pourModele = (d: Slide[]) => d.map((s) => ({ position: s.position, text: s.texte_overlay ?? "" }));

    // 2. Les deux moteurs, en parallèle, sur le même deck.
    const [avant, apres] = await Promise.all([
      (async () => {
        const p = await integrateSophiaAvant({
          masterPrompt: ancien,
          corrections: [],
          slides: pourModele(deck),
          caption: contenu.titre ?? "",
          langue,
          marque: "micabo",
        });
        if (!p) return { position: null, texte: null, motif: "échec du modèle" };
        const restants = slidesAJuger(deck, concurrents).filter((s) => s.position !== p.chosenPosition);
        return {
          position: p.chosenPosition,
          texte: p.variants[p.bestIndex] ?? null,
          variantes: p.variants,
          mode: p.mode,
          motif: "prompt actuel",
          concurrentsRestants: restants,
        };
      })(),
      (async () => {
        let d = deck;
        const aJuger = slidesAJuger(d, concurrents);
        let concurrentsRemplaces: number[] = [];
        if (aJuger.length > 0) {
          const jugees = new Set(aJuger.map((s) => s.position));
          const verdicts = await corrigerMentionsConcurrents({
            langue,
            slides: d.map((s) => ({ position: s.position, texte: s.texte_overlay ?? "" })),
            aJuger,
            micaboDejaCite: d.some((s) => !jugees.has(s.position) && citeMicabo(s.texte_overlay)),
            sansMarque: nomsSansMarque(concurrents).filter((n) => aJuger.some((s) => s.cites.includes(n))),
          });
          if (verdicts) {
            const r = appliquerVerdicts(d, aJuger, verdicts, concurrents, (t) => nettoyerTexteDeck(t, langue));
            d = r.slides;
            concurrentsRemplaces = r.remplacees;
          }
        }
        const deja = slideCitantMicabo(d);
        if (deja != null) {
          return {
            position: deja,
            texte: d.find((s) => s.position === deja)?.texte_overlay ?? null,
            motif: concurrentsRemplaces.includes(deja) ? "concurrent remplacé" : "micabo déjà cité",
            concurrentsRemplaces,
            deck: d,
          };
        }
        const p = await integrateSophia({
          masterPrompt: nouveau,
          corrections: [],
          slides: pourModele(d),
          caption: contenu.titre ?? "",
          langue,
          marque: "micabo",
        });
        if (!p) return { position: null, texte: null, motif: "échec du modèle", concurrentsRemplaces, deck: d };
        return {
          position: p.chosenPosition,
          texte: nettoyerTexteDeck(p.variants[p.bestIndex] ?? "", langue),
          variantes: p.variants,
          mode: p.mode,
          motif: "prompt v2",
          concurrentsRemplaces,
          deck: d,
        };
      })(),
    ]);

    return json({ ok: true, contenuId, langue, titre: contenu.titre ?? null, deck, avant, apres });
  } catch (e) {
    return json({ ok: false, error: messageErreur(e) }, 500);
  }
});
