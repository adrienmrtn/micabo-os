export const ETAPES_TIMELINE_HM = [
  "contacte",
  "pourparlers",
  "contrat_envoye",
  "contrat_signe",
  "onboarding_envoi",
  "onboarding_rejoint",
  "job_createur_poste",
] as const;

export const ETAPES_TIMELINE_CREATEUR = [
  "contacte",
  "pourparlers",
  "contrat_envoye",
  "contrat_signe",
  "onboarding_envoi",
  "onboarding_rejoint",
  "warmup",
  "premier_post",
] as const;

export type EtapeTimelineHm = (typeof ETAPES_TIMELINE_HM)[number];
export type EtapeTimelineCreateur = (typeof ETAPES_TIMELINE_CREATEUR)[number];
export type EtapeTimelineCle = EtapeTimelineHm | EtapeTimelineCreateur;

export type TimelineCheck = {
  cle: "os" | "slack" | "upwork";
  ok: boolean;
};

export type TimelineEtape = {
  cle: EtapeTimelineCle;
  ok: boolean;
  resume?: string | null;
  checks?: TimelineCheck[];
};

export type FaitsApproche = {
  role: "hm" | "createur";
  statut: "messaged" | "hired";
  resume_discussions: string | null;
  contrat_envoye_ok: boolean;
  contrat_signe_ok: boolean;
  slack_envoye_ok: boolean;
  email_demande_ok: boolean;
  codes_ok: boolean;
  os_ok: boolean;
  slack_ok: boolean;
  upwork_ajoute_ok: boolean;
  job_createur_poste: boolean;
  warmup_actif: boolean;
  premier_post_ok: boolean;
};

function aParle(f: FaitsApproche): boolean {
  return Boolean(f.resume_discussions?.trim()) || f.statut === "hired" || f.contrat_envoye_ok;
}

export function timelineHm(f: FaitsApproche): TimelineEtape[] {
  const envoiOk = f.slack_envoye_ok && f.email_demande_ok && f.codes_ok;
  return [
    { cle: "contacte", ok: true },
    { cle: "pourparlers", ok: aParle(f), resume: f.resume_discussions },
    { cle: "contrat_envoye", ok: f.contrat_envoye_ok },
    { cle: "contrat_signe", ok: f.contrat_signe_ok },
    { cle: "onboarding_envoi", ok: envoiOk },
    {
      cle: "onboarding_rejoint",
      ok: f.os_ok && f.slack_ok && f.upwork_ajoute_ok,
      checks: [
        { cle: "os", ok: f.os_ok },
        { cle: "slack", ok: f.slack_ok },
        { cle: "upwork", ok: f.upwork_ajoute_ok },
      ],
    },
    { cle: "job_createur_poste", ok: f.job_createur_poste },
  ];
}

export function timelineCreateur(f: FaitsApproche): TimelineEtape[] {
  const envoiOk = f.slack_envoye_ok && f.codes_ok;
  return [
    { cle: "contacte", ok: true },
    { cle: "pourparlers", ok: aParle(f), resume: f.resume_discussions },
    { cle: "contrat_envoye", ok: f.contrat_envoye_ok },
    { cle: "contrat_signe", ok: f.contrat_signe_ok },
    { cle: "onboarding_envoi", ok: envoiOk },
    {
      cle: "onboarding_rejoint",
      ok: f.os_ok && f.slack_ok,
      checks: [
        { cle: "os", ok: f.os_ok },
        { cle: "slack", ok: f.slack_ok },
      ],
    },
    { cle: "warmup", ok: f.warmup_actif },
    { cle: "premier_post", ok: f.premier_post_ok },
  ];
}

export function timelinePour(f: FaitsApproche): TimelineEtape[] {
  return f.role === "createur" ? timelineCreateur(f) : timelineHm(f);
}

export function etapeCouranteTimeline(etapes: TimelineEtape[]): EtapeTimelineCle {
  const prochaine = etapes.find((e) => !e.ok);
  return prochaine?.cle ?? etapes[etapes.length - 1]!.cle;
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

export function faitsDepuisApproche(a: {
  role: FaitsApproche["role"];
  statut: FaitsApproche["statut"];
  resume_discussions: string | null;
  contrat_envoye_ok: boolean;
  contrat_signe_ok: boolean;
  slack_envoye_ok: boolean;
  email_demande_ok: boolean;
  codes_ok: boolean;
  os_ok: boolean;
  slack_ok: boolean;
  upwork_ajoute_ok: boolean;
  job_createur_id?: string | null;
  warmup_actif: boolean;
  premier_post_ok: boolean;
}): FaitsApproche {
  return {
    role: a.role,
    statut: a.statut,
    resume_discussions: nettoyerResume(a.resume_discussions),
    contrat_envoye_ok: a.contrat_envoye_ok,
    contrat_signe_ok: a.contrat_signe_ok,
    slack_envoye_ok: a.slack_envoye_ok,
    email_demande_ok: a.email_demande_ok,
    codes_ok: a.codes_ok,
    os_ok: a.os_ok,
    slack_ok: a.slack_ok,
    upwork_ajoute_ok: a.upwork_ajoute_ok,
    job_createur_poste: Boolean(a.job_createur_id),
    warmup_actif: a.warmup_actif,
    premier_post_ok: a.premier_post_ok,
  };
}
