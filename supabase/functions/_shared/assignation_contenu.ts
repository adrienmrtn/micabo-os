import {
  resoudreVisuelsAssignation,
  type SlideStructureVisuels,
} from "./visuels_assignation.ts";
import { assurerDeckPourLangue } from "./import_contenu.ts";
import {
  RECUL_MEME_COMPTE_JOURS,
  ajouterJoursParis,
  estTier,
  prioriserTiersHauts,
  type Tier,
} from "./tierlist.ts";
import { LOT_IDS, lireParLots } from "./lots.ts";
import { mapPool } from "./parallel.ts";
import { serviceClient, messageErreur } from "./supabase.ts";
import { extraireLabelsAssignables } from "./labels_systeme.ts";
import { messagePool, type EtatPoolCompte } from "./quota_pool.ts";
import {
  appliquerFaceSwapUgcPost,
  chargerPersonaUgc,
} from "./ugc_face_swap.ts";
import {
  estCycleComplet,
  estDoublonContenuJour,
  estErreurQuotaPostsJour,
  estPanneRpc,
  manquantsJusquaQuota,
  quotaPostsParJour,
} from "./assignation_quota.ts";

/** Comptes traités en parallèle. Gemini (trad + Sophia) est dans assurerDeck —
 *  trop large → 429 ; trop petit → assignation lente. */
const LARGEUR_ASSIGNATION = 6;

export { LOT_IDS, lireParLots };

/** Par invocation drain : assez petit pour finir avant timeout Edge / cron. */
const DRAIN_BATCH = 8;
const DRAIN_MAX_CHAIN = 40;

export type Supabase = ReturnType<typeof serviceClient>;

export interface AssignationReglages {
  postsParJour: number;
}

export async function chargerAssignationReglages(
  supabase: Supabase,
): Promise<AssignationReglages> {
  const { data } = await supabase.from("reglages").select("cle, valeur");
  const map = new Map((data ?? []).map((r) => [r.cle, r.valeur]));
  const frequence = (map.get("frequence") ?? { posts_par_jour: 1 }) as {
    posts_par_jour?: number;
  };
  return {
    postsParJour: Math.min(3, Math.max(1, frequence.posts_par_jour ?? 1)),
  };
}

/**
 * Repli quand le deck n'a pas de légende. Jeu localisé, aucun appel IA.
 *
 * Deux défauts corrigés le 17/09/2026 :
 *
 * 1. LE TURC MANQUAIT, et le repli était `?? HASHTAGS.fr`. Le turc est la plus
 *    grosse langue du réseau (8 comptes, 152 passages) : deux TikTok turcs sont
 *    partis en ligne avec « #pourtoi #savoir #fyp » et « #apprendre
 *    #culturegenerale #developpementpersonnel » les 08 et 13/09. Une langue
 *    inconnue rend maintenant une chaîne VIDE — un post sans légende vaut mieux
 *    qu'un post qui signale la mauvaise audience à l'algorithme.
 *
 * 2. LE POSITIONNEMENT ÉTAIT CELUI DE SOPHIA (#culturegenerale, #savoir,
 *    #cultura, #booktok) alors que les 17 comptes actifs sont micabo. Le dépôt
 *    l'écrit lui-même : « micabo = progrès en cours, pas culture générale ».
 *    Les tags parlent désormais de révisions, de fiches et d'examens — ce que
 *    l'IA produit déjà quand elle s'en charge (#methodedetude #revision
 *    #partiels). Les attrape-tout (#fyp, #pourtoi) sont retirés : le prompt de
 *    `genererHashtags` les interdit, le repli ne va pas dire l'inverse.
 */
const HASHTAGS: Record<string, string[]> = {
  fr: ["#revisions", "#flashcards", "#methodedetude", "#examens", "#partiels", "#etudiant", "#bac"],
  en: ["#studytips", "#flashcards", "#studytok", "#revision", "#exams", "#studentlife", "#activerecall"],
  es: ["#estudiar", "#flashcards", "#examenes", "#tecnicasdeestudio", "#selectividad", "#universidad"],
  tr: ["#dersçalışma", "#sınav", "#çalışmataktikleri", "#yks", "#tyt", "#öğrenci", "#tekrar"],
  de: ["#lernen", "#karteikarten", "#lerntipps", "#prüfung", "#abitur", "#studium"],
  it: ["#studiare", "#esami", "#metodidistudio", "#maturità", "#universita", "#ripasso"],
  pt: ["#estudar", "#flashcards", "#exames", "#metodosdeestudo", "#enem", "#universidade"],
};

function hashtagsPour(langue: string, seed: string): string {
  const pool = HASHTAGS[langue];
  // Pas de repli vers une autre langue : mieux vaut aucune légende qu'une
  // légende qui vise le mauvais pays.
  if (!pool) return "";
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const debut = h % pool.length;
  return [0, 1, 2].map((i) => pool[(debut + i) % pool.length]).join(" ");
}

interface Candidat {
  contenuId: string;
  tier: Tier | null;
  /** Passages encore à effectuer sur le cycle courant. */
  restants: number;
  musique_url: string | null;
  musique_titre: string | null;
  musique_plateforme: string | null;
  /** Repêché en D faute de passages dus (cycle d'1 passage ouvert au vol). */
  repeche: boolean;
}

interface ContenuCandidat {
  id: string;
  musique_url: string | null;
  musique_titre: string | null;
  musique_plateforme: string | null;
  ugc_compatible: boolean | null;
  tier: string | null;
  passages_cible: number | null;
  tier_maj_at: string | null;
}

/** PostgREST rend l'embed `posts(...)` en objet ou en tableau selon la relation. */
type PostLie = { est_test?: boolean | null } | Array<{ est_test?: boolean | null }> | null;

function estPassageDeTest(posts: PostLie | undefined): boolean {
  if (!posts) return false;
  const p = Array.isArray(posts) ? posts[0] : posts;
  return Boolean(p?.est_test);
}

interface PassageHisto {
  contenu_id: string;
  date_publication_prevue: string | null;
  posts?: PostLie;
}

