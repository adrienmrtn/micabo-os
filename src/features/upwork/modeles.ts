import type { EtapeTimelineCle } from "./timeline";
import type { UpworkApproche } from "./types";

/** Message pré-écrit pour une étape, éditable dans l'OS. */
export type UpworkModele = {
  id: string;
  cle: EtapeTimelineCle;
  role_cible: "hm" | "createur";
  /** `fr` pour la France, `*` pour l'anglais (tous les autres pays). */
  langue: string;
  corps: string;
  maj_at: string;
};

/** Messages et contrat : uniquement le recrutement HM. Après, on lit. */
export const ETAPES_AVEC_MESSAGE: readonly EtapeTimelineCle[] = [
  "pourparlers",
  "contrat_envoye",
] as const;

export const VARIABLES_MODELE = [
  "prenom",
  "nom",
  "pays",
  "job",
  "hm_prenom",
  "resume",
  "manques",
] as const;

export type VariableModele = (typeof VARIABLES_MODELE)[number];

export type LangueMessage = "fr" | "en";

export type ContexteModele = Partial<Record<VariableModele, string | null>> & {
  role?: "hm" | "createur";
  etape?: EtapeTimelineCle;
  langue?: string | null;
  /** Leurs mots, pas le résumé. La réponse Talks s'appuie là-dessus. */
  dernier_message?: string | null;
};

export const MODELE_GENERIQUE = "*";
export const MODELE_FRANCE = "fr";

/** France → français. Tout le reste → anglais, y compris ES / DE / … */
export function langueMessage(code: string | null | undefined): LangueMessage {
  return code === "fr" ? "fr" : "en";
}

export function prenomDe(nomComplet: string): string {
  return nomComplet.trim().split(/\s+/)[0] ?? nomComplet.trim();
}

/**
 * France : playbook `fr`, sinon l'anglais (`*`). On n'envoie jamais
 * l'espagnol / l'allemand / etc. — les discussions hors France sont en anglais.
 */
export function modelePour(
  modeles: UpworkModele[],
  cle: EtapeTimelineCle,
  role: "hm" | "createur",
  langue: string | null,
): UpworkModele | null {
  const candidats = modeles.filter((m) => m.cle === cle && m.role_cible === role);
  if (langueMessage(langue) === "fr") {
    return (
      candidats.find((m) => m.langue === MODELE_FRANCE) ??
      candidats.find((m) => m.langue === MODELE_GENERIQUE) ??
      null
    );
  }
  return candidats.find((m) => m.langue === MODELE_GENERIQUE) ?? null;
}

const MOTIF_VARIABLE = /\{\{\s*([a-z_]+)\s*\}\}/g;

/**
 * Remplit les variables. Ce que l'admin lit ici est exactement ce qui part sur
 * Upwork : l'agent reçoit le texte fini, pas le gabarit.
 */
export function remplirModele(
  corps: string,
  contexte: ContexteModele,
): { texte: string; manquantes: string[] } {
  const manquantes = new Set<string>();
  const texte = corps.replace(MOTIF_VARIABLE, (entier, nom: string) => {
    const valeur = contexte[nom as VariableModele];
    if (valeur == null || valeur.trim() === "") {
      manquantes.add(nom);
      return entier;
    }
    return valeur;
  });
  return { texte, manquantes: [...manquantes] };
}

/** Upwork refuse au-delà de 10 000 caractères. */
export const LONGUEUR_MAX_MESSAGE = 10_000;

export function messageEnvoyable(texte: string, manquantes: string[]): boolean {
  return (
    texte.trim().length > 0 && texte.length <= LONGUEUR_MAX_MESSAGE && manquantes.length === 0
  );
}

const MANQUES_FR = {
  slack: "t'envoyer l'invitation Slack",
  email: "te demander l'email pour Slack",
  codes: "t'envoyer les codes OS",
  os: "que tu te connectes à l'OS",
  slackJoin: "que tu rejoignes Slack",
  upwork: "t'ajouter à mon compte Upwork",
  tiktok: "que tu crées le compte TikTok et renseignes le pseudo dans l'OS",
} as const;

const MANQUES_EN = {
  slack: "send you the Slack invite",
  email: "ask you for the email to use on Slack",
  codes: "send you the OS login codes",
  os: "you signing in to the OS",
  slackJoin: "you joining Slack",
  upwork: "adding you to my Upwork account",
  tiktok: "you creating the TikTok account and adding the handle in the OS",
} as const;

