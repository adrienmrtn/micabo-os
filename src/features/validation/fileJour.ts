export interface ItemValidationJour {
  postId: string;
  passageId: string | null;
  compteId: string;
  posterNom: string;
  handle: string | null;
  sourceUrl: string | null;
  titre: string | null;
  langue: string | null;
  type: string;
  statut: string;
  slideshowVide: boolean;
}

export function horsFileValidation(opts: {
  postId: string;
  statut: string;
  ugcAiVideo: boolean;
  deja: ReadonlySet<string>;
}): boolean {
  if (opts.deja.has(opts.postId)) return true;
  if (opts.ugcAiVideo) return true;
  if (opts.statut === "publie") return true;
  return false;
}

export function sourceUrlValidation(opts: {
  passageSource: string | null | undefined;
  sujetSource: string | null | undefined;
}): string | null {
  const a = opts.passageSource?.trim();
  if (a) return a;
  const b = opts.sujetSource?.trim();
  return b || null;
}
