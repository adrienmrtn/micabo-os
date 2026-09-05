import type { EtapeTimelineCle } from "./timeline";

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
] as const;

export type VariableModele = (typeof VARIABLES_MODELE)[number];

export type ContexteModele = Partial<Record<VariableModele, string | null>>;

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