/**
 * Tirage uniforme.
 *
 * Plus de softmax sur un score : le tier ne pondère pas le tirage, il fixe le
 * NOMBRE de passages dus. Un S+ sort donc plus souvent qu'un C parce qu'il a
 * 16 passages en attente contre 1, pas parce qu'il est mieux noté.
 */
export function tirerAuHasard<T>(candidats: T[]): T | null {
  if (candidats.length === 0) return null;
  return candidats[Math.floor(Math.random() * candidats.length)] ?? null;
}

/** Legacy — plus jamais produit depuis la tierlist. */
export interface QuotaBaisse {
  avant: number;
  apres: number;
  /** Diagnostic pool qui a déclenché la baisse. */
  raison: string;
}

export interface AssignationCompteDetail {
  ids: string[];
  /** Motif si rien (ou pas assez) n'a pu être créé — pour l'UI admin. */
  raison?: string;
  /**
   * Legacy : le quota d'un créateur ne baisse plus (tierlist + repêchage D).
   * Le champ reste pour ne pas casser les réponses Edge / UI historiques.
   */
  quotaBaisse?: QuotaBaisse;
}

/** Options d'assignation (test admin = posts invisibles + rollback). */
export interface AssignationOpts {
  forcer?: boolean;
  /** Posts `est_test` — hors calendriers créateurs. */
  test?: boolean;
  /** Ignore les cycles tierlist : pioche n'importe quel slideshow prêt (mode test). */
  ignorerElo?: boolean;
  /** Ignore `warmup_ends_at` (compte hors process OK). */
  ignorerWarmup?: boolean;
  /** Slideshows à ne pas re-piocher (ex. recharge créateur de ce post). */
  exclureContenuIds?: string[];
  /** Logs progression (stream NDJSON / UI test). */
  onLog?: (detail: string) => void;
}

/**
 * Matérialisation ratée = passage sans `post_id` + post sans slides.
 * Sans purge, le quota compte ces passages et le Planning affiche des
 * slideshows « assignés » vides.
 */
async function purgerAssignationIncomplete(
  supabase: Supabase,
  compteId: string,
  jour: string,
): Promise<void> {
  const { data: orphelins } = await supabase
    .from("passages")
    .select("id")
    .eq("compte_id", compteId)
    .eq("date_publication_prevue", jour)
    .is("post_id", null);
  for (const o of orphelins ?? []) {
    await supabase.from("passages").delete().eq("id", o.id);
  }

  const { data: posts } = await supabase
    .from("posts")
    .select("id")
    .eq("compte_id", compteId)
    .eq("date_publication_prevue", jour)
    .eq("est_test", false)
    .in("statut", ["brouillon", "assigne"]);
  for (const p of posts ?? []) {
    const { count } = await supabase
      .from("post_slides")
      .select("id", { count: "exact", head: true })
      .eq("post_id", p.id);
    if ((count ?? 0) > 0) continue;
    const { data: lie } = await supabase
      .from("passages")
      .select("id")
      .eq("post_id", p.id)
      .maybeSingle();
    if (!lie) {
      await supabase.from("posts").delete().eq("id", p.id);
    }
  }
}

/**
 * Assignation v-next pour un compte : reposts bonus dus, puis tirage au hasard
 * parmi les slideshows du pool qui ont encore des passages dus (tierlist).
 * Non-écrasement : on complète seulement jusqu'au quota du jour.
 */
