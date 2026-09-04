export const ETAPES_MISSION = ["job", "invites", "questions", "contrat"] as const;
export const ETAPES_HM = [
  "job",
  "invites",
  "questions",
  "contrat",
  "slack",
  "codes",
  "os",
  "createurs",
] as const;

export type EtapeCle = (typeof ETAPES_HM)[number];

export type EtapePipeline = {
  cle: EtapeCle;
  fait: boolean;
  at: string | null;
  detail: string;
  heuresDepuisPrev: number | null;
};

export type FaitsMission = {
  created_time: string | null;
  applicants: number;
  invites_sent: number;
  messaged: number;
  hired: number;
  langue: string | null;
  famille: "hm" | "createur" | "autre";
};

export type FaitsHm = {
  nom: string;
  langue: string | null;
  job_poste_at: string | null;
  invites_sent: number;
  messaged: number;
  contrat_at: string | null;
  slack_ok: boolean;
  slack_at: string | null;
  codes_at: string | null;
  os_connecte_at: string | null;
  createurs_n: number;
};

function heuresEntre(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.max(0, (db - da) / 3_600_000);
}

function annoterDurees(etapes: EtapePipeline[]): EtapePipeline[] {
  let prevAt: string | null = null;
  return etapes.map((e) => {
    const heuresDepuisPrev = e.fait ? heuresEntre(prevAt, e.at) : null;
    if (e.fait && e.at) prevAt = e.at;
    return { ...e, heuresDepuisPrev };
  });
}

export function pipelineMission(f: FaitsMission): EtapePipeline[] {
  const jobFait = Boolean(f.created_time);
  const invitesFait = f.invites_sent > 0;
  const questionsFait = f.messaged > 0;
  const contratFait = f.hired > 0;
  return annoterDurees([
    {
      cle: "job",
      fait: jobFait,
      at: f.created_time,
      detail: "",
      heuresDepuisPrev: null,
    },
    {
      cle: "invites",
      fait: invitesFait,
      at: null,
      detail: String(f.invites_sent),
      heuresDepuisPrev: null,
    },
    {
      cle: "questions",
      fait: questionsFait,
      at: null,
      detail: String(f.messaged),
      heuresDepuisPrev: null,
    },
    {
      cle: "contrat",
      fait: contratFait,
      at: null,
      detail: String(f.hired),
      heuresDepuisPrev: null,
    },
  ]);
}

export function pipelineHm(f: FaitsHm): EtapePipeline[] {
  return annoterDurees([
    {
      cle: "job",
      fait: Boolean(f.job_poste_at),
      at: f.job_poste_at,
      detail: "",
      heuresDepuisPrev: null,
    },
    {
      cle: "invites",
      fait: f.invites_sent > 0,
      at: null,
      detail: String(f.invites_sent),
      heuresDepuisPrev: null,
    },
    {
      cle: "questions",
      fait: f.messaged > 0,
      at: null,
      detail: String(f.messaged),
      heuresDepuisPrev: null,
    },
    {
      cle: "contrat",
      fait: Boolean(f.contrat_at),
      at: f.contrat_at,
      detail: "",
      heuresDepuisPrev: null,
    },
    {
      cle: "slack",
      fait: f.slack_ok,
      at: f.slack_ok ? f.slack_at : null,
      detail: f.slack_ok ? "ok" : "absent",
      heuresDepuisPrev: null,
    },
    {
      cle: "codes",
      fait: Boolean(f.codes_at),
      at: f.codes_at,
      detail: "",
      heuresDepuisPrev: null,
    },
    {
      cle: "os",
      fait: Boolean(f.os_connecte_at),
      at: f.os_connecte_at,
      detail: "",
      heuresDepuisPrev: null,
    },
    {
      cle: "createurs",
      fait: f.createurs_n > 0,
      at: null,
      detail: String(f.createurs_n),
      heuresDepuisPrev: null,
    },
  ]);
}

export function etapeCourante(etapes: EtapePipeline[]): EtapeCle {
  const prochaine = etapes.find((e) => !e.fait);
  return prochaine?.cle ?? etapes[etapes.length - 1]!.cle;
}

const LIBELLE_ETAPE: Record<EtapeCle, { fr: string; en: string }> = {
  job: { fr: "poster le job", en: "post the job" },
  invites: { fr: "inviter", en: "invite" },
  questions: { fr: "phase questions", en: "questions" },
  contrat: { fr: "contrat", en: "contract" },
  slack: { fr: "ajouter sur Slack", en: "add to Slack" },
  codes: { fr: "envoyer les codes OS", en: "send OS codes" },
  os: { fr: "première connexion OS", en: "first OS login" },
  createurs: { fr: "rattacher des créateurs", en: "attach creators" },
};

export function libelleEtape(cle: EtapeCle, locale: string): string {
  const row = LIBELLE_ETAPE[cle];
  return locale.startsWith("fr") ? row.fr : row.en;
}

