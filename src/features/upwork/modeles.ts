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

/**
 * Un brouillon pour CETTE personne, dans SA langue : ce qu'elle a dit,
 * ce qu'il lui manque, puis le gabarit de l'étape.
 */
export function composerMessage(
  corps: string,
  ctx: ContexteModele,
): { texte: string; manquantes: string[] } {
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