// deno-lint-ignore no-explicit-any
export async function assignerCompteJour(
  supabase: Supabase,
  compte: any,
  jour: string,
  reglages: AssignationReglages,
  opts: AssignationOpts | boolean = {},
): Promise<AssignationCompteDetail> {
  const o: AssignationOpts = typeof opts === "boolean" ? { forcer: opts } : (opts ?? {});
  const forcer = Boolean(o.forcer);
  const estTest = Boolean(o.test);
  const ignorerElo = Boolean(o.ignorerElo ?? estTest);
  const log = (detail: string) => {
    try {
      o.onLog?.(detail);
    } catch {
      // ignore
    }
  };

  const brut = Number(compte.posts_par_jour ?? reglages.postsParJour ?? 1);
  // Toujours 1–3 : un compte actif doit TOUJOURS viser au moins 1 post/jour.
  // (L'ancien fallback « pool mince → 0 » est interdit.)
  const quota = quotaPostsParJour(brut);
  const langue: string = compte.langue ?? "fr";
  const ugcAi = Boolean(compte.ugc_ai);
  const ugcPersonaId = (compte.ugc_persona_id as string | null) ?? null;
  const nomCompte =
    (compte.persona_nom as string | null) ??
    (compte.handle_tiktok as string | null) ??
    String(compte.id).slice(0, 8);

  // Soigne les comptes restés à 0 après l'ancien fallback.
  if (!estTest && Number.isFinite(brut) && brut <= 0) {
    const { error: errHeal } = await supabase
      .from("comptes")
      .update({ posts_par_jour: 1 })
      .eq("id", compte.id);
    if (!errHeal) log(`Compte ${nomCompte} · quota 0→1 (plancher obligatoire)`);
  }

  log(`Compte ${nomCompte} · langue=${langue} · quota=${quota}${ugcAi ? " · UGC" : ""}${estTest ? " · test" : ""}`);

  if (ugcAi && !ugcPersonaId) {
    log("Échec : compte UGC sans persona");
    return {
      ids: [],
      raison:
        "Compte UGC AI sans persona — assigne un persona UGC (4 angles) sur le créateur.",
    };
  }

  // Purge les coquilles legacy recycle/remanie/nouveau du jour (non publiées,
  // sans passage) — sinon « Assigner » empile du Recyclé à côté du v-next.
  if (!forcer && !estTest) {
    const { data: legacy } = await supabase
      .from("posts")
      .select("id, type, statut")
      .eq("compte_id", compte.id)
      .eq("date_publication_prevue", jour)
      .eq("est_test", false)
      .in("type", ["recycle", "remanie", "nouveau"])
      .in("statut", ["brouillon", "assigne"]);
    for (const lp of legacy ?? []) {
      const { data: lie } = await supabase
        .from("passages")
        .select("id")
        .eq("post_id", lp.id)
        .maybeSingle();
      if (!lie) {
        await supabase.from("posts").delete().eq("id", lp.id);
      }
    }
  }

  // Toujours : passages orphelins / posts sans slides ne doivent pas
  // bloquer le quota ni apparaître comme « assignés ».
  if (!estTest) {
    await purgerAssignationIncomplete(supabase, compte.id as string, jour);
  }

  // Reposts bonus d'abord : ils occupent un créneau du jour.
  if (!estTest) {
    try {
      const bonus = await assignerRepostsBonusDuJour(supabase, compte.id as string, jour, log);
      if (bonus.length > 0) log(`${bonus.length} repost(s) bonus assigné(s)`);
    } catch (e) {
      // L'erreur d'un .rpc() est un objet PostgrestError, pas une Error :
      // `String(e)` donnerait « [object Object] ».
      log(`Reposts bonus ignorés : ${messageErreur(e)}`);
    }
  }

  // Quota prod / test séparés : les posts `est_test` n'entrent pas dans le
  // calendrier ni le quota de minuit réel.
  // On recompte aussi les posts : deux drains peuvent avoir déjà matérialisé
  // pendant qu'on préparait le deck.
  const dejaLa = await compterAssignationsJour(
    supabase,
    compte.id as string,
    jour,
    estTest,
  );
  // Non-écrasement : on ne touche pas aux passages déjà là, on complète
  // seulement jusqu'au quota (1–3) du compte.
  const manquants = manquantsJusquaQuota(quota, dejaLa, forcer);
  log(`Passages déjà là : ${dejaLa}/${quota} → à créer : ${manquants}`);
  if (manquants <= 0) {
    return { ids: [], raison: `Quota déjà rempli (${dejaLa}/${quota} passage(s) ce jour).` };
  }

  const { data: labelsCompte } = await supabase
    .from("compte_labels")
    .select("label_id, labels(nom, slug)")
    .eq("compte_id", compte.id);
  const { labelIds, labelNoms } = extraireLabelsAssignables(labelsCompte ?? []);
  // Sans labels : impossible d'intersecter. Le quota reste intact (le
  // remplissage en D garantit qu'il y a toujours de quoi servir dès qu'un
  // label est posé).
  if (labelIds.length === 0) {
    log("Échec : aucun label sur le compte");
    return {
      ids: [],
      raison:
        "Aucun label sur ce compte — ajoute un label (Bibliothèque / Compte) pour piocher.",
    };
  }
  log(`Labels : ${labelNoms.length ? labelNoms.join(", ") : `${labelIds.length} id(s)`}`);

  const crees: string[] = [];
  /** Contenu IDs déjà pris / exclus cette session (choisirContenu filtre dessus). */
  const contenusSession: string[] = [...(o.exclureContenuIds ?? [])];
  const maxTentatives = manquants + 8;
  /** Decks / matérialisations impossibles : cause distincte d'un pool trop mince. */
  let echecsDeck = 0;

  let persona = null;
  if (ugcAi && ugcPersonaId) {
    log("Chargement persona UGC…");
    persona = await chargerPersonaUgc(supabase, ugcPersonaId);
    if (!persona) {
      log("Échec : persona UGC introuvable");
      return {
        ids: [],
        raison: "Persona UGC introuvable — recrée / réassigne le persona du créateur.",
      };
    }
    log(`Persona UGC OK (${persona.id.slice(0, 8)})`);
  }

  for (let t = 0; t < maxTentatives && crees.length < manquants; t += 1) {
    // Course : un autre drain a pu finir 2 posts pendant le deck.
    if (!forcer) {
      const dejaMaintenant = await compterAssignationsJour(
        supabase,
        compte.id as string,
        jour,
        estTest,
      );
      if (dejaMaintenant >= quota) {
        log(`Quota déjà rempli (${dejaMaintenant}/${quota}) — stop (course)`);
        break;
      }
    }
    log(`Pioche contenu ${crees.length + 1}/${manquants} (tentative ${t + 1})…`);
    const choisi = await choisirContenu(
      supabase,
      compte.id,
      labelIds,
      jour,
      contenusSession,
      ugcAi,
      { ignorerElo, exclureTestsHisto: true },
    );
    if (!choisi) {
      log("Plus de candidat dans le pool");
      break;
    }
    contenusSession.push(choisi.contenuId);
    log(
      `Contenu ${choisi.contenuId.slice(0, 8)} · tier ${choisi.tier ?? "?"}` +
        (choisi.repeche ? " (repêché en D pour remplir)" : ` · ${choisi.restants} passage(s) dû(s)`) +
        ` — deck ${langue}…`,
    );

    // Traduction + Sophia à la demande (hors langue source) — pas à l'import.
    let slides: SlideLangue[];
    let hashtagsDeck = "";
    try {
      const deck = await assurerDeckPourLangue(supabase, choisi.contenuId, langue);
      slides = deck.slides;
      hashtagsDeck = deck.hashtags;
    } catch (e) {
      echecsDeck += 1;
      log(`Deck échoué : ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (!slides.length) {
      echecsDeck += 1;
      log("Deck vide — contenu suivant");
      continue;
    }
    log(`Deck prêt (${slides.length} slides) — matérialisation…`);
    // Hashtags issus du deck si dispo, sinon jeu localisé de repli.
    const hashtags = hashtagsDeck || hashtagsPour(langue, `${compte.id}-${jour}-${crees.length}`);
    if (!hashtags) {
      // Visible dans le journal du drain : une langue sans pool est une
      // omission à corriger, pas un cas normal.
      log(`Aucun hashtag pour la langue « ${langue} » — post sans légende`);
    } else if (!hashtagsDeck) {
      log(`Hashtags de repli (${langue}) — le deck n'en portait pas`);
    }

    // Passage + post + post_slides + lien : une seule transaction (0265). Un
    // process tué en cours de route ne laisse plus rien derrière lui.
    let creation: { passage_id: string; post_id: string };
    try {
      creation = await creerPublicationAtomique(supabase, {
        compteId: compte.id as string,
        contenuId: choisi.contenuId,
        langue,
        jour,
        slides,
        musique_url: choisi.musique_url,
        musique_titre: choisi.musique_titre,
        musique_plateforme: choisi.musique_plateforme,
        hashtags,
        estTest,
      });
    } catch (e) {
      // Trois issues distinctes, reconnues au SQLSTATE et au texte — c'est
      // pour ça que la fonction SQL ne rattrape rien.
      if (estDoublonContenuJour(e)) {
        // Course perdue : un autre worker a posé ce slideshow sur ce compte
        // aujourd'hui pendant qu'on fabriquait le deck. `contenusSession` le
        // porte déjà, la tentative suivante en piochera un autre.
        log(`Doublon du jour évité (course) — ${choisi.contenuId.slice(0, 8)} déjà posé`);
        continue;
      }
      if (estCycleComplet(e)) {
        // Course perdue sur le CYCLE : un autre worker a rempli la cible de ce
        // slideshow pendant qu'on fabriquait le deck (0274). `contenusSession`
        // le porte déjà, la tentative suivante en piochera un autre — le
        // créateur ne perd pas son post.
        log(`Cycle déjà plein (course) — ${choisi.contenuId.slice(0, 8)}, on repioche`);
        continue;
      }
      if (estErreurQuotaPostsJour(e)) {
        log("Quota déjà rempli (course SQL) — stop");
        break;
      }
      // Panne d'infrastructure (fonction absente du cache PostgREST, schéma
      // désynchronisé…) : elle se reproduira à chaque tentative. L'ancien code
      // faisait `throw` sur l'échec du passage ; sans ça, on brûlerait
      // `manquants + 8` decks — donc autant d'appels de traduction — avant
      // d'abandonner, et le diagnostic accuserait la traduction à tort.
      if (estPanneRpc(e)) throw e;
      log(`Création échouée : ${messageErreur(e)}`);
      echecsDeck += 1;
      continue;
    }
    const postId = creation.post_id;
    log(`Post ${postId.slice(0, 8)} créé`);

    // UGC AI : swap Nano Banana sur slides à visage (hors upscale ensuite).
    if (persona) {
      try {
        log("UGC face swap (Nano Banana)…");
        const swap = await appliquerFaceSwapUgcPost(supabase, {
          postId,
          compteId: compte.id as string,
          contenuId: choisi.contenuId,
          persona,
          onLog: log,
        });
        log(`Face swap : ${swap.swaps} ok · ${swap.echecs} échec(s)`);
      } catch (e) {
        // Post déjà utilisable avec médias d'origine — on ne rollback pas.
        log(`Face swap erreur (post gardé) : ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    crees.push(creation.passage_id);
    log(`Passage ${crees.length}/${manquants} prêt`);
  }

  if (crees.length < manquants) {
    const totalAssignes = dejaLa + crees.length;
    const diag = await diagnostiquerPoolVide(supabase, {
      labelIds,
      labelNoms,
      langue,
      ugcAi,
      applicationId: (compte.application_id as string | null) ?? null,
      dejaAssignes: totalAssignes,
      manquants: manquants - crees.length,
      echecsDeck,
    });
    log(diag);

    // Le quota du créateur ne baisse plus jamais : s'il n'y a pas assez de
    // passages dus, `choisirContenu` repêche un slideshow en D pour remplir.
    // Un trou vient donc d'un deck impossible ou d'un pool réellement vide.
    if (totalAssignes >= quota) {
      return { ids: crees };
    }
    if (crees.length === 0) {
      return { ids: [], raison: diag };
    }
    return {
      ids: crees,
      raison: `${crees.length}/${manquants} créé(s). ${diag}`,
    };
  }
  log(`Terminé : ${crees.length} passage(s)`);
  return { ids: crees };
}

/**
 * Explique pourquoi le quota n'est pas rempli, avec le même pool que
 * `choisirContenu` (labels ∩ slideshows prêts ∩ application).
 *
 * Le quota du créateur ne bouge plus : ce texte sert uniquement au diagnostic
 * admin (page Minuit / logs d'assignation).
 */
async function diagnostiquerPoolVide(
  supabase: Supabase,
  args: {
    labelIds: string[];
    labelNoms: string[];
    langue: string;
    ugcAi?: boolean;
    applicationId?: string | null;
    /** Slideshows déjà assignés à ce créateur pour ce jour. */
    dejaAssignes: number;
    /** Posts encore à créer. */
    manquants: number;
    echecsDeck?: number;
  },
): Promise<string> {
  const { labelIds, labelNoms, langue } = args;
  const ugcAi = Boolean(args.ugcAi);
  const labelsTxt = labelNoms.length > 0 ? labelNoms.join(", ") : `${labelIds.length} label(s)`;

  const liens = await lireParLots<{ contenu_id: string }>(
    labelIds,
    "Diagnostic — slideshows du label",
    (lot) => supabase.from("contenu_labels").select("contenu_id").in("label_id", lot),
  );
  const idsLabel = [...new Set(liens.map((l) => l.contenu_id))];
  if (idsLabel.length === 0) {
    return `Aucun slideshow tagué « ${labelsTxt} » dans la bibliothèque.`;
  }

  const prets = await lireParLots<{ id: string; tier: string | null }>(
    idsLabel,
    "Diagnostic — slideshows prêts",
    (lot) => {
      let q = supabase
        .from("contenus")
        .select("id, tier")
        .eq("statut", "valide")
        .eq("import_statut", "done")
        .eq("ugc_compatible", ugcAi)
        .in("id", lot);
      if (args.applicationId) q = q.eq("application_id", args.applicationId);
      return q;
    },
  );
  if (prets.length === 0) {
    return (
      `${idsLabel.length} slideshow(s) « ${labelsTxt} » mais aucun valide + import terminé` +
      (ugcAi ? " + checkmark UGC" : " (non-UGC)") +
      "."
    );
  }

  const etat: EtatPoolCompte = {
    labelsTxt,
    langue,
    candidats: prets.length,
    dejaAssignes: args.dejaAssignes,
    manquants: args.manquants,
    echecsDeck: args.echecsDeck,
  };
  return messagePool(etat);
}

interface SlideStructure {
  position: number;
  media_id?: string | null;
  raw_url?: string | null;
  reference_url?: string | null;
  pinned?: boolean;
  critere?: string | null;
}

interface SlideLangue {
  position: number;
  texte_overlay: string | null;
  position_sophia: boolean;
}

/**
 * Crée une publication complète : passage + post + post_slides + lien, en UNE
 * transaction côté Postgres (`creer_publication_atomique`, 0265).
 *
 * Ici on ne fait plus que des LECTURES avant l'appel : le contenu (pour
 * `sujet_id` et `structure_slides`) et la résolution des visuels. Les quatre
 * écritures partent ensemble. Un process tué — l'Edge coupe à 150 s — ne laisse
 * donc plus de post orphelin derrière lui.
 *
 * La fonction SQL ne rattrape aucune exception, volontairement : l'appelant
 * distingue trois issues au SQLSTATE et au texte (doublon du jour → repiocher,
 * quota plein → arrêter, le reste → échec de deck).
 */
async function creerPublicationAtomique(
  supabase: Supabase,
  args: {
    compteId: string;
    contenuId: string;
    langue: string;
    jour: string;
    slides: SlideLangue[];
    musique_url: string | null;
    musique_titre: string | null;
    musique_plateforme: string | null;
    hashtags: string;
    estTest?: boolean;
    bonusRepost?: boolean;
    repostBonusId?: string;
  },
): Promise<{ passage_id: string; post_id: string }> {
  const { data: contenu, error: errC } = await supabase
    .from("contenus")
    .select("id, sujet_id, structure_slides, titre")
    .eq("id", args.contenuId)
    .single();
  if (errC || !contenu) throw errC ?? new Error("Contenu introuvable pour pont post");

  if (!args.slides.length) {
    throw new Error("Deck vide — impossible de matérialiser le post");
  }

  const structure = (contenu.structure_slides ?? []) as SlideStructure[];
  // Positions parfois number / parfois string selon JSONB → clé normalisée.
  const parPos = new Map(structure.map((s) => [Number(s.position), s]));

  const { parPos: mediaResolus, logs: visuelsLogs } = await resoudreVisuelsAssignation(
    supabase,
    args.contenuId,
    structure.map((s) => ({
      position: Number(s.position),
      media_id: s.media_id ?? null,
      pinned: Boolean(s.pinned && s.media_id),
      critere: s.critere ?? null,
      raw_url: s.raw_url ?? null,
      reference_url: s.reference_url ?? null,
    })) as SlideStructureVisuels[],
  );
  if (visuelsLogs.some((l) => l.fallback)) {
    console.log(
      `[assignation] contenu=${args.contenuId} visuels ` +
        visuelsLogs
          .map((l) => `#${l.position}:${l.motif}`)
          .join(" · "),
    );
  }

  // Un visuel par position. Plus de pré-vérification d'existence en TS : la
  // fonction SQL fait un `left join media_library` et écrit NULL si le média a
  // disparu. La fenêtre entre la lecture et l'écriture, qui laissait passer une
  // FK violée, est fermée pour de bon.
  const visuels = args.slides.map((s) => {
    const position = Number(s.position);
    const visuel = parPos.get(position);
    return {
      position,
      media_id: mediaResolus.get(position) ?? visuel?.media_id ?? null,
      reference_url: visuel?.reference_url ?? visuel?.raw_url ?? null,
    };
  });

  const { data, error } = await supabase.rpc("creer_publication_atomique", {
    p_compte_id: args.compteId,
    p_contenu_id: args.contenuId,
    p_langue: args.langue,
    p_jour: args.jour,
    p_slides: args.slides.map((s) => ({
      position: Number(s.position),
      texte_overlay: s.texte_overlay ?? "",
      position_sophia: Boolean(s.position_sophia),
    })),
    p_visuels: visuels,
    p_visuels_resolution: visuelsLogs,
    p_sujet_id: contenu.sujet_id ?? null,
    p_musique_url: args.musique_url,
    p_musique_titre: args.musique_titre,
    p_musique_plateforme: args.musique_plateforme,
    p_hashtags: args.hashtags,
    p_est_test: Boolean(args.estTest),
    p_bonus_repost: Boolean(args.bonusRepost),
    p_repost_bonus_id: args.repostBonusId ?? null,
  });
  // On jette l'objet d'erreur TEL QUEL : `estDoublonContenuJour` exige
  // `code === "23505"`, que `new Error(error.message)` perdrait.
  if (error) throw error;

  const res = data as { passage_id?: string; post_id?: string } | null;
  if (!res?.passage_id || !res?.post_id) {
    throw new Error("creer_publication_atomique n'a rien renvoyé");
  }
  return { passage_id: res.passage_id, post_id: res.post_id };
}

/**
 * Reposts bonus dus pour ce créateur : un post qui a dépassé 50 000 vues est
 * rejoué à l'identique sur le MÊME compte 7 jours plus tard.
 *
 * Hors pool (pas besoin de label, de tier ni de passages dus) et hors cycle de
 * requalification, mais DANS le quota du jour : le repost occupe un des posts
 * quotidiens du créateur.
 */
export async function assignerRepostsBonusDuJour(
  supabase: Supabase,
  compteId: string,
  jour: string,
  log: (detail: string) => void,
): Promise<string[]> {
  const { data: dus, error } = await supabase
    .from("reposts_bonus")
    .select("id, passage_source_id, contenu_id, langue, vues_declencheur")
    .eq("compte_id", compteId)
    .eq("statut", "prevu")
    .lte("jour_prevu", jour);
  if (error) throw error;
  if (!dus || dus.length === 0) return [];

  const crees: string[] = [];
  for (const repost of dus) {
    const { data: source } = await supabase
      .from("passages")
      .select("id, slides, hashtags, musique_url, musique_titre, musique_plateforme, langue")
      .eq("id", repost.passage_source_id)
      .maybeSingle();
    if (!source) {
      await supabase
        .from("reposts_bonus")
        .update({ statut: "abandonne", raison: "Passage source introuvable" })
        .eq("id", repost.id);
      continue;
    }

    const slides = (source.slides ?? []) as SlideLangue[];
    if (!Array.isArray(slides) || slides.length === 0) {
      await supabase
        .from("reposts_bonus")
        .update({ statut: "abandonne", raison: "Deck source vide" })
        .eq("id", repost.id);
      continue;
    }

    const langue = (source.langue as string) ?? (repost.langue as string);
    // `p_repost_bonus_id` solde `reposts_bonus` DANS la transaction : sinon une
    // mort entre le commit et la mise à jour laissait le repost en « prevu »,
    // et il repartait le lendemain — l'index anti-doublon du jour ne le
    // rattrape pas, il exclut les reposts bonus.
    let creation: { passage_id: string; post_id: string };
    try {
      creation = await creerPublicationAtomique(supabase, {
        compteId,
        contenuId: repost.contenu_id as string,
        langue,
        jour,
        slides,
        musique_url: source.musique_url as string | null,
        musique_titre: source.musique_titre as string | null,
        musique_plateforme: source.musique_plateforme as string | null,
        hashtags: (source.hashtags as string | null) ?? "",
        estTest: false,
        bonusRepost: true,
        repostBonusId: repost.id as string,
      });
    } catch (e) {
      if (estErreurQuotaPostsJour(e)) {
        log("Repost bonus : quota du jour déjà plein — reporté");
        break;
      }
      log(`Repost bonus non matérialisé : ${messageErreur(e)}`);
      continue;
    }

    crees.push(creation.passage_id);
    log(
      `Repost bonus J+7 (${repost.vues_declencheur ?? "?"} vues) — slideshow ` +
        `${String(repost.contenu_id).slice(0, 8)} rejoué à l'identique`,
    );
  }
  return crees;
}

/**
 * Passages restants d'un cycle, par contenu.
 * Cycle = passages créés depuis `tier_maj_at`, hors reposts bonus et hors tests.
 */
async function restantsParContenu(
  supabase: Supabase,
  cycles: Array<{ id: string; passages_cible: number; tier_maj_at: string | null }>,
): Promise<Map<string, number>> {
  const ouverts = cycles.filter((c) => c.passages_cible > 0 && c.tier_maj_at);
  const restants = new Map<string, number>();
  if (ouverts.length === 0) return restants;

  const debut = ouverts
    .map((c) => c.tier_maj_at as string)
    .reduce((a, b) => (a < b ? a : b));
  const faits = await lireParLots<{
    contenu_id: string;
    created_at: string;
    bonus_repost: boolean | null;
    posts?: PostLie;
  }>(
    ouverts.map((c) => c.id),
    "Passages du cycle",
    (lot) =>
      supabase
        .from("passages")
        .select("contenu_id, created_at, bonus_repost, posts(est_test)")
        .in("contenu_id", lot)
        .gte("created_at", debut),
  );

  const compte = new Map<string, number>();
  const debutCycle = new Map(ouverts.map((c) => [c.id, Date.parse(c.tier_maj_at as string)]));
  for (const f of faits) {
    if (f.bonus_repost) continue;
    if (estPassageDeTest(f.posts)) continue;
    const dc = debutCycle.get(f.contenu_id);
    if (dc == null || Date.parse(f.created_at) < dc) continue;
    compte.set(f.contenu_id, (compte.get(f.contenu_id) ?? 0) + 1);
  }
  for (const c of ouverts) {
    restants.set(c.id, Math.max(0, c.passages_cible - (compte.get(c.id) ?? 0)));
  }
  return restants;
}

/**
 * Pioche le slideshow du prochain post d'un créateur.
 *
 * 1. pool = labels du créateur ∩ slideshows prêts (famille UGC, application) ;
 * 2. candidats = ceux dont le cycle a encore des passages dus → tirage uniforme,
 *    mais un C n'est tiré que s'il ne reste plus rien en B ou mieux ;
 * 3. si plus aucun passage dû dans le pool : repêchage d'un slideshow en D au
 *    hasard, avec un cycle d'1 passage ouvert au vol (« pas assez de posts à
 *    faire → on remet quelques posts en D pour remplir »).
 *
 * Un même slideshow peut repasser sur un compte qui l'a déjà posté un autre
 * jour ; il ne peut pas sortir deux fois le MÊME jour sur le même compte.
 * La langue ne filtre plus rien : le deck est traduit à la demande.
 */
async function choisirContenu(
  supabase: Supabase,
  compteId: string,
  labelIds: string[],
  jour: string,
  dejaCreesCetteSession: string[],
  ugcAi = false,
  opts: { ignorerElo?: boolean; exclureTestsHisto?: boolean } = {},
): Promise<Candidat | null> {
  // Mode test : on ignore les cycles (n'importe quel slideshow prêt fait l'affaire).
  const ignorerCycles = Boolean(opts.ignorerElo);
  const { data: compteApp } = await supabase
    .from("comptes")
    .select("application_id")
    .eq("id", compteId)
    .maybeSingle();
  const applicationId = (compteApp?.application_id as string | undefined) ?? null;

  // Contenu IDs portant au moins un label du compte
  const liens = await lireParLots<{ contenu_id: string }>(
    labelIds,
    "Slideshows du label",
    (lot) => supabase.from("contenu_labels").select("contenu_id").in("label_id", lot),
  );
  const contenusLabel = [...new Set(liens.map((l) => l.contenu_id))];
  if (contenusLabel.length === 0) return null;

  // UGC AI ↔ slideshows ugc_compatible ; créateurs classiques ↔ non-UGC.
  const contenus = await lireParLots<ContenuCandidat>(
    contenusLabel,
    "Slideshows prêts",
    (lot) => {
      let q = supabase
        .from("contenus")
        .select(
          "id, musique_url, musique_titre, musique_plateforme, ugc_compatible, tier, passages_cible, tier_maj_at",
        )
        .eq("statut", "valide")
        .eq("import_statut", "done")
        .eq("ugc_compatible", ugcAi)
        .in("id", lot);
      if (applicationId) q = q.eq("application_id", applicationId);
      return q;
    },
  );
  if (contenus.length === 0) return null;

  // Déjà sorti RÉCEMMENT sur ce compte. La fenêtre portait sur le jour même
  // jusqu'au 19/09/2026 — « un même slideshow peut revenir un autre jour » —
  // et c'est exactement ce qu'elle laissait faire : 46 posts sont partis deux
  // fois en ligne sur le même compte, à 1 à 10 jours d'écart. L'historique
  // était pourtant en base, il n'était simplement jamais relu au-delà du jour.
  const depuis = ajouterJoursParis(jour, -RECUL_MEME_COMPTE_JOURS);
  const recents = await lireParLots<PassageHisto>(
    contenus.map((c) => c.id),
    `Passages des ${RECUL_MEME_COMPTE_JOURS} derniers jours`,
    (lot) =>
      supabase
        .from("passages")
        .select("contenu_id, date_publication_prevue, posts(est_test)")
        .eq("compte_id", compteId)
        .gte("date_publication_prevue", depuis)
        .in("contenu_id", lot),
  );
  const exclus = new Set<string>(dejaCreesCetteSession);
  for (const h of recents) {
    if (opts.exclureTestsHisto && estPassageDeTest(h.posts)) continue;
    exclus.add(h.contenu_id);
  }

  const pool = contenus.filter((c) => !exclus.has(c.id));
  if (pool.length === 0) return null;

  const versCandidat = (c: ContenuCandidat, restants: number, repeche: boolean): Candidat => ({
    contenuId: c.id,
    tier: estTier(c.tier) ? c.tier : null,
    restants,
    musique_url: c.musique_url,
    musique_titre: c.musique_titre,
    musique_plateforme: c.musique_plateforme,
    repeche,
  });

  if (ignorerCycles) {
    const pick = tirerAuHasard(pool);
    return pick ? versCandidat(pick, 0, false) : null;
  }

  const restants = await restantsParContenu(
    supabase,
    pool.map((c) => ({
      id: c.id,
      passages_cible: Number(c.passages_cible ?? 0),
      tier_maj_at: (c.tier_maj_at as string | null) ?? null,
    })),
  );

  const dus = pool.filter((c) => (restants.get(c.id) ?? 0) > 0);
  // Un C n'est tiré que si le pool n'a plus de B+ à servir.
  const pick = tirerAuHasard(prioriserTiersHauts(dus));
  if (pick) return versCandidat(pick, restants.get(pick.id) ?? 0, false);

  // Remplissage : pas assez de passages dus → on repêche un slideshow en D
  // (ou jamais placé) et on lui ouvre un cycle d'un passage.
  const repechables = pool.filter(
    (c) => !estTier(c.tier) || c.tier === "D" || Number(c.passages_cible ?? 0) === 0,
  );
  const repeche = tirerAuHasard(repechables);
  if (!repeche) return null;

  const { error } = await supabase
    .from("contenus")
    .update({
      tier: estTier(repeche.tier) ? repeche.tier : "D",
      passages_cible: 1,
      tier_maj_at: new Date().toISOString(),
    })
    .eq("id", repeche.id);
  if (error) throw error;

  return versCandidat(repeche, 1, true);
}

/** Assigne tous les comptes actifs pour un jour. */
export type AssignationCompteResultat = {
  compteId: string;
  crees: number;
  passageIds?: string[];
  erreur?: string;
  raison?: string;
  quotaBaisse?: QuotaBaisse & { nom?: string };
};

/** Comptes en process (warmup OK, pas UGC video) encore sous leur quota du jour. */
export async function listerComptesSousQuota(
  supabase: Supabase,
  jour: string,
  opts: { ignorerWarmup?: boolean } = {},
  // deno-lint-ignore no-explicit-any
): Promise<any[]> {
  const { data: comptesBruts, error } = await supabase
    .from("comptes")
    .select("*")
    .eq("is_active", true);
  if (error) throw error;

  const maintenant = Date.now();
  const comptes = (comptesBruts ?? []).filter((c) => {
    // Quota 0 (legacy) = toujours à traiter (plancher 1).
    if (opts.ignorerWarmup) return true;
    const ends = c.warmup_ends_at as string | null | undefined;
    if (!ends) return false;
    return new Date(ends).getTime() <= maintenant;
  });
  if (comptes.length === 0) return [];

  const ids = comptes.map((c) => c.id as string);
  const faits = new Map<string, number>();
  // Chunks pour éviter les .in() trop longs.
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { data: posts } = await supabase
      .from("posts")
      .select("compte_id")
      .in("compte_id", chunk)
      .eq("date_publication_prevue", jour)
      .eq("est_test", false);
    for (const p of posts ?? []) {
      const cid = p.compte_id as string;
      faits.set(cid, (faits.get(cid) ?? 0) + 1);
    }
  }

  return comptes.filter((c) => {
    const q = quotaPostsParJour(c.posts_par_jour ?? 1);
    return (faits.get(c.id as string) ?? 0) < q;
  });
}

/** Passages liés + posts du jour (max) — les deux peuvent diverger en course. */
async function compterAssignationsJour(
  supabase: Supabase,
  compteId: string,
  jour: string,
  estTest: boolean,
): Promise<number> {
  const { data: existants } = await supabase
    .from("passages")
    .select("id, posts!inner(est_test)")
    .eq("compte_id", compteId)
    .eq("date_publication_prevue", jour)
    .eq("posts.est_test", estTest);
  const { count: nPosts } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("compte_id", compteId)
    .eq("date_publication_prevue", jour)
    .eq("est_test", estTest);
  return Math.max(existants?.length ?? 0, nPosts ?? 0);
}

/**
 * Drain : un lot de comptes sous-quota, puis auto-chaîne tant qu'il en reste.
 * Évite le timeout cron (280s) qui laissait 50+ comptes sans post.
 */
export async function assignerDrainLot(
  supabase: Supabase,
  jour: string,
  opts: AssignationOpts = {},
): Promise<{
  resultats: AssignationCompteResultat[];
  restants: number;
  traites: number;
}> {
  const sousQuota = await listerComptesSousQuota(supabase, jour, {
    ignorerWarmup: Boolean(opts.ignorerWarmup),
  });
  const lot = sousQuota.slice(0, DRAIN_BATCH);
  if (lot.length === 0) {
    return { resultats: [], restants: 0, traites: 0 };
  }
  const reglages = await chargerAssignationReglages(supabase);
  const resultats = await mapPool(lot, LARGEUR_ASSIGNATION, async (compte) => {
    const nom =
      (compte.persona_nom as string | null) ??
      (compte.handle_tiktok as string | null) ??
      String(compte.id).slice(0, 8);
    try {
      const detail = await assignerCompteJour(supabase, compte, jour, reglages, opts);
      return {
        compteId: compte.id as string,
        crees: detail.ids.length,
        passageIds: detail.ids,
        raison: detail.raison,
        quotaBaisse: detail.quotaBaisse
          ? { ...detail.quotaBaisse, nom }
          : undefined,
      };
    } catch (e) {
      return {
        compteId: compte.id as string,
        crees: 0,
        erreur: e instanceof Error ? e.message : String(e),
      };
    }
  });
  return {
    resultats,
    restants: Math.max(0, sousQuota.length - lot.length),
    traites: lot.length,
  };
}

/** Kick fire-and-forget du drain assignation (auto-chaîne côté Edge). */
export function kickAssignationDrain(
  request: Request,
  body: Record<string, unknown>,
): void {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) return;
  const secret = Deno.env.get("CRON_SECRET");
  const auth = request.headers.get("Authorization");
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (secret) headers["x-cron-secret"] = secret;
  else if (auth) headers.Authorization = auth;

  const target = `${url}/functions/v1/assignation`;
  const edge = (globalThis as {
    EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void };
  }).EdgeRuntime;

  const p = fetch(target, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, drain: true }),
  }).catch(() => null);
  if (edge?.waitUntil) edge.waitUntil(p);
}

