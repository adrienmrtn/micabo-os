export const ETAPES_TIMELINE_HM = [
  "contacte",
  "pourparlers",
  "contrat_envoye",
  "contrat_signe",
  "acces_envoyes",
  "integration",
  "job_createur_poste",
] as const;

export const ETAPES_TIMELINE_CREATEUR = [
  "contacte",
  "pourparlers",
  "contrat_signe",
  "integration",
  "tiktok_cree",
  "warmup",
  "premier_post",
] as const;

export type EtapeTimelineHm = (typeof ETAPES_TIMELINE_HM)[number];
export type EtapeTimelineCreateur = (typeof ETAPES_TIMELINE_CREATEUR)[number];
export type EtapeTimelineCle = EtapeTimelineHm | EtapeTimelineCreateur;

/** Qui dit vrai sur une case : l'OS, Slack, ou l'admin qui coche à la main. */
export type SourceVerite = "os" | "slack" | "admin" | "upwork";

export type TimelineCheck = {
  cle: "os" | "slack" | "upwork";
  ok: boolean;
  source: SourceVerite;
  /** L'admin est la source : la pastille se clique au lieu d'être lue. */
  cochable?: boolean;
};

export type TimelineEtape = {
  cle: EtapeTimelineCle;
  ok: boolean;
  source: SourceVerite;
  resume?: string | null;
  /** Dernier message du fil, à afficher tel quel sous Talks. */
  dernierMessage?: string | null;
  dernierMessageAt?: string | null;
  dernierMessageDeNous?: boolean;
  detail?: string | null;
  checks?: TimelineCheck[];
  /** Comme les sous-cases : un clic sur la pastille, pas un interrupteur. */
  cochable?: boolean;
};

export type FaitsApproche = {
  nom?: string | null;
  role: "hm" | "createur";
  statut: "messaged" | "offered" | "hired";
  resume_discussions: string | null;
  dernier_message: string | null;
  dernier_message_at: string | null;
  contrat_envoye_ok: boolean;
  contrat_signe_ok: boolean;
  slack_envoye_ok: boolean;
  email_demande_ok: boolean;
  codes_ok: boolean;
  os_ok: boolean;
  slack_ok: boolean;
  upwork_ajoute_ok: boolean;
  job_createur_poste: boolean;
  tiktok_cree_ok: boolean;
  tiktok_handle: string | null;
  warmup_actif: boolean;
  premier_post_ok: boolean;
};

/**
 * Un vrai message du fil — le dernier, qu'il soit d'eux ou de nous.
 * Pas un résumé, pas un « . » de PDF vide.
 */
export function dernierMessageUtile(texte: string | null | undefined): string | null {
  const propre = nettoyerDernierMessage(texte);
  if (!propre) return null;
  if (propre.replace(/[.\s]/g, "").length < 8) return null;
  return propre;
}

