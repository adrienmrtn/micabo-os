/**
 * Uniformisation du format des visuels d'un slideshow, côté serveur.
 *
 * Le recadrage lui-même est fait par le transformateur d'images de Storage
 * (`/render/image/`) : décoder puis réencoder une image de 4 MP dans une Edge
 * Function, c'est le mur mémoire (`WORKER_RESOURCE_LIMIT`) assuré — le même
 * qui a déjà imposé le JPEG au SeedVR. Ici on ne fait que demander l'image
 * recadrée et la réécrire par-dessus l'originale.
 *
 * Le fichier est réécrit **sur son propre `storage_path`** : `trouverPropreExistant`
 * cherche le préfixe `propre/<contenu>/<position>.`, donc un chemin suffixé
 * casserait la reprise d'import. D'où le `format=origin` de `urlVisuelRecadre`,
 * qui garantit que l'extension reste vraie.
 *
 * Corollaire : on ne réécrit **que** les visuels de ce contenu. Une slide
 * garnie depuis la biblio du label (`mediaPropreMemeLabel`,
 * `resoudreVisuelsAssignation`) appartient à un autre slideshow, et la
 * recadrer ici la déformerait aussi là-bas. Ces emprunts sont donc laissés
 * intacts et rattrapés à la livraison, côté poster, où le recadrage ne touche
 * que le fichier remis au créateur.
 *
 * Le `brut/` n'est jamais touché : un ré-import reconstruit toujours tout.
 */

import {
  ratioDominant,
  ratioVisuel,
  recadrageCible,
  urlVisuelRecadre,
  type DimensionsVisuel,
} from "./format_visuel.ts";
import { dimensionsImage } from "./inpaint.ts";
import { messageErreur, serviceClient } from "./supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

const BUCKET = "medias";
/** L'en-tête JPEG/PNG porte largeur et hauteur : inutile de tirer l'image entière. */
const OCTETS_ENTETE = 64 * 1024;

export interface LigneFormatVisuel {
  position: number;
  mediaId: string;
  /** `emprunte` : visuel d'un autre slideshow, aligné à la livraison seulement. */
  statut: "recadre" | "deja" | "emprunte" | "echec";
  avant?: DimensionsVisuel;
  apres?: DimensionsVisuel;
  motif?: string;
}

export interface RapportFormatVisuel {
  contenuId: string;
  /** Ratio retenu pour tout le slideshow (`null` = rien de mesurable). */
  ratio: number | null;
  recadrees: number;
  lignes: LigneFormatVisuel[];
}

/** Dimensions d'une image distante, sans la télécharger en entier. */
export async function dimensionsVisuelDistant(
  url: string,
): Promise<DimensionsVisuel | null> {
  const lire = async (entier: boolean): Promise<Uint8Array | null> => {
    try {
      const reponse = await fetch(
        url,
        entier ? undefined : { headers: { Range: `bytes=0-${OCTETS_ENTETE - 1}` } },
      );
      if (!reponse.ok) return null;
      return new Uint8Array(await reponse.arrayBuffer());
    } catch {
      return null;
    }
  };

  // Un serveur qui ignore `Range` renvoie tout : les dimensions se lisent
  // pareil. On ne retire l'image entière que si l'en-tête n'a pas suffi.
  for (const entier of [false, true]) {
    const bytes = await lire(entier);
    const dims = bytes ? dimensionsImage(bytes) : null;
    if (dims && dims.w > 0 && dims.h > 0) {
      return { largeur: dims.w, hauteur: dims.h };
    }
  }
  return null;
}