export async function assignerTousComptes(
  supabase: Supabase,
  jour: string,
  compteId: string | null = null,
  opts: AssignationOpts | boolean = {},
): Promise<AssignationCompteResultat[]> {
  const o: AssignationOpts = typeof opts === "boolean" ? { forcer: opts } : (opts ?? {});
  const reglages = await chargerAssignationReglages(supabase);
  let query = supabase.from("comptes").select("*").eq("is_active", true);
  if (compteId) query = query.eq("id", compteId);
  const { data: comptesBruts, error } = await query;
  if (error) throw error;

  // Warmup : uniquement les comptes dont warmup_ends_at est passé (en process).
  // Mode test : on peut cibler un compte hors process (ignorerWarmup).
  const maintenant = Date.now();
  const comptes = (comptesBruts ?? []).filter((c) => {
    if (o.ignorerWarmup) return true;
    const ends = c.warmup_ends_at as string | null | undefined;
    if (!ends) return false; // pas démarré → hors process
    return new Date(ends).getTime() <= maintenant;
  });

  return await mapPool(comptes, LARGEUR_ASSIGNATION, async (compte) => {
    const nom =
      (compte.persona_nom as string | null) ??
      (compte.handle_tiktok as string | null) ??
      String(compte.id).slice(0, 8);
    try {
      const detail = await assignerCompteJour(supabase, compte, jour, reglages, o);
      return {
        compteId: compte.id as string,
        crees: detail.ids.length,
        passageIds: detail.ids,
        raison: detail.raison,
        quotaBaisse: detail.quotaBaisse
          ? { ...detail.quotaBaisse, nom }
          : undefined,
      };
    } catch (e) {
      return {
        compteId: compte.id as string,
        crees: 0,
        erreur: e instanceof Error ? e.message : String(e),
      };
    }
  });
}

