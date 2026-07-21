import { creerPost as creerCoquille } from "../_shared/composer.ts";
import { assertAuthorised, json, messageErreur, serviceClient, todayIso } from "../_shared/supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;
type TypePost = "recycle" | "remanie" | "nouveau";

/**
 * Assignation quotidienne (cron de minuit). Pour chaque compte actif, complète
 * la journée jusqu'au nombre de posts prévu, en tirant le type selon les ratios
 * configurés — ou en forçant le recyclage pendant la semaine de lancement.
 *
 * Idempotente : elle ne crée que ce qui manque, donc la relancer ne double rien.
 *
 *   {}             → tous les comptes actifs
 *   { compteId }   → ce seul compte (essai admin)
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  let compteId: string | null = null;
  let date: string | null = null;
  let typeForce: TypePost | null = null;
  let forcer = false;
  try {
    const body = await request.json();
    compteId = body?.compteId ?? null;
    date = body?.date ?? null;
    typeForce = body?.type ?? null;
    // Mode test : on crée un post même si le quota du jour est déjà atteint,
    // sinon un second essai le même jour ne produirait rien.
    forcer = Boolean(body?.forcer);
  } catch {
    // Corps vide : tous les comptes, aujourd'hui.
  }

  const jour = date ?? todayIso();

  try {
    const reglages = await chargerReglages(supabase);

    let query = supabase.from("comptes").select("*").eq("is_active", true);
    if (compteId) query = query.eq("id", compteId);

    const { data: comptes, error } = await query;
    if (error) throw error;

    const resultats: Array<{
      compteId: string;
      crees: number;
      types?: string[];
      erreur?: string;
    }> = [];

    for (const compte of comptes ?? []) {
      try {
        const types = await completerJournee(
          supabase, compte, jour, reglages, typeForce, forcer,
        );
        resultats.push({ compteId: compte.id, crees: types.length, types });
      } catch (error) {
        resultats.push({
          compteId: compte.id,
          crees: 0,
          erreur: messageErreur(error),
        });
      }
    }

    return json({ ok: true, jour, resultats });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});

interface Reglages {
  repartition: Record<TypePost, number>;
  postsParJour: number;
  semaine1: { actif: boolean; jours: number; posts_par_jour: number; tout_recycle: boolean };
}

async function chargerReglages(supabase: Supabase): Promise<Reglages> {
  const { data } = await supabase.from("reglages").select("cle, valeur");
  const map = new Map((data ?? []).map((r) => [r.cle, r.valeur]));

  const repartition = map.get("repartition") ?? { recycle: 60, remanie: 20, nouveau: 20 };
  const frequence = map.get("frequence") ?? { posts_par_jour: 2 };
  const semaine1 = map.get("semaine1") ??
    { actif: true, jours: 7, posts_par_jour: 2, tout_recycle: true };

  return { repartition, postsParJour: frequence.posts_par_jour ?? 2, semaine1 };
}

/** Complète la journée d'un compte jusqu'au quota, et renvoie le nombre créé. */
// deno-lint-ignore no-explicit-any
async function completerJournee(
  supabase: Supabase,
  compte: any,
  jour: string,
  reglages: Reglages,
  typeForce: TypePost | null,
  forcer: boolean,
): Promise<string[]> {
  const enLancement = estEnSemaineUn(compte.demarre_le, jour, reglages.semaine1);

  // Les réglages du compte l'emportent sur les réglages globaux : c'est ce qui
  // permet de dédier un compte au seul recopiage sans toucher aux autres.
  const repartition = compte.repartition ?? reglages.repartition;
  const parJour = compte.posts_par_jour ?? reglages.postsParJour;
  const quota = enLancement ? reglages.semaine1.posts_par_jour : parJour;

  const { data: existants } = await supabase
    .from("posts")
    .select("id")
    .eq("compte_id", compte.id)
    .eq("date_publication_prevue", jour);

  const manquants = forcer ? 1 : quota - (existants?.length ?? 0);
  if (manquants <= 0) return [];

  // On renvoie le type RÉELLEMENT produit : recopiage et remaniement retombent
  // sur une composition normale quand le compte n'a pas d'historique, et
  // masquer ce repli rendrait un test trompeur.
  const produits: string[] = [];
  for (let i = 0; i < manquants; i += 1) {
    // Pendant la semaine de lancement le compte n'a pas d'historique propre :
    // on force le recyclage de structure, servi par les visuels du compte.
    const type = typeForce
      ?? (enLancement && reglages.semaine1.tout_recycle
        ? "recycle"
        : tirerType(repartition));

    // On ne crée que la coquille : la fabrication (traduction, placement) est
    // faite ensuite par le drain `composition`, étape par étape. Le post ne
    // passe en « assigné » qu'une fois prêt, donc il n'apparaît pas chez le
    // poster tant qu'il est vide.
    const resultat = await creerPost(supabase, compte, jour, type);
    if (!resultat) break; // plus de matière disponible, inutile d'insister
    produits.push(resultat.typeReel);
  }

  return produits;
}

function estEnSemaineUn(
  demarreLe: string,
  jour: string,
  semaine1: Reglages["semaine1"],
): boolean {
  if (!semaine1.actif) return false;
  const debut = new Date(demarreLe).getTime();
  const courant = new Date(jour).getTime();
  const jours = (courant - debut) / 86_400_000;
  return jours >= 0 && jours < semaine1.jours;
}

/** Tirage pondéré par les ratios de l'admin. */
function tirerType(repartition: Record<TypePost, number>): TypePost {
  const entrees = Object.entries(repartition) as Array<[TypePost, number]>;
  const total = entrees.reduce((somme, [, poids]) => somme + poids, 0);
  if (total <= 0) return "nouveau";

  let tirage = Math.random() * total;
  for (const [type, poids] of entrees) {
    tirage -= poids;
    if (tirage <= 0) return type;
  }
  return entrees[entrees.length - 1][0];
}

