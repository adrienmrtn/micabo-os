import { estSlugMicabo } from "./applications";

export type GenreIdentite = "homme" | "femme";

interface JeuPrenoms {
  prenomsH: string[];
  prenomsF: string[];
}

/** Prénoms courants par langue (pays de publication). */
export const PRENOMS_PAR_LANGUE: Record<string, JeuPrenoms> = {
  fr: {
    prenomsH: ["matteo", "lucas", "nathan", "gabriel", "hugo", "louis", "adam", "raphael", "arthur", "jules", "leo", "ethan", "noah", "paul"],
    prenomsF: ["emma", "lea", "chloe", "manon", "mathilde", "camille", "ines", "jade", "louise", "alice", "lina", "anna", "clara", "eva"],
  },
  en: {
    prenomsH: ["mark", "james", "jack", "ryan", "ethan", "liam", "noah", "luke", "adam", "ben", "jacob", "dylan", "owen", "sam"],
    prenomsF: ["emily", "olivia", "sophie", "grace", "chloe", "mia", "ava", "ella", "lily", "hannah", "zoe", "ruby", "isla", "erin"],
  },
  de: {
    prenomsH: ["jakob", "felix", "lukas", "jonas", "leon", "paul", "ben", "elias", "finn", "noah", "luca", "tim", "max", "moritz"],
    prenomsF: ["mia", "emma", "hannah", "lena", "lea", "marie", "lina", "clara", "anna", "sophie", "laura", "nele", "ida", "greta"],
  },
  it: {
    prenomsH: ["matteo", "leonardo", "francesco", "alessandro", "lorenzo", "andrea", "gabriele", "marco", "luca", "davide"],
    prenomsF: ["giulia", "sofia", "aurora", "alice", "emma", "giorgia", "martina", "chiara", "sara", "beatrice"],
  },
  es: {
    prenomsH: ["hugo", "mateo", "martin", "lucas", "pablo", "alvaro", "adrian", "diego", "daniel", "alejandro"],
    prenomsF: ["lucia", "sofia", "martina", "maria", "paula", "julia", "valeria", "alba", "emma", "carla"],
  },
  pt: {
    prenomsH: ["joao", "francisco", "afonso", "tomas", "martim", "guilherme", "rodrigo", "tiago", "miguel", "diogo"],
    prenomsF: ["maria", "matilde", "leonor", "beatriz", "carolina", "ana", "mariana", "ines", "sofia", "lara"],
  },
  cs: {
    prenomsH: ["jan", "adam", "tomas", "lukas", "matej", "filip", "david", "jakub", "ondrej", "martin"],
    prenomsF: ["elina", "tereza", "anna", "katerina", "natalie", "viktorie", "adela", "nikola", "barbora", "julie"],
  },
  nl: {
    prenomsH: ["daan", "sem", "lucas", "levi", "finn", "milan", "noah", "luuk", "jesse", "thijs"],
    prenomsF: ["emma", "julia", "sophie", "mila", "sara", "lisa", "nova", "liv", "fleur", "anna"],
  },
  el: {
    prenomsH: ["giorgos", "nikos", "dimitris", "giannis", "kostas", "alexandros", "christos", "antonis"],
    prenomsF: ["maria", "eleni", "katerina", "sofia", "anna", "despoina", "ioanna", "christina"],
  },
  hu: {
    prenomsH: ["balint", "mate", "dominik", "levente", "adam", "david", "balazs", "tamas"],
    prenomsF: ["hanna", "anna", "lila", "zsofia", "emma", "nora", "laura", "reka"],
  },
  pl: {
    prenomsH: ["jakub", "antoni", "jan", "szymon", "filip", "aleksander", "kacper", "mateusz"],
    prenomsF: ["zofia", "zuzanna", "hanna", "julia", "maja", "laura", "lena", "maria"],
  },
  ro: {
    prenomsH: ["mihai", "alexandru", "andrei", "david", "stefan", "gabriel", "matei", "cristian"],
    prenomsF: ["maria", "elena", "ioana", "andreea", "sofia", "ana", "daria", "sara"],
  },
  sv: {
    prenomsH: ["erik", "lars", "karl", "anders", "johan", "gustav", "axel", "hugo"],
    prenomsF: ["emma", "alice", "maja", "ella", "wilma", "alma", "ebba", "astrid"],
  },
  tr: {
    prenomsH: ["emir", "yusuf", "ege", "ali", "can", "burak", "kerem", "mert"],
    prenomsF: ["zeynep", "ela", "defne", "azra", "asya", "eylul", "selin", "ece"],
  },
};

