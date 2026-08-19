/**
 * « Oublier » un compte source : efface TOUT ce qu'il a produit, puis la ligne
 * `comptes_reference` elle-même, pour qu'un ré-import reparte de zéro.
 *
 * Pourquoi ce n'est pas un simple DELETE : les FK vers `comptes_reference` sont
 * volontairement en ON DELETE SET NULL (garde-fou 0157 — supprimer une source
 * ne doit jamais emporter les slideshows par accident). L'oubli fait donc le
 * chemin inverse, explicitement, et dans l'ordre : posts → storage → médias →
 * slideshows → sujets legacy → file d'import → compte.
 *
 * Ce qui bloque un ré-import « propre » et qu'il faut donc nécessairement purger :
 * `comptes_reference.handle_tiktok` (unique), `contenus.source_url` (unique —
 * sinon l'import rouvre l'ancien slideshow au lieu d'en créer un neuf),
 * `sujets.source_url` (unique) et `media_library.storage_path` (unique).
 */

import {
  BUCKET_MEDIAS,
  type LigneJournalOubli,
  type NiveauJournalOubli,
  type OubliCompteurs,
  compteursVides,
  cumulerCompteurs,
  decouperEnLots,
  normaliserHandle,
  prefixeStorageScrape,
  prefixeStorageSujet,
  prefixesStorageContenu,
  resumeCompteurs,
  urlDuHandle,
} from "./oubli_source_cible.ts";
import { messageErreur, serviceClient } from "./supabase.ts";

export type Supabase = ReturnType<typeof serviceClient>;
export type { LigneJournalOubli, NiveauJournalOubli, OubliCompteurs };

/** Slideshows traités par invocation — l'Edge a ~150 s de mur. */
export const LOT_CONTENUS_DEFAUT = 15;
/** Bornes PostgREST (`in(...)`) et storage (`remove(...)`). */
const LOT_IDS = 100;

export interface OubliApercu {
  compteReferenceId: string;
  handle: string;
  contenus: number;
  medias: number;
  posts: number;
  sujets: number;
  importFile: number;
  /** Comptes de publication rattachés : ils perdront le lien vers cette source. */
  postersLies: number;
  /** Comptes conjoints : conservés, mais détachés du principal. */
  conjoints: number;
}

export interface OubliResultat {
  handle: string;
  termine: boolean;
  /** Slideshows encore à traiter après ce passage. */
  restant: number;
  supprimes: OubliCompteurs;
  /** Lignes à afficher dans l'admin — aussi poussées dans les logs Edge. */
  journal: LigneJournalOubli[];
}

type Journal = {
  lignes: LigneJournalOubli[];
  log: (niveau: NiveauJournalOubli, message: string) => void;
};

function creerJournal(): Journal {
  const lignes: LigneJournalOubli[] = [];
  return {
    lignes,
    log(niveau, message) {
      lignes.push({ at: new Date().toISOString(), niveau, message });
      const prefix = `[oubli] ${message}`;
      if (niveau === "error") console.error(prefix);
      else if (niveau === "warn") console.warn(prefix);
      else console.log(prefix);
    },
  };
}

function assertOk(error: unknown, quoi: string, log: Journal["log"]): void {
  if (!error) return;
  const msg = `${quoi} : ${messageErreur(error)}`;
  log("error", msg);
  throw new Error(msg);
}

async function handleDeLaSource(
  supabase: Supabase,
  compteReferenceId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("comptes_reference")
    .select("handle_tiktok")
    .eq("id", compteReferenceId)
    .maybeSingle();
  if (error) throw new Error(`Lecture du compte : ${messageErreur(error)}`);
  return data ? normaliserHandle(data.handle_tiktok as string) : null;
}

/**
 * Tous les slideshows de la source : ceux encore rattachés, PLUS ceux dont le
 * lien a déjà été cassé par une suppression classique et qu'on ne retrouve que
 * par l'URL. Le `ilike` n'est qu'un pré-filtre SQL — le tri exact se fait sur
 * le handle parsé, pour ne pas emporter les slideshows d'un compte homonyme.
 */
