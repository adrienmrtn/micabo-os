import { composerPost } from "../_shared/composer.ts";
import { assertAuthorised, json, serviceClient, todayIso } from "../_shared/supabase.ts";

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
  try {
    const body = await request.json();
    compteId = body?.compteId ?? null;
    date = body?.date ?? null;
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

    const resultats: Array<{ compteId: string; crees: number; erreur?: string }> = [];

    for (const compte of comptes ?? []) {
      try {
        const crees = await completerJournee(supabase, compte, jour, reglages);
        resultats.push({ compteId: compte.id, crees });
      } catch (error) {
        resultats.push({
          compteId: compte.id,
          crees: 0,
          erreur: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return json({ ok: true, jour, resultats });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
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
): Promise<number> {
  const enLancement = estEnSemaineUn(compte.demarre_le, jour, reglages.semaine1);
  const quota = enLancement ? reglages.semaine1.posts_par_jour : reglages.postsParJour;

  const { data: existants } = await supabase
    .from("posts")
    .select("id")
    .eq("compte_id", compte.id)
    .eq("date_publication_prevue", jour);

  const manquants = quota - (existants?.length ?? 0);
  if (manquants <= 0) return 0;

  let crees = 0;
  for (let i = 0; i < manquants; i += 1) {
    // Pendant la semaine de lancement le compte n'a pas d'historique propre :
    // on force le recyclage de structure, servi par les visuels du compte.
    const type = enLancement && reglages.semaine1.tout_recycle
      ? "recycle"
      : tirerType(reglages.repartition);

    const postId = await creerPost(supabase, compte, jour, type);
    if (!postId) break; // plus de matière disponible, inutile d'insister

    // Assigné : c'est ce statut qui le fait apparaître dans le calendrier du
    // poster. Un post composé mais non assigné resterait invisible pour lui.
    await supabase.from("posts").update({ statut: "assigne" }).eq("id", postId);
    crees += 1;
  }

  return crees;
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
): Promise<string | null> {
  if (type === "recycle") {
    const recycle = await recyclerMeilleurPost(supabase, compte, jour);
    if (recycle) return recycle;
  }

  const sujet = await choisirSujet(supabase, compte);
  if (!sujet) return null;

  return await composerPost(supabase, {
    compteId: compte.id,
    sujetId: sujet.id,
    type,
    date: jour,
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
      statut: "brouillon",
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
