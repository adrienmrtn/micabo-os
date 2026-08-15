/** Compte tel qu’affiché dans le test UGC VIDEO libre (tous, même inactifs). */
export type CompteTestLibre = {
  id: string;
  persona_nom: string | null;
  handle_tiktok: string | null;
  langue: string | null;
  is_active: boolean;
  ugc_ai: boolean;
  ugc_ai_video: boolean;
  ugc_persona_id: string | null;
  profiles?: {
    prenom?: string | null;
    nom?: string | null;
  } | null;
};

export type PartiesCompteTestLibre = {
  nom: string;
  actif: boolean;
  ugcVideo: boolean;
  ugcSlideshow: boolean;
  persona: boolean;
  langue: string | null;
};

export function partiesCompteTestLibre(c: CompteTestLibre): PartiesCompteTestLibre {
  const nom =
    c.persona_nom?.trim() ||
    c.handle_tiktok?.trim() ||
    [c.profiles?.prenom, c.profiles?.nom].filter(Boolean).join(" ").trim() ||
    c.id.slice(0, 8);
  return {
    nom,
    actif: Boolean(c.is_active),
    ugcVideo: Boolean(c.ugc_ai_video),
    ugcSlideshow: Boolean(c.ugc_ai) && !c.ugc_ai_video,
    persona: Boolean(c.ugc_persona_id),
    langue: c.langue?.trim() || null,
  };
}

export function libelleCompteTestLibre(
  c: CompteTestLibre,
  labels: {
    actif: string;
    inactif: string;
    ugcVideo: string;
    ugcSlideshow: string;
    pasUgc: string;
    sansPersona: string;
  },
): string {
  const p = partiesCompteTestLibre(c);
  const kind = p.ugcVideo
    ? labels.ugcVideo
    : p.ugcSlideshow
      ? labels.ugcSlideshow
      : labels.pasUgc;
  const flags = [
    p.actif ? labels.actif : labels.inactif,
    kind,
    p.persona ? null : labels.sansPersona,
    p.langue,
  ].filter(Boolean);
  return `${p.nom} · ${flags.join(" · ")}`;
}

/** Actifs UGC VIDEO d’abord, puis actifs, puis le reste — alpha sur le nom. */
export function trierComptesTestLibre<T extends CompteTestLibre>(comptes: T[]): T[] {
  return [...comptes].sort((a, b) => {
    const score = (c: T) => (c.is_active ? 2 : 0) + (c.ugc_ai_video ? 1 : 0);
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return partiesCompteTestLibre(a).nom.localeCompare(
      partiesCompteTestLibre(b).nom,
      undefined,
      { sensitivity: "base" },
    );
  });
}

function normaliserRecherche(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function compteCorrespondFiltre(c: CompteTestLibre, q: string): boolean {
  const needle = normaliserRecherche(q);
  if (!needle) return true;
  const hay = normaliserRecherche(
    [
      c.persona_nom,
      c.handle_tiktok,
      c.langue,
      c.id,
      c.profiles?.prenom,
      c.profiles?.nom,
      c.ugc_ai_video ? "ugc video" : "",
      c.is_active ? "actif" : "inactif",
    ]
      .filter(Boolean)
      .join(" "),
  );
  return hay.includes(needle);
}

export function reactionPretPourFaceSwap(r: {
  statut: string;
  video_source_url?: string | null;
  first_frame_reference_url?: string | null;
  label_id?: string | null;
}): boolean {
  return (
    r.statut === "pret" &&
    Boolean(r.video_source_url?.trim()) &&
    Boolean(r.first_frame_reference_url?.trim()) &&
    Boolean(r.label_id?.trim())
  );
}

export function reactionCorrespondFiltre(
  r: { id: string; titre?: string | null; labelNom?: string | null },
  q: string,
): boolean {
  const needle = normaliserRecherche(q);
  if (!needle) return true;
  const hay = normaliserRecherche([r.titre, r.labelNom, r.id].filter(Boolean).join(" "));
  return hay.includes(needle);
}