export async function idsContenusDeLaSource(
  supabase: Supabase,
  compteReferenceId: string,
  handle: string | null,
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: parLien, error: errLien } = await supabase
    .from("contenus")
    .select("id")
    .eq("compte_reference_id", compteReferenceId)
    .limit(5000);
  if (errLien) throw new Error(`Slideshows liés : ${messageErreur(errLien)}`);
  for (const c of parLien ?? []) ids.add(c.id as string);

  if (handle) {
    const { data: parUrl, error: errUrl } = await supabase
      .from("contenus")
      .select("id, source_url")
      .ilike("source_url", `%@${handle}%`)
      .limit(5000);
    if (errUrl) throw new Error(`Slideshows par URL : ${messageErreur(errUrl)}`);
    for (const c of parUrl ?? []) {
      if (urlDuHandle(c.source_url as string | null, handle)) ids.add(c.id as string);
    }
  }

  // Variations : des slideshows enfants pointent le parent sans porter la source.
  for (const lot of decouperEnLots([...ids], LOT_IDS)) {
    const { data: enfants, error: errEnfants } = await supabase
      .from("contenus")
      .select("id")
      .in("parent_id", lot)
      .limit(5000);
    if (errEnfants) throw new Error(`Variations : ${messageErreur(errEnfants)}`);
    for (const c of enfants ?? []) ids.add(c.id as string);
  }

  return [...ids];
}

async function idsSujetsDeLaSource(
  supabase: Supabase,
  compteReferenceId: string,
  handle: string | null,
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: parLien, error: errLien } = await supabase
    .from("sujets")
    .select("id")
    .eq("compte_reference_id", compteReferenceId)
    .limit(5000);
  if (errLien) throw new Error(`Sujets liés : ${messageErreur(errLien)}`);
  for (const s of parLien ?? []) ids.add(s.id as string);

  if (handle) {
    const { data: parUrl, error: errUrl } = await supabase
      .from("sujets")
      .select("id, source_url")
      .ilike("source_url", `%@${handle}%`)
      .limit(5000);
    if (errUrl) throw new Error(`Sujets par URL : ${messageErreur(errUrl)}`);
    for (const s of parUrl ?? []) {
      if (urlDuHandle(s.source_url as string | null, handle)) ids.add(s.id as string);
    }
  }

  return [...ids];
}

/** File d'import : lignes de la source + lignes orphelines portant son handle. */
async function idsFileImportDeLaSource(
  supabase: Supabase,
  compteReferenceId: string,
  handle: string | null,
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: parLien, error: errLien } = await supabase
    .from("import_file")
    .select("id")
    .eq("compte_reference_id", compteReferenceId)
    .limit(5000);
  if (errLien) throw new Error(`File d'import liée : ${messageErreur(errLien)}`);
  for (const f of parLien ?? []) ids.add(f.id as string);

  if (handle) {
    const { data: parUrl, error: errUrl } = await supabase
      .from("import_file")
      .select("id, post_url")
      .ilike("post_url", `%@${handle}%`)
      .limit(5000);
    if (errUrl) throw new Error(`File d'import par URL : ${messageErreur(errUrl)}`);
    for (const f of parUrl ?? []) {
      if (urlDuHandle(f.post_url as string | null, handle)) ids.add(f.id as string);
    }
  }

  return [...ids];
}

async function compter(
  supabase: Supabase,
  table: string,
  colonne: string,
  valeur: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(colonne, valeur);
  if (error) throw new Error(`Comptage ${table} : ${messageErreur(error)}`);
  return count ?? 0;
}

/** Ce que l'oubli va détruire — affiché à l'admin avant confirmation. */
export async function apercuOubli(
  supabase: Supabase,
  compteReferenceId: string,
): Promise<OubliApercu | null> {
  const handle = await handleDeLaSource(supabase, compteReferenceId);
  if (handle === null) return null;

  const contenuIds = await idsContenusDeLaSource(supabase, compteReferenceId, handle);
  const sujetIds = await idsSujetsDeLaSource(supabase, compteReferenceId, handle);

  // Ensembles, pas des compteurs : une image porte en général À LA FOIS
  // `contenu_id` et `compte_reference_id`, additionner les deux la compterait
  // deux fois et l'admin verrait un chiffre faux.
  const mediaIds = new Set<string>();
  const postIds = new Set<string>();
  for (const lot of decouperEnLots(contenuIds, LOT_IDS)) {
    const { data: medias, error: errMedias } = await supabase
      .from("media_library")
      .select("id")
      .in("contenu_id", lot);
    if (errMedias) throw new Error(`Aperçu médias : ${messageErreur(errMedias)}`);
    for (const m of medias ?? []) mediaIds.add(m.id as string);

    const { data: passages, error: errPassages } = await supabase
      .from("passages")
      .select("post_id")
      .in("contenu_id", lot)
      .not("post_id", "is", null);
    if (errPassages) throw new Error(`Aperçu posts : ${messageErreur(errPassages)}`);
    for (const p of passages ?? []) postIds.add(p.post_id as string);
  }
  const { data: mediasSource, error: errSource } = await supabase
    .from("media_library")
    .select("id")
    .eq("compte_reference_id", compteReferenceId)
    .limit(5000);
  if (errSource) throw new Error(`Aperçu médias source : ${messageErreur(errSource)}`);
  for (const m of mediasSource ?? []) mediaIds.add(m.id as string);

  const apercu: OubliApercu = {
    compteReferenceId,
    handle,
    contenus: contenuIds.length,
    medias: mediaIds.size,
    posts: postIds.size,
    sujets: sujetIds.length,
    importFile: (await idsFileImportDeLaSource(supabase, compteReferenceId, handle)).length,
    postersLies: await compter(supabase, "comptes", "compte_reference_id", compteReferenceId),
    conjoints: await compter(supabase, "comptes_reference", "parent_id", compteReferenceId),
  };
  console.log(
    `[oubli] aperçu @${handle} id=${compteReferenceId} ` +
      `${apercu.contenus} slideshows · ${apercu.medias} images · ${apercu.posts} posts · ` +
      `${apercu.sujets} sujets · ${apercu.importFile} file · ` +
      `${apercu.postersLies} posters · ${apercu.conjoints} conjoints`,
  );
  return apercu;
}

