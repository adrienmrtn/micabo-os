import { avatarPourSource } from "./avatar.ts";

type Supabase = ReturnType<typeof import("./supabase.ts").serviceClient>;

/**
 * Identité d'un compte de publication (pseudo, nom, bio, avatar), déterministe et
 * INSTANTANÉE (aucun appel Gemini). Format du @ : `prenom.mot-culture` + 3
 * chiffres — ex. « matteo.cultive473 ». Le prénom respecte le GENRE du compte de
 * référence (toggle homme/femme sur la page source) et la langue du poster.
 */

export type Genre = "homme" | "femme";

interface JeuDeNoms {
  prenomsH: string[];
  prenomsF: string[];
  noms: string[];
  /** Mots évoquant la culture / le développement personnel, pour le @. */
  culture: string[];
}

/** Prénoms (connus dans le pays), noms de famille et mots « culture/dév » par
 *  langue. Volontairement courants pour rester crédibles. */
const NOMS_PAR_LANGUE: Record<string, JeuDeNoms> = {
  fr: {
    prenomsH: ["matteo", "lucas", "nathan", "gabriel", "hugo", "louis", "adam", "raphael", "arthur", "jules", "leo", "ethan", "noah", "paul"],
    prenomsF: ["emma", "lea", "chloe", "manon", "sarah", "camille", "ines", "jade", "louise", "alice", "lina", "anna", "clara", "eva"],
    noms: ["martin", "bernard", "dubois", "moreau", "laurent", "lefevre", "roux", "fournier", "girard", "bonnet"],
    culture: ["cultive", "savoir", "culture", "evolue", "grandit", "apprend", "progresse", "developpe", "inspire", "eclaire"],
  },
  en: {
    prenomsH: ["mark", "james", "jack", "ryan", "ethan", "liam", "noah", "luke", "adam", "ben", "jacob", "dylan", "owen", "sam"],
    prenomsF: ["emily", "olivia", "sophie", "grace", "chloe", "mia", "ava", "ella", "lily", "hannah", "zoe", "ruby", "isla", "erin"],
    noms: ["smith", "jones", "brooks", "carter", "reed", "hayes", "morgan", "bennett", "cole", "ward"],
    culture: ["culture", "growth", "mindset", "develops", "learns", "evolves", "thrives", "wisdom", "improve", "development"],
  },
  de: {
    prenomsH: ["jakob", "felix", "lukas", "jonas", "leon", "paul", "ben", "elias", "finn", "noah", "luca", "tim", "max", "moritz"],
    prenomsF: ["mia", "emma", "hannah", "lena", "lea", "marie", "lina", "clara", "anna", "sophie", "laura", "nele", "ida", "greta"],
    noms: ["mueller", "schmidt", "weber", "wagner", "becker", "hoffmann", "koch", "richter", "klein", "wolf"],
    culture: ["kultur", "wissen", "wachstum", "entwickelt", "lernt", "klarheit", "staerke", "fortschritt", "inspiriert", "bildung"],
  },
  it: {
    prenomsH: ["matteo", "leonardo", "francesco", "alessandro", "lorenzo", "andrea", "gabriele", "marco", "luca", "davide", "riccardo", "tommaso", "giulio", "pietro"],
    prenomsF: ["giulia", "sofia", "aurora", "alice", "emma", "giorgia", "martina", "chiara", "sara", "beatrice", "gaia", "elisa", "viola", "alessia"],
    noms: ["rossi", "bianchi", "ferrari", "russo", "romano", "gallo", "costa", "conti", "ricci", "marino"],
    culture: ["cultura", "crescita", "sapere", "evolve", "impara", "mentalita", "sviluppo", "ispira", "migliora", "saggezza"],
  },
  es: {
    prenomsH: ["hugo", "mateo", "martin", "lucas", "pablo", "alvaro", "adrian", "diego", "daniel", "alejandro", "marco", "javier", "mario", "leo"],
    prenomsF: ["lucia", "sofia", "martina", "maria", "paula", "julia", "valeria", "alba", "emma", "carla", "daniela", "sara", "vega", "alma"],
    noms: ["garcia", "martinez", "lopez", "sanchez", "romero", "torres", "ramos", "vega", "castro", "iglesias"],
    culture: ["cultura", "crecimiento", "saber", "evoluciona", "aprende", "mentalidad", "desarrollo", "inspira", "mejora", "sabiduria"],
  },
  pt: {
    prenomsH: ["joao", "francisco", "afonso", "tomas", "martim", "guilherme", "rodrigo", "tiago", "miguel", "diogo", "gabriel", "duarte", "santiago", "pedro"],
    prenomsF: ["maria", "matilde", "leonor", "beatriz", "carolina", "ana", "mariana", "ines", "sofia", "margarida", "francisca", "lara", "alice", "clara"],
    noms: ["silva", "santos", "ferreira", "costa", "oliveira", "sousa", "rocha", "martins", "pinto", "carvalho"],
    culture: ["cultura", "crescimento", "saber", "evolui", "aprende", "mentalidade", "desenvolve", "inspira", "melhora", "sabedoria"],
  },
};

