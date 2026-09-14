/**
 * Règles du relevé des stats, côté lecture.
 *
 * Miroir front de `_shared/rattrapage_elo.ts` : l'écran doit dire la même
 * chose que le moteur sur « ce passage a-t-il été mesuré, et sinon pourquoi ».
 */

/** Un post scrapé plus tôt n'est pas encore indexé par TikTok. */
export const DELAI_MIN_RELEVE_MS = 45 * 60_000;

export type EtatReleve = "mesure" | "trop_recent" | "manquant" | "non_publie";

export interface LigneReleve {
  statut: string;
  publie_at: string | null;
  vues: number | null;
  stats_maj_at?: string | null;
}

/**
 * Pourquoi un passage n'a pas de vues.
 *
 * La distinction compte : un passage `assigne` n'a rien à mesurer, et un post
 * publié il y a dix minutes n'est pas un raté. Les afficher pareil donnait
 * l'impression que le relevé était cassé alors que, sur 220 passages, 68
 * n'étaient tout simplement pas publiés.
 */
export function etatReleve(ligne: LigneReleve, maintenant = Date.now()): EtatReleve {
  if (ligne.statut !== "publie") return "non_publie";
  if (ligne.vues != null) return "mesure";
  const publie = ligne.publie_at ? Date.parse(ligne.publie_at) : NaN;
  if (Number.isFinite(publie) && maintenant - publie < DELAI_MIN_RELEVE_MS) {
    return "trop_recent";
  }
  return "manquant";
}

export interface ResumeReleves {
  publies: number;
  mesures: number;
  manquants: number;
  tropRecents: number;
  nonPublies: number;
}

export function resumerReleves(lignes: LigneReleve[], maintenant = Date.now()): ResumeReleves {
  const out: ResumeReleves = {
    publies: 0,
    mesures: 0,
    manquants: 0,
    tropRecents: 0,
    nonPublies: 0,
  };
  for (const l of lignes) {
    switch (etatReleve(l, maintenant)) {
      case "mesure":
        out.publies += 1;
        out.mesures += 1;
        break;
      case "manquant":
        out.publies += 1;
        out.manquants += 1;
        break;
      case "trop_recent":
        out.publies += 1;
        out.tropRecents += 1;
        break;
      case "non_publie":
        out.nonPublies += 1;
        break;
    }
  }
  return out;
}
