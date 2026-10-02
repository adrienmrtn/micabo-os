/**
 * Effacement sous masque via Fal — `fal-ai/bria/eraser` (02/10/2026).
 *
 * Le pendant Fal de LaMa (`inpaint.ts`) : on donne l'image et un masque
 * (blanc = à effacer), le modèle reconstruit le décor sous le masque et ne
 * touche pas au reste. C'est ce qui permet d'effacer une légende sans
 * effacer le logo ou la copie notée qui sont à côté — le text-removal de
 * l'import, lui, efface tout ce qui ressemble à du texte.
 *
 * Seul fournisseur configuré sur l'Edge : ni `REPLICATE_API_TOKEN` ni
 * `STABILITY_KEY` n'y sont posés, donc `effacerTexte` rend null.
 */

import { falDownloadBytes, falHebergerOctets, falQueueAwaitJson, falQueueSubmit } from "./fal_queue.ts";
import { dimensionsImage, masquePNG, type Zone } from "./inpaint.ts";

const MODELE = "fal-ai/bria/eraser";

/** Efface `zones` (fractions) de l'image et rend les octets du résultat. */
export async function effacerSousMasqueFal(
  imageUrl: string,
  imageBytes: Uint8Array,
  zones: Zone[],
): Promise<Uint8Array> {
  if (zones.length === 0) throw new Error("eraser : aucune zone");
  const dims = dimensionsImage(imageBytes);
  if (!dims) throw new Error("eraser : dimensions illisibles");
  const masque = await masquePNG(dims.w, dims.h, zones);
  const maskUrl = await falHebergerOctets(masque, "image/png", `masque-${Date.now()}.png`);
  const file = await falQueueSubmit(MODELE, { image_url: imageUrl, mask_url: maskUrl, mask_type: "manual" });
  const res = await falQueueAwaitJson(MODELE, file, undefined, 120_000);
  const url = (res.image as { url?: string } | undefined)?.url;
  if (!url) throw new Error(`eraser : pas d'image en sortie ${JSON.stringify(res).slice(0, 200)}`);
  return (await falDownloadBytes(url)).bytes;
}
