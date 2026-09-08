import { LANGUES_CIBLES } from "@/features/moteur/langues";

const PAYS_VERS_LANGUE: Array<{ re: RegExp; langue: string }> = [
  { re: /\b(t[uü]rkiye|turkey|turquie|turkish|turc|slayt)\b/i, langue: "tr" },
  { re: /\b(spain|espagne|spanish|espagnol)\b/i, langue: "es" },
  { re: /\b(germany|allemagne|german|allemand|deutschland)\b/i, langue: "de" },
  { re: /\b(italy|italie|italian|italien)\b/i, langue: "it" },
  { re: /\b(portugal|portuguese|portugais)\b/i, langue: "pt" },
  { re: /\b(poland|pologne|polish|polonais)\b/i, langue: "pl" },
  { re: /\b(netherlands|pays-?bas|dutch|n[eé]erlandais)\b/i, langue: "nl" },
  { re: /\b(sweden|su[eè]de|swedish|su[eé]dois)\b/i, langue: "sv" },
  { re: /\b(romania|roumanie|romanian|roumain)\b/i, langue: "ro" },
  { re: /\b(hungary|hongrie|hungarian|hongrois)\b/i, langue: "hu" },
  { re: /\b(greece|gr[eè]ce|greek|grec)\b/i, langue: "el" },
  { re: /\b(czech|tch[eè]quie|tcheque)\b/i, langue: "cs" },
  { re: /\b(france|french-speaking|fran[cç]ais|based in france)\b/i, langue: "fr" },
];

/** Langue cible d'une mission à partir du titre + description Upwork. */
export function langueDepuisTexte(titre: string | null, description?: string | null): string | null {
  const blob = `${titre ?? ""} ${description ?? ""}`;
  for (const { re, langue } of PAYS_VERS_LANGUE) {
    if (re.test(blob)) return langue;
  }
  if (/responsable du recrutement/i.test(titre ?? "")) return "fr";
  return null;
}

export function langueValide(code: string | null | undefined): code is (typeof LANGUES_CIBLES)[number] {
  return Boolean(code && (LANGUES_CIBLES as readonly string[]).includes(code));
}
