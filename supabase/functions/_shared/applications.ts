export const SLUG_MICABO = "micabo";
export const SLUG_SOPHIA = "sophia";

export type ApplicationRow = {
  id: string;
  slug: string;
  nom: string;
};

type Supabase = ReturnType<typeof import("./supabase.ts").serviceClient>;

export function normaliserSlug(valeur: unknown): string {
  return String(valeur ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function estSlugSophia(slug: string | null | undefined): boolean {
  return slug === SLUG_SOPHIA;
}

export function estSlugMicabo(slug: string | null | undefined): boolean {
  return (slug ?? SLUG_MICABO) === SLUG_MICABO;
}

/**
 * Application d'un import : la source l'emporte, puis l'id explicite,
 * puis le fallback (micabo sur cet OS).
 */
export function resoudreApplicationImport(opts: {
  sourceApplicationId?: string | null;
  explicitApplicationId?: string | null;
  fallbackId: string;
}): string {
  const source = String(opts.sourceApplicationId ?? "").trim();
  if (source) return source;
  const explicit = String(opts.explicitApplicationId ?? "").trim();
  if (explicit) return explicit;
  return opts.fallbackId;
}

export function clePromptPertinence(slug: string | null | undefined): string {
  const cle = normaliserSlug(slug) || SLUG_MICABO;
  return cle === SLUG_MICABO ? "pertinence_micabo" : `pertinence_${cle}`;
}

export function clePromptPlacement(slug: string | null | undefined): string {
  const cle = normaliserSlug(slug) || SLUG_MICABO;
  return `placement_${cle}`;
}

export function placementParDefaut(langue: string, slug = SLUG_MICABO): string {
  const par: Record<string, string> = {
    fr: "transforme tes cours en flashcards et révise 10 minutes par jour. micabo est top pour ça, il les crée à partir de tes notes.",
    en: "turn your notes into flashcards and review 10 minutes a day. micabo is great for that, it builds them from your notes.",
    de: "mach aus deinen notizen flashcards und wiederhole 10 minuten am tag. micabo ist super dafür, es erstellt sie aus deinen unterlagen.",
    es: "pasa tus apuntes a flashcards y repasa 10 minutos al día. micabo va genial para eso, las crea desde tus notas.",
    it: "trasforma i tuoi appunti in flashcards e ripassa 10 minuti al giorno. micabo è top per questo, le crea dalle tue note.",
    pt: "transforma as tuas notas em flashcards e revê 10 minutos por dia. o micabo é ótimo para isso, cria-as a partir das tuas notas.",
    cs: "proměň poznámky ve flashcards a opakuj 10 minut denně. micabo je na to ideální, vytvoří je z tvých zápisků.",
    nl: "zet je notities om in flashcards en herhaal 10 minuten per dag. micabo is daar top voor, het maakt ze van je notities.",
    el: "μετέτρεψε τις σημειώσεις σου σε flashcards και επανάλαβε 10 λεπτά τη μέρα. το micabo είναι ιδανικό γι' αυτό.",
    hu: "alakítsd a jegyzeteid flashcardokká, és ismételj napi 10 percet. a micabo pont erre jó.",
    pl: "zamień notatki we flashcards i powtarzaj 10 minut dziennie. micabo jest do tego super.",
    ro: "transformă-ți notițele în flashcards și repetă 10 minute pe zi. micabo e top pentru asta.",
    sv: "gör flashcards av anteckningarna och repetera 10 minuter om dagen. micabo är toppen för det.",
    tr: "notlarını flashcard'a çevir, günde 10 dakika tekrarla. micabo tam bunun için.",
  };
  if (slug && slug !== SLUG_MICABO) {
    return par[langue] ?? par.en;
  }
  return par[langue] ?? par.en;
}

export async function applicationParSlug(
  supabase: Supabase,
  slug: unknown,
): Promise<ApplicationRow | null> {
  const cle = normaliserSlug(slug) || SLUG_MICABO;
  const { data } = await supabase
    .from("applications")
    .select("id, slug, nom")
    .eq("slug", cle)
    .maybeSingle();
  return (data as ApplicationRow | null) ?? null;
}

export async function applicationParId(
  supabase: Supabase,
  id: string | null | undefined,
): Promise<ApplicationRow | null> {
  if (!id) return applicationParSlug(supabase, SLUG_MICABO);
  const { data } = await supabase
    .from("applications")
    .select("id, slug, nom")
    .eq("id", id)
    .maybeSingle();
  return (data as ApplicationRow | null) ?? null;
}

export async function applicationMicabo(supabase: Supabase): Promise<ApplicationRow> {
  const app = await applicationParSlug(supabase, SLUG_MICABO);
  if (!app) throw new Error("Application micabo introuvable");
  return app;
}

/** @deprecated Utiliser applicationMicabo — conservé pour les imports existants. */
export async function applicationSophia(supabase: Supabase): Promise<ApplicationRow> {
  return applicationMicabo(supabase);
}

export async function resoudreApplication(
  supabase: Supabase,
  input: { application_id?: unknown; application_slug?: unknown },
): Promise<ApplicationRow> {
  const id = String(input.application_id ?? "").trim();
  if (id) {
    const parId = await applicationParId(supabase, id);
    if (parId && parId.slug === SLUG_MICABO) return parId;
  }
  const slug = normaliserSlug(input.application_slug);
  if (slug && slug !== SLUG_SOPHIA) {
    const parSlug = await applicationParSlug(supabase, slug);
    if (parSlug) return parSlug;
  }
  return applicationMicabo(supabase);
}