/** Ce qui reste à faire pour CETTE personne, à CETTE étape, dans SA langue. */
export function manquesPour(
  a: UpworkApproche,
  etape: EtapeTimelineCle,
  langue?: string | null,
): string[] {
  const l = langueMessage(langue) === "fr" ? MANQUES_FR : MANQUES_EN;
  if (etape === "acces_envoyes") {
    const items: string[] = [];
    if (!a.slack_envoye_ok) items.push(l.slack);
    if (a.role === "hm" && !a.email_demande_ok) items.push(l.email);
    if (!a.codes_ok) items.push(l.codes);
    return items;
  }
  if (etape === "integration") {
    const items: string[] = [];
    if (!a.os_ok) items.push(l.os);
    if (!a.slack_ok) items.push(l.slackJoin);
    if (a.role === "hm" && !a.upwork_ajoute_ok) items.push(l.upwork);
    return items;
  }
  if (etape === "tiktok_cree" && !a.tiktok_cree_ok) {
    return [l.tiktok];
  }
  return [];
}

export function contexteDepuisApproche(
  a: UpworkApproche,
  extras: {
    pays: string;
    hmPrenom?: string | null;
    etape: EtapeTimelineCle;
    langue?: string | null;
  },
): ContexteModele {
  const manques = manquesPour(a, extras.etape, extras.langue);
  return {
    prenom: prenomDe(a.nom),
    nom: a.nom,
    pays: extras.pays,
    hm_prenom: extras.hmPrenom ?? null,
    resume: a.resume_discussions?.trim() || null,
    dernier_message: a.dernier_message?.trim() || a.resume_discussions?.trim() || null,
    manques: manques.length ? manques.map((m) => `- ${m}`).join("\n") : null,
    role: a.role,
    etape: extras.etape,
    langue: extras.langue ?? null,
  };
}

function retirerOuverture(texte: string, prenom: string): string {
  const ligne = texte.replace(/^\s+/u, "");
  const nom = prenom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const motif = new RegExp(
    `^(?:bonjour|hi|hello)(?:\\s+${nom})?\\s*,?\\s*`,
    "i",
  );
  return ligne.replace(motif, "").replace(/^\n+/, "").trim();
}

function retirerSignature(texte: string): string {
  return texte
    .replace(
      /\n+(?:à vous lire,?\s*|looking forward,?\s*|best,?\s*)?(?:adrien|\{\{\s*hm_prenom\s*\}\})\s*$/i,
      "",
    )
    .trim();
}

function signaturePour(ctx: ContexteModele): string {
  if (ctx.role === "createur" && ctx.hm_prenom?.trim()) return ctx.hm_prenom.trim();
  return "Adrien";
}

export type IntentionTalks =
  | "refus"
  | "appel"
  | "demarrage"
  | "dispo"
  | "interesse"
  | "questions"
  | "autre";

/** Un point ou un fichier sans texte : on n'a rien à quoi répondre. */
export function messageUtileTalks(texte: string | null | undefined): boolean {
  if (!texte) return false;
  return texte.replace(/[.\s]/g, "").length >= 8;
}

export function intentionTalks(texte: string): IntentionTalks {
  const t = texte.toLowerCase();
  if (
    /another opportunity|not interested|i(?:'ll| will) pass|je (?:passe|décline)|no longer interested|decided to pursue/.test(
      t,
    )
  ) {
    return "refus";
  }
  if (/get on a call|on a call|schedule a (?:call|meeting)|zoom|visio|\bappel\b/.test(t)) {
    return "appel";
  }
  if (
    /how do we get started|how (?:do|can) (?:we|i) (?:get )?start|comment (?:on |je )?(?:d[eé]marre|commence)|next steps?|prochaine [eé]tape/.test(
      t,
    )
  ) {
    return "demarrage";
  }
  if (
    /available right now|dispo tout de suite|ready to (?:start|begin)|je suis dispo/.test(t)
  ) {
    return "dispo";
  }
  if (/\?/.test(t)) return "questions";
  if (/interested|int[eé]ress[eé]/.test(t)) return "interesse";
  return "autre";
}

function extraireQuestion(texte: string): string | null {
  const morceaux = texte.match(/[^.!?\n]+[?]/g);
  const q = morceaux?.[morceaux.length - 1]?.trim();
  return q || null;
}