/** Retire des objets du bucket par paquets. Renvoie le nombre effacé. */
async function retirerFichiers(
  supabase: Supabase,
  chemins: string[],
  log: Journal["log"],
): Promise<number> {
  let n = 0;
  for (const lot of decouperEnLots([...new Set(chemins)], LOT_IDS)) {
    const { error } = await supabase.storage.from(BUCKET_MEDIAS).remove(lot);
    if (error) {
      log("warn", `storage.remove (${lot.length} chemins) : ${messageErreur(error)}`);
      continue;
    }
    n += lot.length;
  }
  return n;
}

/** Vide un dossier du bucket (fichiers orphelins compris). */
async function viderPrefixe(
  supabase: Supabase,
  prefixe: string,
  log: Journal["log"],
): Promise<number> {
  const { data, error } = await supabase.storage
    .from(BUCKET_MEDIAS)
    .list(prefixe, { limit: 500 });
  if (error) {
    log("warn", `storage.list ${prefixe} : ${messageErreur(error)}`);
    return 0;
  }
  if (!data) return 0;
  const chemins = data
    .filter((f) => f.id !== null)
    .map((f) => `${prefixe}/${f.name}`);
  if (chemins.length === 0) return 0;
  return await retirerFichiers(supabase, chemins, log);
}

/**
 * Supprime un paquet de slideshows et tout ce qui en dépend.
 * Même ordre que `supprimerContenu` côté admin : posts d'abord (ils référencent
 * les médias), storage ensuite, médias, puis le slideshow (qui emporte en
 * cascade labels, decks de langue et passages).
 */
