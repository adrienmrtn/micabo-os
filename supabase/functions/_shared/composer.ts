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
}

/**
 * Compose un post à partir d'un sujet préparé : traduit tout le deck d'une
 * traite (seule façon de tenir la persona et le genre d'une slide à l'autre),
 * puis place l'appli Sophia sur l'une des slides.
 *
 * Renvoie l'id du post créé.
 */
export async function composerPost(
  supabase: Supabase,
  demande: DemandeComposition,
): Promise<string> {
  const { data: sujet, error: sujetErreur } = await supabase
    .from("sujets")
    .select("*")
    .eq("id", demande.sujetId)
    .single();
  if (sujetErreur || !sujet) throw new Error("Sujet introuvable");
  if (sujet.preparation_statut !== "done") throw new Error("Sujet pas encore préparé");

  const { data: compte, error: compteErreur } = await supabase
    .from("comptes")
    .select("*")
    .eq("id", demande.compteId)
    .single();
  if (compteErreur || !compte) throw new Error("Compte introuvable");

  const slides: Slide[] = sujet.structure_slides ?? [];
  if (slides.length === 0) throw new Error("Sujet sans visuel");

  const { data: post, error: postErreur } = await supabase
    .from("posts")
    .insert({
      compte_id: compte.id,
      sujet_id: sujet.id,
      type: demande.type,
      statut: "brouillon",
      date_publication_prevue: demande.date,
      musique_url: sujet.musique_url,
      musique_titre: sujet.musique_titre,
      musique_plateforme: sujet.musique_plateforme,
      pipeline_statut: "running",
      pipeline_etape: "traduction",
    })
    .select()
    .single();
  if (postErreur || !post) throw postErreur ?? new Error("Création du post échouée");

  try {
    // 1 — traduction de tout le deck. Le style_profile du compte s'ajoute aux
    // règles générales : c'est ce qui donne sa voix propre à chaque compte.
    const regles = [
      await chargerPrompt(supabase, "traduction"),
      compte.style_profile ? `Voix propre à ce compte :\n${compte.style_profile}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const traductions = await translateSlideshow({
      slides: slides.map((s) => ({ position: s.position, original: s.texte_original ?? "" })),
      sourceTitle: sujet.titre ?? "",
      rules: regles || undefined,
    });
    const parPosition = new Map(traductions.map((t) => [t.position, t.translated]));

    const textes: Array<{
      position: number;
      texte: string;
      media_id: string | null;
      sophia: boolean;
    }> = slides.map((s) => ({
      position: s.position,
      texte: parPosition.get(s.position) ?? "",
      media_id: s.media_id,
      sophia: false,
    }));

    // 2 — placement de l'appli Sophia sur l'une des slides.
    await supabase
      .from("posts")
      .update({ pipeline_etape: "placement_sophia" })
      .eq("id", post.id);

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
      slides: textes.map((t) => ({ position: t.position, text: t.texte })),
      caption: sujet.titre ?? "",
    });

    if (placement) {
      const cible = textes.find((t) => t.position === placement.chosenPosition);
      if (cible) {
        cible.texte = placement.variants[placement.bestIndex];
        cible.sophia = true;
      }
    }

    // 3 — les slides du post.
    await supabase.from("post_slides").insert(
      textes.map((t) => ({
        post_id: post.id,
        position: t.position,
        media_id: t.media_id,
        texte_overlay: t.texte,
        position_sophia: t.sophia,
      })),
    );

    await supabase
      .from("posts")
      .update({ pipeline_statut: "done", pipeline_etape: null, pipeline_erreur: null })
      .eq("id", post.id);

    // Le sujet est consommé : on ne le repropose pas pour ce compte.
    await supabase.from("sujets").update({ statut: "utilise" }).eq("id", sujet.id);

    return post.id;
  } catch (error) {
    await supabase
      .from("posts")
      .update({
        pipeline_statut: "failed",
        pipeline_erreur: error instanceof Error ? error.message : String(error),
      })
      .eq("id", post.id);
    throw error;
  }
}