function corpsReponseTalks(fr: boolean, dernier: string, intention: IntentionTalks): string {
  switch (intention) {
    case "refus":
      return fr
        ? "C'est noté, merci de m'avoir prévenu. Je clos le fil."
        : "Understood — thanks for letting me know. I'll close the thread.";
    case "appel":
      return fr
        ? "Pas besoin d'appel, on fait tout ici. Prochaine étape : je t'envoie le contrat Upwork."
        : "No need for a call — we can do everything on this thread. Next I send the Upwork contract.";
    case "demarrage":
      return fr
        ? "Tu demandes comment on démarre : je t'envoie le contrat Upwork. Tu acceptes, ensuite Slack + l'OS."
        : "You asked how we get started — next I send the Upwork contract. You accept, then Slack and the OS follow.";
    case "dispo":
      return fr
        ? "Tu es dispo : je t'envoie le contrat Upwork pour qu'on démarre."
        : "You're available — I'll send the Upwork contract so we can start.";
    case "interesse":
      return fr
        ? "Content que ça t'intéresse. Prochaine étape : je t'envoie le contrat Upwork."
        : "Glad you're interested. Next I send the Upwork contract.";
    case "questions": {
      const q = extraireQuestion(dernier);
      if (fr) {
        return q
          ? `Tu demandes : « ${q} »\n\nProchaine étape concrète : je t'envoie le contrat Upwork. On règle le reste ici.`
          : "Prochaine étape concrète : je t'envoie le contrat Upwork. On règle le reste ici.";
      }
      return q
        ? `You asked: "${q}"\n\nNext concrete step: I send the Upwork contract. We can settle the rest on this thread.`
        : "Next concrete step: I send the Upwork contract. We can settle the rest on this thread.";
    }
    case "autre":
      return fr
        ? "Merci pour ton message. Prochaine étape : je t'envoie le contrat Upwork si tu veux avancer."
        : "Thanks for the note. Next I send the Upwork contract if you want to move forward.";
  }
}

/**
 * Talks : on répond à LEUR dernier message. Le playbook ne sert que s'ils
 * n'ont rien dit d'utilisable.
 */
export function composerReponseTalks(
  playbook: string,
  ctx: ContexteModele,
): { texte: string; manquantes: string[] } {
  const fr = langueMessage(ctx.langue) === "fr";
  const prenom = ctx.prenom?.trim() || "";
  const dernier = (ctx.dernier_message ?? "").trim();
  const rempli = remplirModele(playbook, {
    ...ctx,
    resume: ctx.resume ?? "",
    manques: ctx.manques ?? "",
  });
  const suite = retirerSignature(retirerOuverture(rempli.texte, prenom || "x"));
  const blocs: string[] = [];

  if (prenom) blocs.push(fr ? `Bonjour ${prenom},` : `Hi ${prenom},`);
  if (messageUtileTalks(dernier)) {
    blocs.push("");
    blocs.push(corpsReponseTalks(fr, dernier, intentionTalks(dernier)));
  } else if (suite) {
    blocs.push("");
    blocs.push(suite);
  }
  blocs.push("");
  blocs.push(signaturePour(ctx));

  const texte = blocs.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const manquantes = rempli.manquantes.filter((v) => v !== "resume" && v !== "manques");
  return { texte, manquantes };
}

/**
 * Un brouillon pour CETTE personne, dans SA langue. Talks = leur dernier
 * message. Les autres étapes : ce qu'il manque, puis le gabarit.
 */
export function composerMessage(
  corps: string,
  ctx: ContexteModele,
): { texte: string; manquantes: string[] } {
  if (ctx.etape === "pourparlers") return composerReponseTalks(corps, ctx);

  const fr = langueMessage(ctx.langue) === "fr";
  const porteResume = /\{\{\s*resume\s*\}\}/.test(corps);
  const porteManques = /\{\{\s*manques\s*\}\}/.test(corps);
  const rempli = remplirModele(corps, {
    ...ctx,
    resume: ctx.resume ?? "",
    manques: ctx.manques ?? "",
  });
  const prenom = ctx.prenom?.trim() || "";
  const suite = retirerSignature(retirerOuverture(rempli.texte, prenom || "x"));
  const blocs: string[] = [];

  if (prenom) blocs.push(fr ? `Bonjour ${prenom},` : `Hi ${prenom},`);
  if (ctx.resume?.trim() && !porteResume) {
    blocs.push("");
    blocs.push(fr ? `J'ai bien noté : ${ctx.resume.trim()}` : `Noted: ${ctx.resume.trim()}`);
  }
  if (suite) {
    blocs.push("");
    blocs.push(suite);
  }
  if (ctx.manques?.trim() && !porteManques) {
    blocs.push("");
    blocs.push(fr ? "Il reste :" : "Still needed:");
    blocs.push(ctx.manques.trim());
  }
  blocs.push("");
  blocs.push(signaturePour(ctx));

  const texte = blocs.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const manquantes = rempli.manquantes.filter((v) => v !== "resume" && v !== "manques");
  return { texte, manquantes };
}