async function supprimerContenus(
  supabase: Supabase,
  compteReferenceId: string,
  contenuIds: string[],
  log: Journal["log"],
): Promise<Partial<OubliCompteurs>> {
  if (contenuIds.length === 0) return {};

  const { data: contenus, error: errContenus } = await supabase
    .from("contenus")
    .select("id, source_url, structure_slides")
    .in("id", contenuIds);
  assertOk(errContenus, "Lecture des slideshows à supprimer", log);

  // 1 — Posts matérialisés (cascade : post_slides, métriques, tokens mobiles).
  const postIds = new Set<string>();
  const { data: passages, error: errPassages } = await supabase
    .from("passages")
    .select("post_id")
    .in("contenu_id", contenuIds)
    .not("post_id", "is", null);
  assertOk(errPassages, "Lecture des posts assignés", log);
  for (const p of passages ?? []) postIds.add(p.post_id as string);
  for (const lot of decouperEnLots([...postIds], LOT_IDS)) {
    const { error } = await supabase.from("posts").delete().in("id", lot);
    assertOk(error, `Suppression de ${lot.length} post(s)`, log);
  }
  if (postIds.size > 0) log("ok", `${postIds.size} post(s) assigné(s) supprimé(s)`);
  else log("info", "Aucun post assigné sur ce lot");

  // 2 — Médias cités par les slides ou rattachés au slideshow. Une slide ratée
  // peut avoir été remplacée par une image EMPRUNTÉE à la bibliothèque
  // (`mediaPropreMemeLabel`), qui appartient à un autre compte : on ne garde
  // que celles de cette source, les autres sont juste déliées.
  const candidats = new Set<string>();
  for (const c of contenus ?? []) {
    const slides = (c.structure_slides ?? []) as Array<{ media_id?: string | null }>;
    for (const s of slides) if (s.media_id) candidats.add(s.media_id);
  }
  const { data: mediasLies, error: errLies } = await supabase
    .from("media_library")
    .select("id")
    .in("contenu_id", contenuIds);
  assertOk(errLies, "Lecture des images liées", log);
  for (const m of mediasLies ?? []) candidats.add(m.id as string);

  const aSupprimer = new Set(contenuIds);
  const mediaIds: string[] = [];
  const chemins: string[] = [];
  let empruntees = 0;
  for (const lot of decouperEnLots([...candidats], LOT_IDS)) {
    const { data: medias, error } = await supabase
      .from("media_library")
      .select("id, storage_path, contenu_id, compte_reference_id")
      .in("id", lot);
    assertOk(error, "Lecture des images candidates", log);
    for (const m of medias ?? []) {
      const aNous =
        (m.contenu_id && aSupprimer.has(m.contenu_id as string)) ||
        m.compte_reference_id === compteReferenceId;
      if (!aNous) {
        empruntees += 1;
        continue;
      }
      mediaIds.push(m.id as string);
      if (m.storage_path) chemins.push(m.storage_path as string);
    }
  }
  let fichiers = await retirerFichiers(supabase, chemins, log);

  // 3 — Balayage des dossiers : un upload sans ligne en base bloquerait le
  // ré-import (storage_path unique).
  for (const c of contenus ?? []) {
    for (const prefixe of prefixesStorageContenu(c.id as string)) {
      fichiers += await viderPrefixe(supabase, prefixe, log);
    }
    const scrape = prefixeStorageScrape(c.source_url as string | null);
    if (scrape) fichiers += await viderPrefixe(supabase, scrape, log);
  }
  log("ok", `${fichiers} fichier(s) retiré(s) du bucket`);
  if (empruntees > 0) {
    log("info", `${empruntees} image(s) empruntée(s) conservée(s) (autre compte)`);
  }

  for (const lot of decouperEnLots(mediaIds, LOT_IDS)) {
    const { error } = await supabase.from("media_library").delete().in("id", lot);
    assertOk(error, `Suppression de ${lot.length} image(s)`, log);
  }
  if (mediaIds.length > 0) log("ok", `${mediaIds.length} image(s) supprimée(s)`);

  // 4 — Slideshows (cascade : contenu_labels, contenu_langues, passages).
  for (const lot of decouperEnLots(contenuIds, LOT_IDS)) {
    const { error } = await supabase.from("contenus").delete().in("id", lot);
    assertOk(error, `Suppression de ${lot.length} slideshow(s)`, log);
  }
  log("ok", `${contenuIds.length} slideshow(s) supprimé(s)`);

  return {
    contenus: contenuIds.length,
    medias: mediaIds.length,
    fichiers,
    posts: postIds.size,
  };
}

/** Sujets legacy + leurs visuels (chemin `propre/{sujetId}/`). */
async function supprimerSujets(
  supabase: Supabase,
  sujetIds: string[],
  log: Journal["log"],
): Promise<Partial<OubliCompteurs>> {
  if (sujetIds.length === 0) {
    log("info", "Aucun sujet legacy");
    return {};
  }
  let fichiers = 0;
  for (const id of sujetIds) {
    fichiers += await viderPrefixe(supabase, prefixeStorageSujet(id), log);
  }
  for (const lot of decouperEnLots(sujetIds, LOT_IDS)) {
    const { error } = await supabase.from("sujets").delete().in("id", lot);
    assertOk(error, `Suppression de ${lot.length} sujet(s)`, log);
  }
  log("ok", `${sujetIds.length} sujet(s) legacy supprimé(s) · ${fichiers} fichier(s)`);
  return { sujets: sujetIds.length, fichiers };
}

async function supprimerFileImport(
  supabase: Supabase,
  compteReferenceId: string,
  handle: string | null,
  log: Journal["log"],
): Promise<number> {
  const ids = await idsFileImportDeLaSource(supabase, compteReferenceId, handle);
  if (ids.length === 0) {
    log("info", "File d'import déjà vide");
    return 0;
  }
  for (const lot of decouperEnLots(ids, LOT_IDS)) {
    const { error } = await supabase.from("import_file").delete().in("id", lot);
    assertOk(error, `Suppression de ${lot.length} ligne(s) de file`, log);
  }
  log("ok", `${ids.length} ligne(s) de file d'import supprimée(s)`);
  return ids.length;
}

