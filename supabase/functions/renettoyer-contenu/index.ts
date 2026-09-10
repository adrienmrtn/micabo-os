import {
  cleanImage,
  mimeDepuisBase64,
  type EvenementEtape,
} from "../_shared/gemini.ts";
import { uniformiserFormatsContenu } from "../_shared/format_media.ts";
import {
  attacherLabelsAuMedia,
  mediaPropreMemeLabel,
} from "../_shared/media_labels.ts";
import { reponseNdjson, veutStream } from "../_shared/nettoyage_etapes.ts";
import {
  patchSlideMediaId,
  propagerMediaAuxPostsAssignes,
  trouverPropreExistant,
} from "../_shared/slide_media.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

/** Patch contenu + propage aux post_slides déjà assignés (texte inchangé). */
async function lierMedia(
  supabase: ReturnType<typeof serviceClient>,
  contenuId: string,
  position: number,
  mediaId: string,
  emit?: (e: Record<string, unknown>) => void,
): Promise<void> {
  await patchSlideMediaId(supabase, contenuId, position, mediaId);
  try {
    const n = await propagerMediaAuxPostsAssignes(
      supabase,
      contenuId,
      position,
      mediaId,
    );
    if (n > 0) {
      emit?.({
        etape: "log",
        statut: "info",
        detail: `propagé vers ${n} post_slide(s) déjà assigné(s)`,
      });
      console.log(
        `[renettoyer-contenu] ${contenuId}#${position}: propagé → ${n} post_slide(s)`,
      );
    }
  } catch (e) {
    console.warn(
      `[renettoyer-contenu] propagation posts ${contenuId}#${position}: ${messageErreur(e)}`,
    );
  }
}

/**
 * Réaligne la slide qu'on vient de refaire sur le format du diaporama.
 * Renvoie l'URL à afficher — l'ancienne si rien n'a bougé.
 */
async function realignerFormat(
  supabase: ReturnType<typeof serviceClient>,
  contenuId: string,
  position: number,
  url: string,
  emit?: (e: Record<string, unknown>) => void,
): Promise<string> {
  try {
    const rapport = await uniformiserFormatsContenu(supabase, contenuId, {
      positions: [position],
    });
    const ligne = rapport.lignes.find((l) => l.position === position);
    if (ligne?.statut !== "recadre") return url;
    emit?.({
      etape: "log",
      statut: "info",
      detail:
        `format aligné ${ligne.avant?.largeur}×${ligne.avant?.hauteur} → ` +
        `${ligne.apres?.largeur}×${ligne.apres?.hauteur}`,
    });
    const { data } = await supabase
      .from("media_library")
      .select("url")
      .eq("id", ligne.mediaId)
      .maybeSingle();
    return (data?.url as string | undefined) ?? url;
  } catch (e) {
    console.warn(`[renettoyer-contenu] format ${contenuId}#${position}: ${messageErreur(e)}`);
    return url;
  }
}

const BUCKET = "medias";