export function formatDureeHeures(heures: number, locale: string): string {
  if (heures < 1) return locale.startsWith("fr") ? "< 1 h" : "< 1 h";
  if (heures < 24) {
    const h = Math.round(heures);
    return locale.startsWith("fr") ? `${h} h` : `${h} h`;
  }
  const j = Math.floor(heures / 24);
  const h = Math.round(heures % 24);
  if (h === 0) return locale.startsWith("fr") ? `${j} j` : `${j} d`;
  return locale.startsWith("fr") ? `${j} j ${h} h` : `${j} d ${h} h`;
}

const PAYS: Record<string, { fr: string; en: string }> = {
  fr: { fr: "France", en: "France" },
  es: { fr: "Espagne", en: "Spain" },
  tr: { fr: "Turquie", en: "Turkey" },
  de: { fr: "Allemagne", en: "Germany" },
  it: { fr: "Italie", en: "Italy" },
  pt: { fr: "Portugal", en: "Portugal" },
};

export function nomPays(langue: string | null, locale: string): string {
  if (!langue) return locale.startsWith("fr") ? "pays inconnu" : "unknown market";
  const row = PAYS[langue];
  if (!row) return langue;
  return locale.startsWith("fr") ? row.fr : row.en;
}

export function redigerBriefMission(f: FaitsMission, locale: string): string {
  const fr = locale.startsWith("fr");
  const phase = libelleEtape(etapeCourante(pipelineMission(f)), locale);
  const pays = nomPays(f.langue, locale);
  if (f.famille === "hm") {
    if (f.hired > 0) {
      return fr
        ? `HM ${pays} recruté. Le job reste ouvert. ${f.invites_sent} invité(s), ${f.applicants} candidature(s), ${f.messaged} en questions, ${f.hired} embauché(s).`
        : `${pays} HM hired. Job still live. ${f.invites_sent} invited, ${f.applicants} applicants, ${f.messaged} in questions, ${f.hired} hired.`;
    }
    return fr
      ? `On cherche encore un HM ${pays}. ${f.invites_sent} invité(s), ${f.applicants} candidature(s), ${f.messaged} en phase questions — personne embauchée. Prochaine étape : ${phase}.`
      : `Still hiring a ${pays} HM. ${f.invites_sent} invited, ${f.applicants} applicants, ${f.messaged} in questions — nobody hired. Next step: ${phase}.`;
  }
  return fr
    ? `Recrutement créateurs ${pays}. ${f.invites_sent} invité(s), ${f.applicants} candidature(s), ${f.messaged} en questions, ${f.hired} embauché(s). Prochaine étape : ${phase}.`
    : `Hiring ${pays} creators. ${f.invites_sent} invited, ${f.applicants} applicants, ${f.messaged} in questions, ${f.hired} hired. Next step: ${phase}.`;
}

export function redigerBriefHm(f: FaitsHm, locale: string): string {
  const fr = locale.startsWith("fr");
  const pays = nomPays(f.langue, locale);
  const phase = libelleEtape(etapeCourante(pipelineHm(f)), locale);

  let lead: string;
  if (!f.contrat_at) {
    lead = fr
      ? `${f.nom} n’a pas encore de contrat ${pays}.`
      : `${f.nom} has no ${pays} contract yet.`;
  } else if (!f.slack_ok) {
    lead = fr
      ? `${f.nom} est recrutée (${pays}) mais n’est pas sur Slack — c’est le prochain truc.`
      : `${f.nom} is hired (${pays}) but not in Slack yet — that’s the next step.`;
  } else if (!f.codes_at) {
    lead = fr
      ? `${f.nom} est sur Slack, le compte OS n’est pas encore créé.`
      : `${f.nom} is in Slack; the OS account is not created yet.`;
  } else if (!f.os_connecte_at) {
    lead = fr
      ? `${f.nom} a un compte OS mais ne s’est jamais connectée.`
      : `${f.nom} has an OS account but has never signed in.`;
  } else if (f.createurs_n === 0) {
    lead = fr
      ? `${f.nom} est opérationnelle (${pays}) : Slack + OS OK. Aucun créateur rattaché pour l’instant.`
      : `${f.nom} is operational (${pays}): Slack + OS OK. No creator attached yet.`;
  } else {
    lead = fr
      ? `${f.nom} pilote ${f.createurs_n} créateur(s) (${pays}).`
      : `${f.nom} is running ${f.createurs_n} creator(s) (${pays}).`;
  }

  const faits = fr
    ? `Faits : ${f.invites_sent} invité(s) sur le job, ${f.messaged} en questions, contrat ${f.contrat_at ? "signé" : "ouvert"}, ${f.slack_ok ? "présente sur Slack" : "pas encore sur Slack"}, ${f.codes_at ? "codes OS envoyés" : "pas de compte OS"}, ${f.os_connecte_at ? "déjà connectée à l’OS" : "pas encore connectée à l’OS"}, ${f.createurs_n} créateur(s). Prochaine étape : ${phase}.`
    : `Facts: ${f.invites_sent} invited on the job, ${f.messaged} in questions, contract ${f.contrat_at ? "signed" : "open"}, ${f.slack_ok ? "in Slack" : "not in Slack yet"}, ${f.codes_at ? "OS login created" : "no OS account yet"}, ${f.os_connecte_at ? "already signed into the OS" : "has not signed into the OS yet"}, ${f.createurs_n} creator(s). Next step: ${phase}.`;

  return `${lead} ${faits}`;
}
