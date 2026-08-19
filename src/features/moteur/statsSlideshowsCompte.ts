/**
 * Stats d'import par compte source, pour le filtre Slideshows.
 *
 * « Importé » = une ligne `contenus` rattachée au compte.
 * « Gardé »   = `statut = valide` (pertinence + ELO OK).
 * « Rejeté »  = `statut = rejete`.
 * « En cours » = encore en brouillon (pipeline pas fini).
 */

export interface LigneStatSlideshow {
  compte_reference_id: string | null;
  statut: string;
}

export interface SourceHandle {
  id: string;
  handle_tiktok: string;
}

export interface StatsCompteSlideshows {
  /** null = slideshows orphelins (source déjà oubliée / FK nulle). */
  compteReferenceId: string | null;
  handle: string;
  importes: number;
  gardes: number;
  rejetes: number;
  encours: number;
}

const SANS_COMPTE = "__none__";

export function normaliserHandleSource(handle: string): string {
  return handle.trim().replace(/^@+/, "");
}

export function aggregerStatsSlideshowsParCompte(
  lignes: LigneStatSlideshow[],
  sources: SourceHandle[],
): StatsCompteSlideshows[] {
  const handleParId = new Map<string, string>();
  for (const s of sources) {
    handleParId.set(s.id, normaliserHandleSource(s.handle_tiktok));
  }

  const parCle = new Map<string, StatsCompteSlideshows>();
  const cleDe = (id: string | null) => id ?? SANS_COMPTE;

  for (const l of lignes) {
    const cle = cleDe(l.compte_reference_id);
    let stats = parCle.get(cle);
    if (!stats) {
      stats = {
        compteReferenceId: l.compte_reference_id,
        handle: l.compte_reference_id
          ? (handleParId.get(l.compte_reference_id) ?? "inconnu")
          : "",
        importes: 0,
        gardes: 0,
        rejetes: 0,
        encours: 0,
      };
      parCle.set(cle, stats);
    }
    stats.importes += 1;
    if (l.statut === "valide") stats.gardes += 1;
    else if (l.statut === "rejete") stats.rejetes += 1;
    else stats.encours += 1;
  }

  return [...parCle.values()].sort((a, b) => {
    if (a.compteReferenceId === null) return 1;
    if (b.compteReferenceId === null) return -1;
    return a.handle.localeCompare(b.handle, undefined, { sensitivity: "base" });
  });
}
