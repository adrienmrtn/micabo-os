/**
 * Récupération des visuels côté poster, pensée pour l'iPhone.
 *
 * Sur iOS, un ZIP atterrit dans Fichiers : il faut le décompresser, puis
 * déplacer chaque image vers Photos avant de pouvoir la poster. La feuille de
 * partage native, elle, propose « Enregistrer les images », qui les dépose
 * directement dans la pellicule. C'est la seule voie confortable sur mobile,
 * donc on la privilégie et le ZIP ne sert plus que de repli sur ordinateur.
 */

import {
  ratioDominant,
  recadrageCible,
  urlVisuelRecadre,
  type DimensionsVisuel,
} from "../../../supabase/functions/_shared/format_visuel.ts";
import { tientEnUnLot } from "./partageLots";

/** iOS exige que `share()` parte du geste de l'utilisateur : les fichiers
 * doivent donc déjà être en mémoire au moment du tap, jamais téléchargés
 * pendant. D'où le préchargement dès l'ouverture du post. */
export async function recupererFichier(url: string, nom: string): Promise<File> {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`Visuel indisponible (${reponse.status})`);
  const blob = await reponse.blob();
  return new File([blob], nom, { type: blob.type || "image/jpeg" });
}

/** Dimensions réelles d'un fichier déjà en mémoire (aucun aller-retour réseau). */
async function dimensionsFichier(fichier: File): Promise<DimensionsVisuel | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(fichier);
      const dims = { largeur: bitmap.width, hauteur: bitmap.height };
      bitmap.close?.();
      return dims;
    } catch {
      // Safari ancien / format exotique : repli sur <img>.
    }
  }
  return await new Promise((resolve) => {
    const href = URL.createObjectURL(fichier);
    const img = new Image();
    const fin = (dims: DimensionsVisuel | null) => {
      URL.revokeObjectURL(href);
      resolve(dims);
    };
    img.onload = () => fin({ largeur: img.naturalWidth, hauteur: img.naturalHeight });
    img.onerror = () => fin(null);
    img.src = href;
  });
}

export interface VisuelATelecharger {
  url: string;
  nom: string;
}

/** Ce qu'on a pu préparer, et ce qui manque — jamais l'un sans l'autre. */
export interface VisuelsPrepares {
  fichiers: File[];
  /** Noms des visuels injoignables. Non vide = le post est incomplet. */
  manquants: string[];
}

/**
 * Récupère les visuels d'un post en les ramenant tous au même format.
 *
 * Le créateur reçoit les fichiers tels qu'il va les poster : c'est ici, et pas
 * à l'affichage, que l'uniformité compte. On mesure les images déjà en
 * mémoire, on retient le ratio dominant, et seules les slides qui s'en écartent
 * repartent en recadrage `cover` côté Storage (voir `format_visuel.ts`).
 *
 * Filet de sécurité, pas garde-fou : un recadrage qui échoue rend l'original
 * plutôt que de priver le créateur de sa photo.
 */
export async function recupererVisuelsUniformises(
  visuels: VisuelATelecharger[],
): Promise<VisuelsPrepares> {
  // Une image injoignable ne doit pas coûter au créateur les onze autres : la
  // boucle était nue, donc un seul 404 rejetait la requête entière, `nbPhotos`
  // tombait à 0 et le bouton se désactivait sans un mot. On garde ce qu'on a —
  // mais le manque REMONTE (`manquants`), parce qu'un post publié avec une
  // slide en moins est pire qu'un échec visible.
  const fichiers: File[] = [];
  const retenus: VisuelATelecharger[] = [];
  const manquants: string[] = [];
  for (const visuel of visuels) {
    try {
      fichiers.push(await recupererFichier(visuel.url, visuel.nom));
      retenus.push(visuel);
    } catch (erreur) {
      console.warn(`Visuel injoignable (${visuel.nom}) :`, erreur);
      manquants.push(visuel.nom);
    }
  }
  if (fichiers.length < 2) return { fichiers, manquants };

  const dims = await Promise.all(fichiers.map(dimensionsFichier));
  const ratio = ratioDominant(
    dims.filter((d): d is DimensionsVisuel => d !== null),
  );
  if (ratio === null) return { fichiers, manquants };

  const uniformises = await Promise.all(
    fichiers.map(async (fichier, i) => {
      const source = dims[i];
      if (!source) return fichier;
      const cible = recadrageCible(source, ratio);
      if (!cible) return fichier;
      const url = urlVisuelRecadre(retenus[i].url, cible);
      if (!url) return fichier;
      try {
        return await recupererFichier(url, fichier.name);
      } catch {
        return fichier;
      }
    }),
  );
  return { fichiers: uniformises, manquants };
}

/**
 * Ce lot peut-il réellement partir dans la feuille de partage ?
 *
 * `navigator.canShare` ne suffit PAS, et c'est tout le défaut du 29/09 : il ne
 * regarde ni le nombre de fichiers ni leur poids, alors que `share()` les
 * refuse ensuite par un « Permission denied » qu'on affichait brut au créateur.
 * On ajoute donc les deux plafonds de Chromium avant de lui demander son avis
 * (voir `partageLots.ts`). Un `canShare` qui dit oui ne prouve rien ; un lot qui
 * passe les plafonds ET `canShare` part.
 */
export function peutPartager(fichiers: File[]): boolean {
  if (fichiers.length === 0) return false;
  if (typeof navigator.canShare !== "function" || typeof navigator.share !== "function") {
    return false;
  }
  if (!tientEnUnLot(fichiers)) return false;
  return navigator.canShare({ files: fichiers });
}

/**
 * Ouvre la feuille de partage. Renvoie `false` si l'utilisateur l'a fermée,
 * pour distinguer un abandon d'une vraie panne.
 */
export async function partagerFichiers(fichiers: File[], titre: string): Promise<boolean> {
  try {
    await navigator.share({ files: fichiers, title: titre });
    return true;
  } catch (erreur) {
    if (erreur instanceof DOMException && erreur.name === "AbortError") return false;
    // Le nom et la charge, avant de relancer : c'est ce qui manquait pour
    // trancher en un jour plutôt qu'en une semaine entre « trop de fichiers »,
    // « trop lourd » et « geste utilisateur perdu », trois causes qui rendent
    // toutes le même « Permission denied ».
    const octets = fichiers.reduce((n, f) => n + f.size, 0);
    console.warn(
      `Partage refusé (${(erreur as Error)?.name ?? "?"}) : ${fichiers.length} fichier(s), ` +
        `${Math.round(octets / 1024 / 1024)} Mo`,
      erreur,
    );
    throw erreur;
  }
}

/** Repli ordinateur : téléchargement classique dans le dossier de l'utilisateur. */
export function telechargerFichier(fichier: File | Blob, nom: string): void {
  const href = URL.createObjectURL(fichier);
  const lien = document.createElement("a");
  lien.href = href;
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(href);
}
