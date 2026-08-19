/**
 * Séquencement de « Mettre à jour les sources ».
 *
 * Le bouton lançait les 21 comptes d'un coup : la file serveur recevait la
 * somme de tous leurs retards (2286 posts le 19/08), et l'instance Postgres a
 * saturé jusqu'à la perte du login. On enchaîne donc un compte à la fois, en
 * attendant entre deux que la file serveur soit vide — la même condition que
 * l'historique quand il n'affiche plus ni « En file » ni « Pipeline… ».
 */

/** Ce qui reste à traiter côté serveur, tous comptes confondus. */
export interface MesureFile {
  /** Scrapes en attente ou en cours (`import_file`). */
  file: number;
  /** Pipelines en attente ou en cours (`contenus`). */
  pipeline: number;
}

export const restantFile = (m: MesureFile): number => m.file + m.pipeline;

export interface EtatAttente {
  /** Plus petit total observé : sert à repérer une file qui ne descend plus. */
  minRestant: number | null;
  dernierProgresA: number;
}

export type VerdictAttente =
  | { type: "vide" }
  | { type: "attendre"; restant: number }
  /** La file stagne : enfiler un compte de plus ferait retomber la base. */
  | { type: "bloquee"; restant: number; depuisMs: number };

export function attenteInitiale(maintenant: number): EtatAttente {
  return { minRestant: null, dernierProgresA: maintenant };
}

/**
 * Un pas d'attente. On ne fixe pas de durée maximale : un gros compte met
 * légitimement 20 min à se drainer. Le garde-fou porte sur la progression —
 * tant que le total descend on patiente, dès qu'il stagne on coupe.
 */
export function avancerAttente(
  etat: EtatAttente,
  mesure: MesureFile,
  maintenant: number,
  stallMs: number,
): { etat: EtatAttente; verdict: VerdictAttente } {
  const restant = restantFile(mesure);
  if (restant === 0) {
    return {
      etat: { minRestant: 0, dernierProgresA: maintenant },
      verdict: { type: "vide" },
    };
  }
  const progresse = etat.minRestant === null || restant < etat.minRestant;
  const suivant: EtatAttente = progresse
    ? { minRestant: restant, dernierProgresA: maintenant }
    : etat;
  const depuisMs = maintenant - suivant.dernierProgresA;
  if (depuisMs >= stallMs) {
    return { etat: suivant, verdict: { type: "bloquee", restant, depuisMs } };
  }
  return { etat: suivant, verdict: { type: "attendre", restant } };
}

/** Sondage calme : une grosse file met des minutes à descendre (~6/min mesuré). */
export function delaiSondage(restant: number): number {
  return restant <= 20 ? 10_000 : 20_000;
}