/** Hi Sofia / Bonjour Rose en tête : c'est notre message, pas le leur. */
export function messageDeNous(
  texte: string | null | undefined,
  prenom: string | null | undefined,
): boolean {
  if (!texte?.trim() || !prenom?.trim()) return false;
  const nom = prenom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^(?:bonjour|salut|hi|hey|hello)\\s+${nom}\\b`, "i").test(texte.trim());
}

/** Talks ne se coche que quand on passe au contrat — pas au premier « hi ». */
export function talksTermines(f: Pick<FaitsApproche, "contrat_envoye_ok" | "contrat_signe_ok" | "statut">): boolean {
  return (
    f.contrat_envoye_ok ||
    f.contrat_signe_ok ||
    f.statut === "offered" ||
    f.statut === "hired"
  );
}

function talksPour(f: FaitsApproche): Pick<
  TimelineEtape,
  "resume" | "dernierMessage" | "dernierMessageAt" | "dernierMessageDeNous"
> {
  const dernier = dernierMessageUtile(f.dernier_message);
  const prenom = f.nom?.trim().split(/\s+/)[0] ?? "";
  return {
    resume: f.resume_discussions,
    dernierMessage: dernier,
    dernierMessageAt: dernier ? f.dernier_message_at : null,
    dernierMessageDeNous: Boolean(dernier && messageDeNous(dernier, prenom)),
  };
}

export function timelineHm(f: FaitsApproche): TimelineEtape[] {
  const envoiOk = f.slack_envoye_ok && f.email_demande_ok && f.codes_ok;
  return [
    { cle: "contacte", ok: true, source: "upwork" },
    { cle: "pourparlers", ok: talksTermines(f), source: "upwork", ...talksPour(f) },
    {
      cle: "contrat_envoye",
      ok: f.contrat_envoye_ok,
      source: "admin",
      cochable: true,
    },
    { cle: "contrat_signe", ok: f.contrat_signe_ok, source: "upwork" },
    { cle: "acces_envoyes", ok: envoiOk, source: "admin", cochable: true },
    {
      cle: "integration",
      ok: f.os_ok && f.slack_ok && f.upwork_ajoute_ok,
      source: "os",
      checks: [
        { cle: "os", ok: f.os_ok, source: "os" },
        { cle: "slack", ok: f.slack_ok, source: "slack" },
        { cle: "upwork", ok: f.upwork_ajoute_ok, source: "admin", cochable: true },
      ],
    },
    { cle: "job_createur_poste", ok: f.job_createur_poste, source: "upwork" },
  ];
}

export function timelineCreateur(f: FaitsApproche): TimelineEtape[] {
  return [
    { cle: "contacte", ok: true, source: "upwork" },
    { cle: "pourparlers", ok: talksTermines(f), source: "upwork", ...talksPour(f) },
    { cle: "contrat_signe", ok: f.contrat_signe_ok, source: "upwork" },
    {
      cle: "integration",
      ok: f.os_ok && f.slack_ok,
      source: "os",
      checks: [
        { cle: "os", ok: f.os_ok, source: "os" },
        { cle: "slack", ok: f.slack_ok, source: "slack" },
      ],
    },
    {
      cle: "tiktok_cree",
      ok: f.tiktok_cree_ok,
      source: "os",
      detail: f.tiktok_handle ? `@${f.tiktok_handle.replace(/^@/, "")}` : null,
    },
    { cle: "warmup", ok: f.warmup_actif, source: "os" },
    { cle: "premier_post", ok: f.premier_post_ok, source: "os" },
  ];
}

export function timelinePour(f: FaitsApproche): TimelineEtape[] {
  return f.role === "createur" ? timelineCreateur(f) : timelineHm(f);
}

export function etapeCouranteTimeline(etapes: TimelineEtape[]): EtapeTimelineCle {
  const prochaine = etapes.find((e) => !e.ok);
  return prochaine?.cle ?? etapes[etapes.length - 1]!.cle;
}

/** Étape où l'admin doit envoyer un message HM. Talks tant que le contrat n'est pas parti. */
export function etapePropositionMessage(f: FaitsApproche): EtapeTimelineCle | null {
  if (f.role !== "hm") return null;
  if (!talksTermines(f)) return "pourparlers";
  if (!f.contrat_signe_ok) return "contrat_envoye";
  if (dernierMessageUtile(f.dernier_message)) return "pourparlers";
  return null;
}

/** Combien d'étapes franchies : ce qu'on lit avant de déplier. */
export function avancement(etapes: TimelineEtape[]): { faites: number; total: number } {
  return { faites: etapes.filter((e) => e.ok).length, total: etapes.length };
}

export function nettoyerResume(texte: string | null | undefined, max = 280): string | null {
  if (!texte) return null;
  const propre = texte
    .replace(/<\/?untrusted_participant_content>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!propre) return null;
  return propre.length > max ? `${propre.slice(0, max).trimEnd()}…` : propre;
}

/** Garde les retours à la ligne : c'est le message, pas un résumé. */
export function nettoyerDernierMessage(
  texte: string | null | undefined,
  max = 4000,
): string | null {
  if (!texte) return null;
  const propre = texte
    .replace(/<\/?untrusted_participant_content>/gi, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  if (!propre) return null;
  return propre.length > max ? `${propre.slice(0, max).trimEnd()}…` : propre;
}

export const OBJECTIF_CREATEURS = 10;

export function phase1Terminee(f: FaitsApproche): boolean {
  return f.job_createur_poste;
}

export function phase2Terminee(createursN: number): boolean {
  return createursN >= OBJECTIF_CREATEURS;
}

export function faitsDepuisApproche(a: {
  nom?: string | null;
  role: FaitsApproche["role"];
  statut: FaitsApproche["statut"];
  resume_discussions: string | null;
  dernier_message?: string | null;
  dernier_message_at?: string | null;
  contrat_envoye_ok: boolean;
  contrat_signe_ok: boolean;
  slack_envoye_ok: boolean;
  email_demande_ok: boolean;
  codes_ok: boolean;
  os_ok: boolean;
  slack_ok: boolean;
  upwork_ajoute_ok: boolean;
  job_createur_id?: string | null;
  tiktok_cree_ok?: boolean;
  tiktok_handle?: string | null;
  warmup_actif: boolean;
  premier_post_ok: boolean;
}): FaitsApproche {
  return {
    nom: a.nom ?? null,
    role: a.role,
    statut: a.statut,
    resume_discussions: nettoyerResume(a.resume_discussions),
    dernier_message: nettoyerDernierMessage(a.dernier_message),
    dernier_message_at: a.dernier_message_at ?? null,
    contrat_envoye_ok: a.contrat_envoye_ok,
    contrat_signe_ok: a.contrat_signe_ok,
    slack_envoye_ok: a.slack_envoye_ok,
    email_demande_ok: a.email_demande_ok,
    codes_ok: a.codes_ok,
    os_ok: a.os_ok,
    slack_ok: a.slack_ok,
    upwork_ajoute_ok: a.upwork_ajoute_ok,
    job_createur_poste: Boolean(a.job_createur_id),
    tiktok_cree_ok: Boolean(a.tiktok_cree_ok),
    tiktok_handle: a.tiktok_handle ?? null,
    warmup_actif: a.warmup_actif,
    premier_post_ok: a.premier_post_ok,
  };
}
