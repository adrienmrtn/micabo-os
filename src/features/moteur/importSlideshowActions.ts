/** Actions admin sur un slideshow importé (forçage ELO, file bloquée). */

export function peutForcerImportElo(c: {
  statut?: string | null;
  import_etape?: string | null;
}): boolean {
  return c.statut === "rejete" || c.import_etape === "elo_insuffisant";
}

export function estImportPipelineActif(c: {
  statut?: string | null;
  import_statut?: string | null;
}): boolean {
  if (c.statut === "valide" || c.statut === "rejete") return false;
  return (
    c.import_statut === "pending" ||
    c.import_statut === "running" ||
    c.import_statut === "failed"
  );
}

/** Après un pas non terminal, le contenu n'est plus « running » — il attend le suivant. */
export function statutApresPasImport(etape: string): "pending" | null {
  if (
    etape === "done" ||
    etape === "rejete" ||
    etape === "elo_insuffisant" ||
    etape === "failed"
  ) {
    return null;
  }
  return "pending";
}