function mimeAttendu(storagePath: string): string | null {
  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

interface MediaSlide {
  position: number;
  mediaId: string;
  url: string;
  storagePath: string;
}

/**
 * Ramène toutes les slides d'un contenu au ratio dominant du slideshow.
 *
 * `positions` restreint les slides **réécrites** — le ratio dominant, lui, est
 * toujours calculé sur l'ensemble. C'est ce qui permet à un re-nettoyage
 * d'aligner la seule slide qu'il vient de refaire sur ses voisines, sans
 * repayer un recadrage pour tout le diaporama.
 */
export async function uniformiserFormatsContenu(
  supabase: Supabase,
  contenuId: string,
  opts?: { positions?: number[] },
): Promise<RapportFormatVisuel> {
  const vide: RapportFormatVisuel = {
    contenuId,
    ratio: null,
    recadrees: 0,
    lignes: [],
  };

  const { data: contenu } = await supabase
    .from("contenus")
    .select("id, structure_slides")
    .eq("id", contenuId)
    .maybeSingle();
  if (!contenu) return vide;

  const slides = ((contenu.structure_slides ?? []) as Array<{
    position?: number;
    media_id?: string | null;
  }>)
    .map((s) => ({ position: Number(s.position), mediaId: s.media_id ?? null }))
    .filter((s) => Number.isFinite(s.position) && Boolean(s.mediaId));
  if (slides.length < 2) return vide;

  const { data: medias } = await supabase
    .from("media_library")
    .select("id, url, storage_path")
    .in("id", slides.map((s) => s.mediaId as string));
  const parId = new Map(
    (medias ?? []).map((m) => [
      m.id as string,
      { url: m.url as string, storagePath: m.storage_path as string },
    ]),
  );

  const cibles: MediaSlide[] = [];
  for (const s of slides) {
    const media = parId.get(s.mediaId as string);
    if (!media) continue;
    cibles.push({
      position: s.position,
      mediaId: s.mediaId as string,
      url: media.url,
      storagePath: media.storagePath,
    });
  }
  if (cibles.length < 2) return vide;

  const dims = await Promise.all(
    cibles.map((c) => dimensionsVisuelDistant(c.url)),
  );
  const ratio = ratioDominant(
    dims.filter((d): d is DimensionsVisuel => d !== null),
  );
  if (ratio === null) return vide;

  const aReecrire = opts?.positions ? new Set(opts.positions) : null;
  const lignes: LigneFormatVisuel[] = [];
  let recadrees = 0;

  for (const [i, cible] of cibles.entries()) {
    const source = dims[i];
    if (!source) {
      lignes.push({
        position: cible.position,
        mediaId: cible.mediaId,
        statut: "echec",
        motif: "dimensions illisibles",
      });
      continue;
    }
    if (aReecrire && !aReecrire.has(cible.position)) continue;

    if (!cible.storagePath.startsWith(`propre/${contenuId}/`)) {
      lignes.push({
        position: cible.position,
        mediaId: cible.mediaId,
        statut: "emprunte",
        avant: source,
        motif: "visuel d'un autre slideshow — aligné à la livraison",
      });
      continue;
    }

    const recadre = recadrageCible(source, ratio);
    if (!recadre) {
      lignes.push({
        position: cible.position,
        mediaId: cible.mediaId,
        statut: "deja",
        avant: source,
      });
      continue;
    }

    try {
      lignes.push(await reecrireVisuel(supabase, cible, source, recadre));
      recadrees += 1;
    } catch (error) {
      lignes.push({
        position: cible.position,
        mediaId: cible.mediaId,
        statut: "echec",
        avant: source,
        motif: messageErreur(error),
      });
    }
  }

  return { contenuId, ratio, recadrees, lignes };
}

async function reecrireVisuel(
  supabase: Supabase,
  cible: MediaSlide,
  avant: DimensionsVisuel,
  recadre: DimensionsVisuel,
): Promise<LigneFormatVisuel> {
  const echec = (motif: string): LigneFormatVisuel => ({
    position: cible.position,
    mediaId: cible.mediaId,
    statut: "echec",
    avant,
    motif,
  });

  const urlRecadree = urlVisuelRecadre(cible.url, recadre);
  if (!urlRecadree) return echec("visuel hors Storage public");

  const mime = mimeAttendu(cible.storagePath);
  if (!mime) return echec(`extension inconnue (${cible.storagePath})`);

  const reponse = await fetch(urlRecadree);
  if (!reponse.ok) {
    return echec(`recadrage ${reponse.status}: ${(await reponse.text()).slice(0, 200)}`);
  }
  const bytes = new Uint8Array(await reponse.arrayBuffer());

  // Le transformateur refuse d'agrandir et renverrait alors un ratio faux :
  // on relit la sortie plutôt que de croire la demande sur parole.
  const obtenu = dimensionsImage(bytes);
  if (!obtenu) return echec("sortie du recadrage illisible");
  const apres = { largeur: obtenu.w, hauteur: obtenu.h };
  if (Math.abs(ratioVisuel(apres) - ratioVisuel(recadre)) > 0.005) {
    return echec(
      `recadrage hors cible (${apres.largeur}×${apres.hauteur} au lieu de ` +
        `${recadre.largeur}×${recadre.hauteur})`,
    );
  }

  // Même chemin : les posts déjà assignés pointent sur ce media_id et suivent
  // sans qu'on ait à toucher à `post_slides`.
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(cible.storagePath, bytes, {
      contentType: mime,
      upsert: true,
      cacheControl: "0",
    });
  if (upErr) throw upErr;

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(cible.storagePath)
    .data.publicUrl;
  const { error: majErr } = await supabase
    .from("media_library")
    .update({ url: `${publicUrl}?v=${Date.now()}` })
    .eq("id", cible.mediaId);
  if (majErr) throw majErr;

  return {
    position: cible.position,
    mediaId: cible.mediaId,
    statut: "recadre",
    avant,
    apres,
  };
}