export { DRAIN_MAX_CHAIN };

/**
 * Annule une assignation test : supprime posts `est_test` + passages liés
 * (+ médias UGC face-swap créés pour ces posts). Comme si rien n'avait existé.
 */
export async function annulerAssignationTest(
  supabase: Supabase,
  compteId: string,
  jour: string,
): Promise<{ posts: number; passages: number; medias: number }> {
  const { data: posts } = await supabase
    .from("posts")
    .select("id")
    .eq("compte_id", compteId)
    .eq("date_publication_prevue", jour)
    .eq("est_test", true);
  const postIds = (posts ?? []).map((p) => p.id as string);
  if (postIds.length === 0) {
    return { posts: 0, passages: 0, medias: 0 };
  }

  const { data: passages } = await supabase
    .from("passages")
    .select("id")
    .in("post_id", postIds);
  const passageIds = (passages ?? []).map((p) => p.id as string);

  const { data: slides } = await supabase
    .from("post_slides")
    .select("media_id")
    .in("post_id", postIds)
    .not("media_id", "is", null);
  const mediaIds = [...new Set((slides ?? []).map((s) => s.media_id as string).filter(Boolean))];

  let mediasUgc: string[] = [];
  if (mediaIds.length > 0) {
    const { data: medias } = await supabase
      .from("media_library")
      .select("id, ugc_face_regen, storage_path")
      .in("id", mediaIds)
      .eq("ugc_face_regen", true);
    mediasUgc = (medias ?? []).map((m) => m.id as string);
    const paths = (medias ?? [])
      .map((m) => m.storage_path as string | null)
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await supabase.storage.from("medias").remove(paths).catch(() => null);
    }
  }

  if (passageIds.length > 0) {
    await supabase.from("passages").delete().in("id", passageIds);
  }
  await supabase.from("posts").delete().in("id", postIds);
  if (mediasUgc.length > 0) {
    await supabase.from("media_library").delete().in("id", mediasUgc);
  }

  return {
    posts: postIds.length,
    passages: passageIds.length,
    medias: mediasUgc.length,
  };
}
