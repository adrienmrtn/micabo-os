import type { EtapeTimelineCle } from "./timeline";
import type { UpworkApproche } from "./types";

/** Message pré-écrit pour une étape, éditable dans l'OS. */
export type UpworkModele = {
  id: string;
  cle: EtapeTimelineCle;
  role_cible: "hm" | "createur";
  /** Code pays, ou `*` pour le modèle qui sert quand le pays n'a pas le sien. */
  langue: string;
  corps: string;
  maj_at: string;
};

/** Les seules étapes où proposer un message a du sens : on attend une réponse. */
export const ETAPES_AVEC_MESSAGE: readonly EtapeTimelineCle[] = [
  "pourparlers",
  "contrat_envoye",
  "acces_envoyes",
  "integration",
  "tiktok_cree",
  "job_createur_poste",
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

export type ContexteModele = Partial<Record<VariableModele, string | null>> & {
  role?: "hm" | "createur";
  etape?: EtapeTimelineCle;
};

export const MODELE_GENERIQUE = "*";

export function prenomDe(nomComplet: string): string {
  return nomComplet.trim().split(/\s+/)[0] ?? nomComplet.trim();
}

/**
 * Le modèle du pays s'il existe, sinon le générique. Sans modèle du tout, on
 * ne propose rien plutôt que d'inventer un texte.
 */
export function modelePour(
  modeles: UpworkModele[],
  cle: EtapeTimelineCle,
  role: "hm" | "createur",
  langue: string | null,
): UpworkModele | null {
  const candidats = modeles.filter((m) => m.cle === cle && m.role_cible === role);
  return (
    candidats.find((m) => langue != null && m.langue === langue) ??
    candidats.find((m) => m.langue === MODELE_GENERIQUE) ??
    null
  );
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

/** Ce qui reste à faire pour CETTE personne, à CETTE étape. */
export function manquesPour(a: UpworkApproche, etape: EtapeTimelineCle): string[] {
  if (etape === "acces_envoyes") {
    const items: string[] = [];
    if (!a.slack_envoye_ok) items.push("t'envoyer l'invitation Slack");
    if (a.role === "hm" && !a.email_demande_ok) items.push("te demander l'email pour Slack");
    if (!a.codes_ok) items.push("t'envoyer les codes OS");
    return items;
  }
  if (etape === "integration") {
    const items: string[] = [];
    if (!a.os_ok) items.push("que tu te connectes à l'OS");
    if (!a.slack_ok) items.push("que tu rejoignes Slack");
    if (a.role === "hm" && !a.upwork_ajoute_ok) items.push("t'ajouter à mon compte Upwork");
    return items;
  }
  if (etape === "tiktok_cree" && !a.tiktok_cree_ok) {
    return ["que tu crées le compte TikTok et renseignes le pseudo dans l'OS"];
  }
  return [];
}

export function contexteDepuisApproche(
  a: UpworkApproche,
  extras: { pays: string; hmPrenom?: string | null; etape: EtapeTimelineCle },
): ContexteModele {
  const manques = manquesPour(a, extras.etape);
  return {
    prenom: prenomDe(a.nom),
    nom: a.nom,
    pays: extras.pays,
    hm_prenom: extras.hmPrenom ?? null,
    resume: a.resume_discussions?.trim() || null,
    manques: manques.length ? manques.map((m) => `- ${m}`).join("\n") : null,
    role: a.role,
    etape: extras.etape,
  };
}

function retirerOuverture(texte: string, prenom: string): string {
  const ligne = texte.replace(/^\s+/u, "");
  const motif = new RegExp(
    `^bonjour(?:\\s+${prenom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})?\\s*,?\\s*`,
    "i",
  );
  return ligne.replace(motif, "").replace(/^\n+/, "").trim();
}

function retirerSignature(texte: string): string {
  return texte
    .replace(/\n+(?:à vous lire,?\s*)?(?:adrien|\{\{\s*hm_prenom\s*\}\})\s*$/i, "")
    .trim();
}

function signaturePour(ctx: ContexteModele): string {
  if (ctx.role === "createur" && ctx.hm_prenom?.trim()) return ctx.hm_prenom.trim();
  return "Adrien";
}

/**
 * Un brouillon pour CETTE personne : ce qu'elle a dit, ce qu'il lui manque,
 * puis le gabarit de l'étape. Pas le même texte pour tout le monde.
 */
export function composerMessage(
  corps: string,
  ctx: ContexteModele,
): { texte: string; manquantes: string[] } {
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

  if (prenom) blocs.push(`Bonjour ${prenom},`);
  if (ctx.resume?.trim() && !porteResume) {
    blocs.push("");
    blocs.push(`J'ai bien noté : ${ctx.resume.trim()}`);
  }
  if (suite) {
    blocs.push("");
    blocs.push(suite);
  }
  if (ctx.manques?.trim() && !porteManques) {
    blocs.push("");
    blocs.push("Il reste :");
    blocs.push(ctx.manques.trim());
  }
  blocs.push("");
  blocs.push(signaturePour(ctx));

  const texte = blocs.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const manquantes = rempli.manquantes.filter((v) => v !== "resume" && v !== "manques");
  return { texte, manquantes };
}
