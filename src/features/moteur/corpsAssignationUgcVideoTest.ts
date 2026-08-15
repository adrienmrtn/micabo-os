/** Corps POST test assignation UGC VIDEO — `libre` force le compte même inactif / non UGC. */
export function corpsAssignationUgcVideoTest(input: {
  date: string;
  compteId: string;
  jusquA?: "face_ref" | "complet";
  reactionId?: string;
  libre?: boolean;
}): Record<string, unknown> {
  const reactionId = String(input.reactionId ?? "").trim();
  const libre = Boolean(input.libre) || Boolean(reactionId);
  return {
    date: input.date,
    compteId: input.compteId,
    manuel: true,
    test: true,
    stream: true,
    ignorerWarmup: true,
    forcer: true,
    jusquA: input.jusquA === "face_ref" ? "face_ref" : "complet",
    libre,
    ...(reactionId ? { reactionId } : {}),
  };
}

/** Skip is_active / ugc_ai_video : test libre, ou un compte ciblé en test. */
export function ignorerFiltresCompteUgcVideo(opts: {
  test?: boolean;
  compteId?: string | null;
  reactionId?: string | null;
  libre?: boolean;
}): boolean {
  if (opts.libre) return true;
  if (String(opts.reactionId ?? "").trim()) return true;
  return Boolean(opts.test) && Boolean(opts.compteId);
}