/** Médias restants directement rattachés à la source (avatar de référence…). */
async function supprimerMediasDeLaSource(
  supabase: Supabase,
  compteReferenceId: string,
  log: Journal["log"],
): Promise<Partial<OubliCompteurs>> {
  const { data: medias, error: errMedias } = await supabase
    .from("media_library")
    .select("id, storage_path")
    .eq("compte_reference_id", compteReferenceId)
    .limit(5000);
  assertOk(errMedias, "Lecture des images restantes de la source", log);
  const ids = (medias ?? []).map((m) => m.id as string);
  if (ids.length === 0) {
    log("info", "Aucune image restante rattachée à la source");
    return {};
  }

  const chemins = (medias ?? [])
    .map((m) => m.storage_path as string | null)
    .filter((p): p is string => Boolean(p));
  const fichiers = await retirerFichiers(supabase, chemins, log);
  for (const lot of decouperEnLots(ids, LOT_IDS)) {
    const { error } = await supabase.from("media_library").delete().in("id", lot);
    assertOk(error, `Suppression de ${lot.length} image(s) source`, log);
  }
  log("ok", `${ids.length} image(s) restante(s) de la source · ${fichiers} fichier(s)`);
  return { medias: ids.length, fichiers };
}

/**
 * Un passage d'oubli. Traite au plus `lot` slideshows puis rend la main, pour
 * tenir sous le mur Edge ; l'appelant rappelle tant que `termine` est faux.
 * Idempotent : rejouer un passage déjà fait ne casse rien.
 */
export async function oublierSourceLot(
  supabase: Supabase,
  compteReferenceId: string,
  lot = LOT_CONTENUS_DEFAUT,
): Promise<OubliResultat> {
  const journal = creerJournal();
  const { log } = journal;
  const handle = await handleDeLaSource(supabase, compteReferenceId);
  let supprimes = compteursVides();

  if (handle === null) {
    log(
      "warn",
      `Compte ${compteReferenceId} déjà absent de la liste — on solde les orphelins encore liés à cet id`,
    );
  } else {
    log("info", `Oubli de @${handle} (${compteReferenceId})`);
  }

  const contenuIds = await idsContenusDeLaSource(supabase, compteReferenceId, handle);
  log("info", `${contenuIds.length} slideshow(s) encore à traiter`);

  if (contenuIds.length > 0) {
    const paquet = contenuIds.slice(0, Math.max(1, lot));
    log(
      "info",
      `Passe : ${paquet.length} slideshow(s) sur ${contenuIds.length} (lot=${lot})`,
    );
    supprimes = cumulerCompteurs(
      supprimes,
      await supprimerContenus(supabase, compteReferenceId, paquet, log),
    );
    const restant = contenuIds.length - paquet.length;
    if (restant > 0) {
      log(
        "info",
        `Passe intermédiaire — ${resumeCompteurs(supprimes)} · encore ${restant} slideshow(s)`,
      );
      return { handle: handle ?? "", termine: false, restant, supprimes, journal: journal.lignes };
    }
  }

  // Plus aucun slideshow : on solde le reste et on retire le compte de la liste.
  log("info", "Plus de slideshow — solde des sujets, de la file et du compte");
  supprimes = cumulerCompteurs(
    supprimes,
    await supprimerSujets(
      supabase,
      await idsSujetsDeLaSource(supabase, compteReferenceId, handle),
      log,
    ),
  );
  supprimes = cumulerCompteurs(supprimes, {
    importFile: await supprimerFileImport(supabase, compteReferenceId, handle, log),
  });
  supprimes = cumulerCompteurs(
    supprimes,
    await supprimerMediasDeLaSource(supabase, compteReferenceId, log),
  );

  const { error: errExtractions } = await supabase
    .from("extractions")
    .delete()
    .eq("compte_reference_id", compteReferenceId);
  assertOk(errExtractions, "Suppression des extractions", log);
  log("ok", "Extractions de la source supprimées");

  // Les conjoints survivent : `parent_id` passe à NULL, ils redeviennent
  // autonomes plutôt que d'être emportés sans que l'admin l'ait demandé.
  const { error: errCompte } = await supabase
    .from("comptes_reference")
    .delete()
    .eq("id", compteReferenceId);
  assertOk(errCompte, "Suppression du compte source", log);
  log(
    "ok",
    handle
      ? `@${handle} retiré de la liste — total ${resumeCompteurs(supprimes)}`
      : `Id ${compteReferenceId} soldé — total ${resumeCompteurs(supprimes)}`,
  );

  return { handle: handle ?? "", termine: true, restant: 0, supprimes, journal: journal.lignes };
}