/**
 * Crée un post du type demandé. Le recyclage rejoue le meilleur post publié du
 * compte ; sans historique (compte neuf), il retombe sur une composition
 * normale — sinon un compte qui démarre n'aurait jamais rien à publier.
 */
// deno-lint-ignore no-explicit-any
async function creerPost(
  supabase: Supabase,
  compte: any,
  jour: string,
  type: TypePost,
): Promise<{ postId: string; typeReel: string } | null> {
  if (type === "recycle") {
    const recycle = await recyclerMeilleurPost(supabase, compte, jour);
    if (recycle) return { postId: recycle, typeReel: "recycle" };
  }

  if (type === "remanie") {
    const remanie = await remanierPost(supabase, compte, jour);
    if (remanie) return { postId: remanie, typeReel: "remanie" };
  }

  const sujet = await choisirSujet(supabase, compte);
  if (!sujet) return null;

  // Faute d'historique, un recopiage ou un remaniement devient un nouveau : on
  // le dit, plutôt que d'étiqueter un post avec un type qu'il n'a pas.
  const typeReel = type === "nouveau" ? type : `${type}→nouveau`;

  const postId = await creerCoquille(supabase, {
    compteId: compte.id,
    sujetId: sujet.id,
    type: "nouveau",
    date: jour,
  });
  return { postId, typeReel };
}

/**
 * Remanie un post existant : on reprend son sujet et ses visuels, mais tout le
 * texte est régénéré avec une consigne de reformulation. C'est ce qui distingue
 * un remanié d'un recyclé (copie à l'identique) et d'un nouveau (sujet inédit).
 *
 * Sans post antérieur à remanier, on renvoie null et l'appelant retombe sur une
 * composition normale.
 */
// deno-lint-ignore no-explicit-any
async function remanierPost(
  supabase: Supabase,
  compte: any,
  jour: string,
): Promise<string | null> {
  const { data: anciens } = await supabase
    .from("posts")
    .select("id, sujet_id")
    .eq("compte_id", compte.id)
    .not("sujet_id", "is", null)
    .in("statut", ["publie", "valide_par_poster"])
    .order("created_at")
    .limit(20);

  if (!anciens || anciens.length === 0) return null;

  // On évite de remanier deux fois le même aîné tant qu'il en reste d'autres.
  const { data: dejaRemanies } = await supabase
    .from("posts")
    .select("source_post_id")
    .eq("compte_id", compte.id)
    .eq("type", "remanie")
    .not("source_post_id", "is", null);

  const dejaVus = new Set((dejaRemanies ?? []).map((p) => p.source_post_id));
  const source = anciens.find((p) => !dejaVus.has(p.id)) ?? anciens[0];

  return await creerCoquille(supabase, {
    compteId: compte.id,
    sujetId: source.sujet_id!,
    type: "remanie",
    date: jour,
    sourcePostId: source.id,
  });
}

/** Duplique le post publié le plus performant du compte. */
// deno-lint-ignore no-explicit-any
async function recyclerMeilleurPost(
  supabase: Supabase,
  compte: any,
  jour: string,
): Promise<string | null> {
  const { data: candidats } = await supabase
    .from("posts")
    .select("id, sujet_id, musique_url, musique_titre, musique_plateforme, post_metrics(vues)")
    .eq("compte_id", compte.id)
    .eq("statut", "publie")
    .limit(50);

  if (!candidats || candidats.length === 0) return null;

  // On classe sur les vues du dernier relevé ; sans métrique, le post compte
  // pour zéro et passe donc après ceux qui ont fait leurs preuves.
  const meilleur = candidats
    .map((p) => ({
      post: p,
      // deno-lint-ignore no-explicit-any
      vues: Math.max(0, ...((p as any).post_metrics ?? []).map((m: any) => m.vues ?? 0)),
    }))
    .sort((a, b) => b.vues - a.vues)[0];

  if (!meilleur || meilleur.vues === 0) return null;

  const source = meilleur.post;
  const { data: nouveau, error } = await supabase
    .from("posts")
    .insert({
      compte_id: compte.id,
      sujet_id: source.sujet_id,
      type: "recycle",
      // Le recyclage copie les slides telles quelles : rien à fabriquer, donc
      // il ne passe pas par le drain de composition et est assigné d'emblée.
      statut: "assigne",
      date_publication_prevue: jour,
      source_post_id: source.id,
      musique_url: source.musique_url,
      musique_titre: source.musique_titre,
      musique_plateforme: source.musique_plateforme,
      pipeline_statut: "done",
    })
    .select()
    .single();
  if (error || !nouveau) return null;

  const { data: slides } = await supabase
    .from("post_slides")
    .select("position, media_id, texte_overlay, position_sophia")
    .eq("post_id", source.id)
    .order("position");

  if (slides && slides.length > 0) {
    await supabase
      .from("post_slides")
      .insert(slides.map((s) => ({ ...s, post_id: nouveau.id })));
  }

  return nouveau.id;
}

/** Un sujet préparé, retenu, encore inutilisé, tiré de la source du compte. */
// deno-lint-ignore no-explicit-any
async function choisirSujet(supabase: Supabase, compte: any) {
  let query = supabase
    .from("sujets")
    .select("id")
    .eq("preparation_statut", "done")
    .eq("statut", "retenu")
    .order("pertinence_score", { ascending: false })
    .limit(1);

  if (compte.compte_reference_id) {
    query = query.eq("compte_reference_id", compte.compte_reference_id);
  }

  const { data } = await query;
  return data?.[0] ?? null;
}