/**
 * Re-nettoie UNE slide d'un contenu v-next (structure_slides), à la demande.
 * Pipeline : Fal → Replicate text-removal → C2PA (`cleanImage`).
 *
 *   { contenuId, position, stream?: true }
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  let corps: { contenuId?: string; position?: number; stream?: boolean } = {};
  try {
    corps = await request.json();
  } catch {
    // corps vide
  }
  const contenuId = corps.contenuId ?? null;
  const position = Number(corps.position);
  if (!contenuId || !Number.isFinite(position)) {
    return json({ error: "contenuId et position requis" }, 400);
  }

  const stream = veutStream(request, corps);

  const executer = async (
    emit?: (e: Record<string, unknown>) => void,
  ) => {
    const { data: contenu } = await supabase
      .from("contenus")
      .select("id, compte_reference_id, langue_source, structure_slides")
      .eq("id", contenuId)
      .single();
    if (!contenu) {
      emit?.({ etape: "ready", statut: "echec", detail: "contenu introuvable" });
      return { ok: false as const, nettoyee: false, motif: "contenu introuvable" };
    }

    const slides = [...((contenu.structure_slides ?? []) as Array<{
      position: number;
      media_id?: string | null;
      raw_url?: string | null;
      reference_url?: string | null;
    }>)];
    const idx = slides.findIndex((s) => s.position === position);
    if (idx < 0) {
      emit?.({ etape: "ready", statut: "echec", detail: "slide introuvable" });
      return { ok: false as const, nettoyee: false, motif: "slide introuvable" };
    }
    const slide = slides[idx]!;
    const sourceUrl = slide.raw_url ?? slide.reference_url;
    if (!sourceUrl) {
      emit?.({ etape: "ready", statut: "echec", detail: "pas d'URL source" });
      return { ok: false as const, nettoyee: false, motif: "pas d'URL source" };
    }

    try {
      const onEtape = emit ? (e: EvenementEtape) => emit(e) : undefined;
      // Même recette que l'import, upscale compris : sans lui la slide
      // re-nettoyée sortait à la moitié de la taille de ses voisines.
      const propre = await cleanImage(sourceUrl, onEtape, { upscaleAvantStrip: true });

      // Pas de résultat provider → réutiliser un propre orphelin, sinon biblio.
      if (!propre?.base64) {
        const orphelin = await trouverPropreExistant(supabase, contenu.id, position);
        if (orphelin) {
          await lierMedia(supabase, contenu.id, position, orphelin.id, emit);
          emit?.({
            etape: "ready",
            statut: "ok",
            ok: true,
            nettoyee: true,
            mediaId: orphelin.id,
            url: orphelin.url,
            detail: "propre orphelin rattache (Fal/Replicate sans bytes)",
          });
          return {
            ok: true as const,
            nettoyee: true,
            mediaId: orphelin.id,
            url: orphelin.url,
            motif: "propre orphelin rattache",
          };
        }
        const exclus = slides
          .map((s) => s.media_id)
          .filter((id): id is string => Boolean(id));
        const alt = await mediaPropreMemeLabel(supabase, {
          contenuId: contenu.id,
          excludeMediaIds: exclus,
          compteReferenceId: contenu.compte_reference_id,
        });
        if (alt) {
          await lierMedia(supabase, contenu.id, position, alt.id, emit);
          emit?.({
            etape: "ready",
            statut: "ok",
            ok: true,
            nettoyee: false,
            remplacee: true,
            mediaId: alt.id,
            url: alt.url,
            detail: "nettoyage vide → remplacé (même label)",
          });
          return {
            ok: true as const,
            nettoyee: false,
            remplacee: true,
            mediaId: alt.id,
            url: alt.url,
            motif: "nettoyage vide → remplacé (même label)",
          };
        }
        emit?.({
          etape: "ready",
          statut: "echec",
          detail: "aucune image renvoyée",
        });
        return { ok: false as const, nettoyee: false, motif: "aucune image renvoyée" };
      }

      // verifyClean en pause — stocke directement le résultat Fal/Replicate.
      const { mime, ext } = mimeDepuisBase64(propre.base64, propre.mime);
      const path = `propre/${contenu.id}/${slide.position}.${ext}`;
      const bytes = Uint8Array.from(atob(propre.base64), (c) => c.charCodeAt(0));
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, {
          contentType: mime,
          upsert: true,
          cacheControl: "0",
        });
      if (upErr) throw upErr;

      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const url = `${publicUrl}?v=${Date.now()}`;
      const { data: media, error: insErr } = await supabase
        .from("media_library")
        .upsert(
          {
            compte_reference_id: contenu.compte_reference_id,
            contenu_id: contenu.id,
            storage_path: path,
            url,
            source: "nettoye_reference",
            langue: contenu.langue_source,
            visage_identifiable: null,
            verifie_le: new Date().toISOString(),
            texte_restant: false,
          },
          { onConflict: "storage_path" },
        )
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Patch atomique AVANT labels — le lien slide→propre ne doit plus se perdre.
      // Propage aussi aux post_slides déjà assignés (futurs assignements lisent structure_slides).
      await lierMedia(supabase, contenu.id, position, media.id, emit);
      try {
        await attacherLabelsAuMedia(supabase, media.id, contenu.id);
      } catch (labErr) {
        console.warn(
          `[renettoyer-contenu] labels ${contenuId}#${position}: ${messageErreur(labErr)}`,
        );
      }

      // Le text-removal recale sa sortie sur ses propres paliers : la slide
      // refaite peut revenir dans un autre ratio que ses voisines. On ne
      // réaligne qu'elle, le ratio dominant étant lu sur tout le diaporama.
      // Échec non bloquant : la slide est déjà liée et publiable.
      const urlFinale = await realignerFormat(supabase, contenu.id, position, url, emit);

      emit?.({
        etape: "ready",
        statut: "ok",
        ok: true,
        nettoyee: true,
        moteur: propre.moteur,
        mediaId: media.id,
        url: urlFinale,
      });
      return {
        ok: true as const,
        nettoyee: true,
        moteur: propre.moteur,
        mediaId: media.id,
        url: urlFinale,
        etapes: propre.etapes,
      };
    } catch (error) {
      const msg = messageErreur(error);
      console.warn(`[renettoyer-contenu] ${contenuId}#${position}: ${msg}`);
      // Si l'upload a réussi malgré l'erreur aval, rattacher le propre.
      try {
        const orphelin = await trouverPropreExistant(supabase, contenu.id, position);
        if (orphelin) {
          await lierMedia(supabase, contenu.id, position, orphelin.id, emit);
          emit?.({
            etape: "ready",
            statut: "ok",
            ok: true,
            nettoyee: true,
            mediaId: orphelin.id,
            url: orphelin.url,
            detail: `recupere apres erreur: ${msg}`,
          });
          return {
            ok: true as const,
            nettoyee: true,
            mediaId: orphelin.id,
            url: orphelin.url,
            motif: `recupere apres erreur: ${msg}`,
          };
        }
      } catch {
        // ignore
      }
      emit?.({ etape: "ready", statut: "echec", detail: msg });
      return { ok: false as const, nettoyee: false, motif: msg };
    }
  };

  if (stream) {
    return reponseNdjson(async (emit) => {
      await executer(emit);
    });
  }

  try {
    return json(await executer());
  } catch (error) {
    return json({ ok: false, nettoyee: false, erreur: messageErreur(error) }, 500);
  }
});
