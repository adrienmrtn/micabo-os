import { integrateSophia, translateSlideshow } from "./gemini.ts";
import { chargerPrompt, serviceClient } from "./supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

interface Slide {
  position: number;
  raw_url: string;
  texte_original: string | null;
  media_id: string | null;
}

export interface DemandeComposition {
  compteId: string;
  sujetId: string;
  type: "recycle" | "remanie" | "nouveau";
  date: string | null;
  /** Post dont celui-ci est une variante (remaniés). */
  sourcePostId?: string | null;
}

/**
 * Crée la coquille du post, sans aucun appel IA. La fabrication elle-même est
 * l'affaire d'`avancerPost`, appelé ensuite par petits pas : traduction et
 * placement dans la même invocation dépassaient les ressources d'une Edge
 * Function.
 */
export async function creerPost(
  supabase: Supabase,
  demande: DemandeComposition,
): Promise<string> {
  const { data: sujet, error: sujetErreur } = await supabase
    .from("sujets")
    .select("id, preparation_statut, musique_url, musique_titre, musique_plateforme")
    .eq("id", demande.sujetId)
    .single();
  if (sujetErreur || !sujet) throw new Error("Sujet introuvable");
  if (sujet.preparation_statut !== "done") throw new Error("Sujet pas encore préparé");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      compte_id: demande.compteId,
      sujet_id: sujet.id,
      type: demande.type,
      statut: "brouillon",
      date_publication_prevue: demande.date,
      source_post_id: demande.sourcePostId ?? null,
      musique_url: sujet.musique_url,
      musique_titre: sujet.musique_titre,
      musique_plateforme: sujet.musique_plateforme,
      pipeline_statut: "pending",
    })
    .select()
    .single();

  if (error || !post) throw error ?? new Error("Création du post échouée");
  return post.id;
}

/**
 * Fait avancer un post d'une étape et rend la main. Renvoie l'étape effectuée.
 *
 * Traduction puis placement de l'appli Sophia, chacun dans son propre passage :
 * les deux prompts sont volumineux et les enchaîner épuisait le worker.
 */
// deno-lint-ignore no-explicit-any
export async function avancerPost(supabase: Supabase, post: any): Promise<string> {
  try {
    const { data: compte } = await supabase
      .from("comptes")
      .select("*")
      .eq("id", post.compte_id)
      .single();
    if (!compte) throw new Error("Compte introuvable");

    const { data: sujet } = await supabase
      .from("sujets")
      .select("*")
      .eq("id", post.sujet_id)
      .single();
    if (!sujet) throw new Error("Sujet introuvable");

    const slides: Slide[] = sujet.structure_slides ?? [];
    if (slides.length === 0) throw new Error("Sujet sans visuel");

    const { data: existantes } = await supabase
      .from("post_slides")
      .select("id, position, texte_overlay, position_sophia")
      .eq("post_id", post.id)
      .order("position");

    // 1 — traduction de tout le deck en une passe : seule façon de tenir la
    // persona et le genre d'une slide à l'autre.
    if (!existantes || existantes.length === 0) {
      await marquer(supabase, post.id, "traduction");

      // Les règles de traduction sont propres à une langue : listes noires de
      // tournures, tutoiement, registre. Appliquer les règles françaises à un
      // compte espagnol produisait du français. On prend donc le prompt dédié à
      // la langue s'il existe, le prompt général pour le français, et sinon les
      // règles neutres du code — à charge de l'admin d'écrire `traduction_es`
      // pour obtenir la même finesse qu'en français.
      const dedie = await chargerPrompt(supabase, `traduction_${compte.langue}`);
      const base = dedie ?? (compte.langue === "fr"
        ? await chargerPrompt(supabase, "traduction")
        : undefined);

      const regles = [
        base,
        compte.style_profile ? `Voix propre à ce compte :\n${compte.style_profile}` : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      const traductions = await translateSlideshow({
        slides: slides.map((s) => ({ position: s.position, original: s.texte_original ?? "" })),
        sourceTitle: sujet.titre ?? "",
        rules: regles || undefined,
        langue: compte.langue,
        variation: post.type === "remanie",
      });
      const parPosition = new Map(traductions.map((t) => [t.position, t.translated]));

      await supabase.from("post_slides").insert(
        slides.map((s) => ({
          post_id: post.id,
          position: s.position,
          media_id: s.media_id,
          texte_overlay: parPosition.get(s.position) ?? "",
          position_sophia: false,
        })),
      );

      return "traduction";
    }

    // 2 — placement de l'appli Sophia sur l'une des slides.
    if (!existantes.some((s) => s.position_sophia)) {
      await marquer(supabase, post.id, "placement_sophia");

      const { data: corrections } = await supabase
        .from("corrections")
        .select("texte_origine, texte_corrige")
        .order("created_at", { ascending: false })
        .limit(40);

      const placement = await integrateSophia({
        masterPrompt: (await chargerPrompt(supabase, "placement_sophia")) ?? "",
        corrections: (corrections ?? []).map((c) => ({
          original_text: c.texte_origine,
          corrected_text: c.texte_corrige,
        })),
        slides: existantes.map((s) => ({
          position: s.position,
          text: s.texte_overlay ?? "",
        })),
        caption: sujet.titre ?? "",
        langue: compte.langue,
      });

      if (placement) {
        const cible = existantes.find((s) => s.position === placement.chosenPosition);
        if (cible) {
          await supabase
            .from("post_slides")
            .update({
              texte_overlay: placement.variants[placement.bestIndex],
              position_sophia: true,
            })
            .eq("id", cible.id);
        }
      }
    }

    await supabase
      .from("posts")
      .update({
        pipeline_statut: "done",
        pipeline_etape: null,
        pipeline_erreur: null,
        statut: "assigne",
      })
      .eq("id", post.id);

    // Le sujet est consommé : il ne sera plus proposé comme sujet inédit.
    await supabase.from("sujets").update({ statut: "utilise" }).eq("id", post.sujet_id);

    return "done";
  } catch (error) {
    await supabase
      .from("posts")
      .update({
        pipeline_statut: "failed",
        pipeline_erreur: error instanceof Error ? error.message : String(error),
      })
      .eq("id", post.id);
    return "failed";
  }
}

async function marquer(supabase: Supabase, postId: string, etape: string) {
  await supabase
    .from("posts")
    .update({ pipeline_statut: "running", pipeline_etape: etape })
    .eq("id", postId);
}