/** Mots « études / travail » dans la langue du compte. */
export const MOTS_ETUDES: Record<string, string[]> = {
  fr: ["etudes", "revisions", "cours", "fiches", "notes", "examen", "travail", "flashcards"],
  en: ["study", "work", "notes", "exams", "flashcards", "revise", "learn", "classes"],
  de: ["lernen", "studium", "lernen", "noten", "pruefung", "arbeit", "flashcards", "kurs"],
  it: ["studio", "lavoro", "appunti", "esame", "flashcards", "corso", "ripasso", "schede"],
  es: ["estudio", "trabajo", "apuntes", "examen", "flashcards", "curso", "repaso", "fichas"],
  pt: ["estudo", "trabalho", "notas", "exame", "flashcards", "curso", "revisao", "fichas"],
  cs: ["studium", "prace", "poznamky", "zkouska", "flashcards", "kurz", "opakovat", "karty"],
  nl: ["studie", "werk", "notities", "examen", "flashcards", "cursus", "herhalen", "kaarten"],
  el: ["meleti", "douleia", "simeioseis", "eksetasi", "flashcards", "mathima", "epanalipsi"],
  hu: ["tanulas", "munka", "jegyzetek", "vizsga", "flashcards", "kurzus", "ismetles"],
  pl: ["nauka", "praca", "notatki", "egzamin", "flashcards", "kurs", "powtorka"],
  ro: ["studiu", "munca", "notite", "examen", "flashcards", "curs", "recapitulare"],
  sv: ["studier", "arbete", "anteckningar", "prov", "flashcards", "kurs", "repetera"],
  tr: ["calisma", "is", "notlar", "sinav", "flashcards", "ders", "tekrar"],
};

/** Bio simple = « study tips » dans la langue du posteur. */
export const BIO_ETUDES: Record<string, string> = {
  fr: "conseils d'études",
  en: "study tips",
  de: "lerntipps",
  it: "consigli di studio",
  es: "consejos de estudio",
  pt: "dicas de estudo",
  cs: "tipy na studium",
  nl: "studietips",
  el: "συμβουλές μελέτης",
  hu: "tanulási tippek",
  pl: "porady do nauki",
  ro: "sfaturi de studiu",
  sv: "studietips",
  tr: "çalışma ipuçları",
};

export function sansAccentsIdentite(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function capitaliserPrenom(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function bioEtudes(langue: string): string {
  return BIO_ETUDES[langue] ?? BIO_ETUDES.en;
}

export function motsEtudes(langue: string): string[] {
  return MOTS_ETUDES[langue] ?? MOTS_ETUDES.en;
}

export function prenomsPour(langue: string, genre: GenreIdentite): string[] {
  const jeu = PRENOMS_PAR_LANGUE[langue] ?? PRENOMS_PAR_LANGUE.en;
  return genre === "homme" ? jeu.prenomsH : jeu.prenomsF;
}

export interface IdentiteCompte {
  handle: string;
  nom: string;
  bio: string;
}

function melanger<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Identité TikTok micabo : `prenom.motetudes` + 3 chiffres,
 * nom affiché = prénom seul, bio = « study tips » traduit.
 */
export function genererIdentiteMicabo(opts: {
  langue: string;
  genre: GenreIdentite;
  handlesPris?: Iterable<string>;
  rng?: () => number;
}): IdentiteCompte {
  const rng = opts.rng ?? Math.random;
  const prenoms = prenomsPour(opts.langue, opts.genre);
  const mots = motsEtudes(opts.langue);
  const pris = new Set(
    [...(opts.handlesPris ?? [])].map((h) => sansAccentsIdentite(h).replace(/\d+$/, "")),
  );

  let prenom = prenoms[0] ?? "alex";
  let root = "";
  for (const p of melanger(prenoms, rng)) {
    for (const mot of melanger(mots, rng)) {
      const r = `${sansAccentsIdentite(p)}.${sansAccentsIdentite(mot)}`;
      if (!pris.has(r)) {
        prenom = p;
        root = r;
        break;
      }
    }
    if (root) break;
  }
  if (!root) {
    prenom = prenoms[Math.floor(rng() * prenoms.length)] ?? "alex";
    root = `${sansAccentsIdentite(prenom)}.${sansAccentsIdentite(mots[0] ?? "study")}`;
  }

  const digits = String(Math.floor(rng() * 900) + 100);
  return {
    handle: `${root}${digits}`,
    nom: capitaliserPrenom(prenom),
    bio: bioEtudes(opts.langue),
  };
}

export function doitGenererIdentiteMicabo(slug: string | null | undefined): boolean {
  return estSlugMicabo(slug);
}