/** Bio par langue (culture générale). */
export const BIO_SECOURS: Record<string, string> = {
  fr: "un peu de culture chaque jour 🧠\nabonne-toi pour apprendre quelque chose de nouveau ✨",
  en: "a little knowledge every day 🧠\nfollow to learn something new ✨",
  de: "jeden tag ein bisschen wissen 🧠\nfolge mir und lerne etwas neues ✨",
  it: "un po' di cultura ogni giorno 🧠\nseguimi per imparare qualcosa di nuovo ✨",
  es: "un poco de cultura cada día 🧠\nsígueme para aprender algo nuevo ✨",
  pt: "um pouco de cultura todo dia 🧠\nsegue para aprender algo novo ✨",
};

export function bioDeSecours(langue: string): string {
  return BIO_SECOURS[langue] ?? BIO_SECOURS.fr;
}

/** Retire accents et casse : « Raphaël » → « raphael » (pour le @). */
function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function capitaliser(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Mélange une copie du tableau (Fisher-Yates). */
function melanger<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Génère une identité (handle « prenom.mot-culture+3 chiffres », nom « Prénom
 * Nom », bio) pour une langue et un GENRE donnés, en évitant les racines et noms
 * déjà pris par nos comptes. 100 % local, aucune IA.
 */
export async function genererIdentite(
  supabase: Supabase,
  langue: string,
  genre: Genre,
): Promise<{ handle: string; nom: string; bio: string }> {
  const jeu = NOMS_PAR_LANGUE[langue] ?? NOMS_PAR_LANGUE.en;
  const prenoms = genre === "homme" ? jeu.prenomsH : jeu.prenomsF;

  // Déjà pris chez nous : racine du @ SANS les chiffres de fin, et noms affichés.
  const { data: pris } = await supabase.from("comptes").select("handle_tiktok, persona_nom");
  const sansChiffres = (s: string) => s.replace(/\d+$/, "").toLowerCase();
  const rootsPris = new Set<string>();
  const nomsPris = new Set<string>();
  for (const c of pris ?? []) {
    if (c.handle_tiktok) rootsPris.add(sansChiffres(c.handle_tiktok));
    if (c.persona_nom) nomsPris.add(c.persona_nom.toLowerCase());
  }

  // 1) Racine « prenom.mot » libre (on mélange pour varier les prénoms/mots).
  let prenom = prenoms[0];
  let root = "";
  for (const p of melanger(prenoms)) {
    for (const mot of melanger(jeu.culture)) {
      const r = `${sansAccents(p)}.${mot}`;
      if (!rootsPris.has(r)) {
        prenom = p;
        root = r;
        break;
      }
    }
    if (root) break;
  }
  // Tout pris (rare) : on force, les 3 chiffres garantissent l'unicité du @.
  if (!root) {
    prenom = melanger(prenoms)[0];
    root = `${sansAccents(prenom)}.${melanger(jeu.culture)[0]}`;
  }

  // 2) Nom d'affichage « Prénom Nom », unique si possible.
  let nomAffiche = `${capitaliser(prenom)} ${capitaliser(jeu.noms[0])}`;
  for (const nf of melanger(jeu.noms)) {
    const candidat = `${capitaliser(prenom)} ${capitaliser(nf)}`;
    if (!nomsPris.has(candidat.toLowerCase())) {
      nomAffiche = candidat;
      break;
    }
  }

  const handle = `${root}${Math.floor(Math.random() * 900) + 100}`; // 3 chiffres
  // Bio = le prénom (celui du @) + un « âge » aléatoire 20-30, façon « Jakob 24 ».
  const age = Math.floor(Math.random() * 11) + 20; // 20 à 30 inclus
  const bio = `${capitaliser(prenom)} ${age}`;
  return { handle, nom: nomAffiche, bio };
}

/**
 * Pose une identité complète (pseudo + nom + bio + avatar) sur un compte, de
 * façon INSTANTANÉE : le genre vient du compte de référence (toggle homme/femme).
 * On ne remplit QUE ce qui manque (un @ ou un nom édités à la main sont
 * préservés). Renvoie le @ posé (ou null si le compte est introuvable).
 */
export async function appliquerIdentiteInstantanee(
  supabase: Supabase,
  compteId: string,
): Promise<{ applique: boolean; handle: string | null }> {
  const { data: compte, error } = await supabase
    .from("comptes")
    .select("*, comptes_reference(genre)")
    .eq("id", compteId)
    .single();
  if (error || !compte) return { applique: false, handle: null };

  // deno-lint-ignore no-explicit-any
  const genre: Genre = (compte as any).comptes_reference?.genre === "homme" ? "homme" : "femme";

  const identite = await genererIdentite(supabase, compte.langue, genre);
  const avatar = await avatarPourSource(supabase, compte.compte_reference_id);

  await supabase
    .from("comptes")
    .update({
      handle_tiktok: compte.handle_tiktok ?? identite.handle,
      persona_nom: compte.persona_nom ?? identite.nom,
      persona_bio: compte.persona_bio ?? identite.bio,
      avatar_url: compte.avatar_url ?? avatar?.url ?? null,
      avatar_source: compte.avatar_url ? compte.avatar_source : avatar ? "bibliotheque" : null,
    })
    .eq("id", compteId);

  if (avatar?.id && !compte.avatar_url) {
    await supabase
      .from("media_library")
      .update({ used_count: avatar.used_count + 1 })
      .eq("id", avatar.id);
  }

  return { applique: true, handle: identite.handle };
}
