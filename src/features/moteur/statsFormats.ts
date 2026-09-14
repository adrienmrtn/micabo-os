/**
 * Statistiques par format (et croisement label × format).
 *
 * Le format ne joue sur rien dans l'assignation — c'est exactement pour ça
 * qu'il existe : il sert à LIRE ce qui marche, pas à décider. On agrège donc
 * sur les passages réellement publiés et mesurés, jamais sur les assignés.
 *
 * Module pur : l'écran et les tests comptent pareil.
 */

import { indexTier, type Tier } from "./tierlist";

/** Un passage publié, rattaché au slideshow qui l'a produit. */
export interface PassageStat {
  contenuId: string;
  vues: number | null;
  langue: string | null;
  /** Date du créneau (YYYY-MM-DD), pour filtrer une période. */
  jour: string | null;
  /** Repost bonus et posts de test ne comptent nulle part. */
  horsCycle: boolean;
}

export interface ContenuStat {
  id: string;
  formatId: string | null;
  labelIds: string[];
  tier: Tier | null;
  /** Tier d'entrée à l'import, pour mesurer montées et descentes. */
  tierImport: Tier | null;
}

export interface LigneStatsFormat {
  formatId: string | null;
  labelId: string | null;
  slideshows: number;
  passages: number;
  /** Passages publiés ET mesurés (vues renseignées). */
  mesures: number;
  vuesMoyennes: number | null;
  vuesTotales: number;
  /** Répartition des tiers courants : { D: 2, B: 5, … }. */
  tiers: Record<string, number>;
  montees: number;
  descentes: number;
}

function ligneVide(formatId: string | null, labelId: string | null): LigneStatsFormat {
  return {
    formatId,
    labelId,
    slideshows: 0,
    passages: 0,
    mesures: 0,
    vuesMoyennes: null,
    vuesTotales: 0,
    tiers: {},
    montees: 0,
    descentes: 0,
  };
}

export interface FiltresStatsFormat {
  /** Bornes incluses, au format YYYY-MM-DD. */
  depuis?: string | null;
  jusqua?: string | null;
  langue?: string | null;
  /** Croiser par label en plus du format. */
  parLabel?: boolean;
}

function retenu(p: PassageStat, f: FiltresStatsFormat): boolean {
  if (p.horsCycle) return false;
  if (f.langue && p.langue !== f.langue) return false;
  if (f.depuis && (!p.jour || p.jour < f.depuis)) return false;
  if (f.jusqua && (!p.jour || p.jour > f.jusqua)) return false;
  return true;
}

/**
 * Agrège les passages par format, ou par (format, label) si `parLabel`.
 *
 * Un slideshow portant deux labels compte dans les deux lignes : c'est voulu,
 * la question posée est « ce format marche-t-il dans cette niche », pas
 * « comment répartir 100 % ». Le total d'une colonne peut donc dépasser le
 * nombre de passages — il ne faut pas le lire comme une part de marché.
 */
export function agregerStatsFormats(
  contenus: ContenuStat[],
  passages: PassageStat[],
  filtres: FiltresStatsFormat = {},
): LigneStatsFormat[] {
  const parId = new Map(contenus.map((c) => [c.id, c]));
  const lignes = new Map<string, LigneStatsFormat>();
  const vusParLigne = new Map<string, Set<string>>();

  const cles = (c: ContenuStat): Array<[string, string | null, string | null]> => {
    if (!filtres.parLabel) return [[`${c.formatId ?? ""}`, c.formatId, null]];
    if (c.labelIds.length === 0) return [[`${c.formatId ?? ""}|`, c.formatId, null]];
    return c.labelIds.map((l) => [`${c.formatId ?? ""}|${l}`, c.formatId, l]);
  };

  const ligne = (cle: string, formatId: string | null, labelId: string | null) => {
    let l = lignes.get(cle);
    if (!l) {
      l = ligneVide(formatId, labelId);
      lignes.set(cle, l);
      vusParLigne.set(cle, new Set());
    }
    return l;
  };

  // Les slideshows d'abord : une ligne existe même sans passage (un format
  // qu'on vient de poser n'a encore rien produit, et c'est une information).
  for (const c of contenus) {
    for (const [cle, formatId, labelId] of cles(c)) {
      const l = ligne(cle, formatId, labelId);
      const vus = vusParLigne.get(cle)!;
      if (vus.has(c.id)) continue;
      vus.add(c.id);
      l.slideshows += 1;
      if (c.tier) l.tiers[c.tier] = (l.tiers[c.tier] ?? 0) + 1;
      if (c.tier && c.tierImport) {
        const delta = indexTier(c.tier) - indexTier(c.tierImport);
        if (delta > 0) l.montees += 1;
        else if (delta < 0) l.descentes += 1;
      }
    }
  }

  for (const p of passages) {
    if (!retenu(p, filtres)) continue;
    const c = parId.get(p.contenuId);
    if (!c) continue;
    for (const [cle, formatId, labelId] of cles(c)) {
      const l = ligne(cle, formatId, labelId);
      l.passages += 1;
      if (p.vues != null) {
        l.mesures += 1;
        l.vuesTotales += p.vues;
      }
    }
  }

  for (const l of lignes.values()) {
    l.vuesMoyennes = l.mesures > 0 ? l.vuesTotales / l.mesures : null;
  }

  // Les plus performants d'abord ; un format sans mesure ferme la marche.
  return [...lignes.values()].sort((a, b) => {
    if (a.vuesMoyennes == null && b.vuesMoyennes == null) return b.slideshows - a.slideshows;
    if (a.vuesMoyennes == null) return 1;
    if (b.vuesMoyennes == null) return -1;
    return b.vuesMoyennes - a.vuesMoyennes;
  });
}
