/**
 * Essai à blanc des variantes d'un slideshow gagnant (02/10/2026).
 *
 *   { contenuId, n? } → 202 { ok, essai }   puis la ligne `essai_variations`
 *
 * Demande d'Adrien : pour chaque slideshow qui a fait au moins 50 000 vues chez
 * nous, deux ou trois slideshows « dans le même style », à valider dans la
 * file. Décisions : CONTENU NEUF (même format, même hook, même ton, même
 * nombre de slides — mais d'autres idées, pas une reformulation), et des
 * images du MÊME compte source, choisies par leur légende pour coller à la
 * slide, jamais celles du parent.
 *
 * Cet essai fabrique les variantes comme le ferait l'automate, et s'arrête
 * avant la file : rien dans `contenus`, `contenu_langues` ni `media_library`.
 * Le placement micabo est simulé comme la production le ferait à
 * l'assignation (`placement_micabo`, corrections, règles de la marque), pour
 * juger un post entier et pas une liste de textes.
 *
 * Le travail dépasse le délai d'un appel `pg_net` (120 s) : la fonction rend
 * la main tout de suite et range son résultat dans `essai_variations` (RLS,
 * aucune policy), la seule table qu'elle écrit.
 */

import { type Concurrent, CONCURRENTS_DEFAUT, concurrentsCites, versMicaboDepuis } from "../_shared/concurrents.ts";
import { callWithFallback, integrateSophia, MODELES_LECTURE_BURN, textOf, TEXT_MODELS } from "../_shared/gemini.ts";
import { nettoyerTexteDeck } from "../_shared/marque.ts";
import { citeMicabo } from "../_shared/placement.ts";
import { assertAuthorised, chargerPrompt, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

type SlideDeck = { position: number; texte_overlay: string | null; position_sophia?: boolean };
type Image = { id: string; url: string; caption: string | null; est_hook: boolean | null; contenu_id: string | null };
type SlideVariante = { position: number; texte: string; media_id: string; pourquoi_image?: string };
type Variante = { titre: string; angle: string; slides: SlideVariante[] };

/** Créatif et long : Claude d'abord, Gemini en repli. */
const MODELES_VARIANTES = [...MODELES_LECTURE_BURN, ...TEXT_MODELS];

function consigne(input: {
  langue: string;
  vues: number;
  titre: string;
  deck: SlideDeck[];
  imagesParent: Map<number, string>;
  pool: Image[];
  n: number;
}): string {
  const deck = input.deck
    .map((s) => {
      const img = input.imagesParent.get(s.position);
      const texte = s.position_sophia
        ? "(EMPLACEMENT DU PLACEMENT micabo — ignore ce texte : à cette place, écris une slide de contenu ordinaire, comme ses voisines)"
        : `« ${s.texte_overlay ?? ""} »`;
      return `Slide ${s.position}${img ? ` [image : ${img}]` : ""} : ${texte}`;
    })
    .join("\n\n");
  const pool = input.pool
    .map((i) => `${i.id} · ${i.est_hook ? "[couverture] " : ""}${i.caption ?? "(sans légende)"}`)
    .join("\n");
  const nb = input.deck.length;
  return `Tu écris pour un réseau de comptes TikTok d'élèves et d'étudiants qui révisent. Langue : ${input.langue}.

Ce slideshow a fait ${input.vues.toLocaleString("fr-FR")} vues chez nous. On veut ${input.n} NOUVEAUX slideshows dans le même moule.

LE PARENT
Légende : « ${input.titre} »

${deck}

CE QU'IL FAUT GARDER — le moule
- Exactement ${nb} slides, chacune avec le même RÔLE que la slide du parent à la même position (couverture, puis chaque élément de la liste, puis la fin s'il y en a une).
- La même promesse de couverture et la même voix : même personne (je / tu), même registre, même humour, même façon de parler d'un élève.
- La même forme de slide : même longueur à peu près (nombre de lignes, longueur des lignes), mêmes retours à la ligne, même construction (par exemple : une phrase-titre, puis l'exemple concret, puis l'explication, puis la chute).
- La couverture peut reprendre la promesse du parent presque mot pour mot, ou la décliner. Les deux sont permis, varie entre les ${input.n} slideshows.

CE QUI DOIT ÊTRE NEUF — le contenu
- Chaque élément de liste est une IDÉE DIFFÉRENTE de toutes celles du parent : pas une reformulation, pas la même astuce avec d'autres mots, pas un exemple voisin. Si le parent parle de chewing-gum, aucune variante ne parle de goût, de saveur ou d'odeur.
- Les ${input.n} slideshows ne se recopient pas entre eux non plus : aucune idée ne revient deux fois.
- Tout ce qui est affirmé doit être vrai et vérifiable : un vrai effet de psychologie ou de mémoire, une vraie technique, un vrai nom. N'invente ni étude, ni chiffre, ni nom d'effet. En cas de doute, reste concret et n'avance pas de science.
- Aucun nom d'application, de site, de marque ou de personne. Ne cite jamais micabo : la slide micabo est ajoutée après toi.
- Pas de tiret long (—). Pas d'emoji si le parent n'en a pas.
- Rien qui ne parle pas à un élève ou un étudiant qui révise.

LES IMAGES
Pour chaque slide, choisis UNE image dans la liste ci-dessous (identifiant exact), qui illustre CETTE slide : le décor, l'objet ou la situation dont parle la slide. Pour la couverture, prends de préférence une image marquée [couverture]. Jamais deux fois la même image dans un slideshow, et pas deux fois la même image entre les ${input.n} slideshows. Si aucune image ne colle vraiment, prends la plus neutre (bureau, cahier, élève qui travaille), jamais une image qui contredit la slide.

${pool}

LÉGENDE TikTok : une phrase dans le ton du parent puis 3 à 5 hashtags de révision, comme la légende du parent.

Réponds en JSON strict, rien d'autre :
{"variantes":[{"angle":"en une phrase, ce qui change par rapport au parent","titre":"la légende TikTok","slides":[{"position":1,"texte":"…","media_id":"…","pourquoi_image":"en quelques mots"}]}]}`;
}

function lireVariantes(brut: string): Variante[] {
  const m = brut.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`réponse sans JSON : ${brut.slice(0, 200)}`);
  const v = JSON.parse(m[0]) as { variantes?: unknown };
  if (!Array.isArray(v.variantes)) throw new Error("pas de tableau variantes");
  return (v.variantes as Array<Record<string, unknown>>).map((x) => ({
    titre: String(x.titre ?? ""),
    angle: String(x.angle ?? ""),
    slides: (Array.isArray(x.slides) ? x.slides : []).map((s: Record<string, unknown>) => ({
      position: Number(s.position),
      texte: String(s.texte ?? ""),
      media_id: String(s.media_id ?? ""),
      pourquoi_image: s.pourquoi_image ? String(s.pourquoi_image) : undefined,
    })),
  }));
}

/** Ce que l'automate refuserait d'écrire : on le signale au lieu de le cacher. */
function defauts(v: Variante, nb: number, pool: Map<string, Image>, concurrents: Concurrent[]): string[] {
  const d: string[] = [];
  if (v.slides.length !== nb) d.push(`${v.slides.length} slides au lieu de ${nb}`);
  const vus = new Set<string>();
  for (const s of v.slides) {
    if (!pool.has(s.media_id)) d.push(`slide ${s.position} : image hors du pool (${s.media_id})`);
    if (vus.has(s.media_id)) d.push(`slide ${s.position} : image déjà prise`);
    vus.add(s.media_id);
    if (citeMicabo(s.texte)) d.push(`slide ${s.position} : cite micabo`);
    const c = concurrentsCites(s.texte, concurrents);
    if (c.length > 0) d.push(`slide ${s.position} : cite ${c.join(", ")}`);
    if (s.texte.includes("—")) d.push(`slide ${s.position} : tiret long`);
  }
  return d;
}

async function essayer(contenuId: string, n: number): Promise<Record<string, unknown>> {
  const supabase = serviceClient();
  const { data: parent, error } = await supabase
    .from("contenus")
    .select("id, titre, langue_source, compte_reference_id, structure_slides")
    .eq("id", contenuId)
    .single();
  if (error || !parent) throw new Error(`parent introuvable : ${error?.message ?? contenuId}`);
  const langue = parent.langue_source ?? "fr";

  const [{ data: cl }, { data: vuesMax }] = await Promise.all([
    supabase.from("contenu_langues").select("slides").eq("contenu_id", contenuId).eq("langue", langue).maybeSingle(),
    supabase.from("passages").select("vues").eq("contenu_id", contenuId).not("vues", "is", null)
      .order("vues", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const deck = ((cl?.slides ?? []) as SlideDeck[]).slice().sort((a, b) => a.position - b.position);
  if (deck.length === 0) throw new Error("deck source vide");

  const structure = (parent.structure_slides ?? []) as Array<{ position: number; media_id?: string | null }>;
  const idsParent = structure.map((s) => s.media_id).filter((x): x is string => !!x);
  const { data: imgsParent } = idsParent.length
    ? await supabase.from("media_library").select("id, caption, url").in("id", idsParent)
    : { data: [] };
  const capParent = new Map((imgsParent ?? []).map((i) => [i.id as string, i]));
  const imagesParent = new Map<number, string>();
  for (const s of structure) {
    const c = s.media_id ? capParent.get(s.media_id) : null;
    if (c?.caption) imagesParent.set(s.position, c.caption as string);
  }

  const { data: poolBrut, error: ep } = await supabase
    .from("media_library")
    .select("id, url, caption, est_hook, contenu_id")
    .eq("compte_reference_id", parent.compte_reference_id)
    .like("storage_path", "propre/%")
    .eq("texte_restant", false)
    .not("caption", "is", null)
    .limit(1000);
  if (ep) throw ep;
  const pool = ((poolBrut ?? []) as Image[]).filter((i) => i.contenu_id !== contenuId && !idsParent.includes(i.id));
  const parId = new Map(pool.map((i) => [i.id, i]));
  if (pool.length < deck.length) throw new Error(`pool trop maigre : ${pool.length} images`);

  const [{ data: liste }, sm] = await Promise.all([
    supabase.from("concurrents").select("nom, motif").eq("actif", true),
    supabase.from("concurrents_sans_marque").select("nom"),
  ]);
  const concurrents: Concurrent[] = liste
    ? versMicaboDepuis(liste as Concurrent[], sm.error ? null : (sm.data as Array<{ nom: string }>))
    : CONCURRENTS_DEFAUT;

  const debut = Date.now();
  const sortie = await callWithFallback(MODELES_VARIANTES, [{
    text: consigne({
      langue,
      vues: Number(vuesMax?.vues ?? 0),
      titre: parent.titre ?? "",
      deck,
      imagesParent,
      pool,
      n,
    }),
  }]);
  const variantes = lireVariantes(textOf(sortie));
  const dureeVariantes = Date.now() - debut;

  // Le placement, comme à l'assignation : prompt courant, corrections, marque.
  const { data: corrections } = await supabase
    .from("corrections")
    .select("texte_origine, texte_corrige")
    .order("created_at", { ascending: false })
    .limit(40);
  const masterPrompt = (await chargerPrompt(supabase, "placement_micabo")) ?? "";

  const resultats = await Promise.all(variantes.map(async (v) => {
    const slides = v.slides
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ ...s, texte: nettoyerTexteDeck(s.texte, langue) }));
    const p = await integrateSophia({
      masterPrompt,
      corrections: (corrections ?? []).map((c) => ({ original_text: c.texte_origine, corrected_text: c.texte_corrige })),
      slides: slides.map((s) => ({ position: s.position, text: s.texte })),
      caption: v.titre,
      langue,
      marque: "micabo",
    }).catch(() => null);
    return {
      angle: v.angle,
      titre: v.titre,
      defauts: defauts({ ...v, slides }, deck.length, parId, concurrents),
      placement: p
        ? { position: p.chosenPosition, texte: nettoyerTexteDeck(p.variants[p.bestIndex] ?? "", langue), remplace: slides.find((s) => s.position === p.chosenPosition)?.texte ?? null }
        : null,
      slides: slides.map((s) => {
        const img = parId.get(s.media_id);
        return { ...s, url: img?.url ?? null, caption: img?.caption ?? null, image_de: img?.contenu_id ?? null };
      }),
    };
  }));

  return {
    parent: {
      id: contenuId,
      titre: parent.titre,
      vues: vuesMax?.vues ?? null,
      langue,
      slides: deck.map((s) => {
        const mid = structure.find((x) => x.position === s.position)?.media_id;
        const img = mid ? capParent.get(mid) : null;
        return { position: s.position, texte: s.texte_overlay, micabo: !!s.position_sophia, url: img?.url ?? null, caption: img?.caption ?? null };
      }),
    },
    pool: pool.length,
    modele: MODELES_VARIANTES[0],
    duree_variantes_ms: dureeVariantes,
    variantes: resultats,
  };
}

Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;
  try {
    const corps = await request.json().catch(() => ({}));
    const contenuId = String(corps?.contenuId ?? "").trim();
    const n = Math.min(4, Math.max(1, Math.floor(Number(corps?.n ?? 3)) || 3));
    if (!contenuId) return json({ ok: false, error: "contenuId manquant" }, 400);

    const supabase = serviceClient();
    const { data: ligne, error } = await supabase
      .from("essai_variations")
      .insert({ parent_id: contenuId, n })
      .select("id")
      .single();
    if (error) throw error;

    const travail = essayer(contenuId, n)
      .then((resultat) => supabase.from("essai_variations").update({ resultat, fini_le: new Date().toISOString() }).eq("id", ligne.id))
      .catch((e) => supabase.from("essai_variations").update({ erreur: messageErreur(e).slice(0, 2000), fini_le: new Date().toISOString() }).eq("id", ligne.id));
    const edge = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edge) edge.waitUntil(travail);
    else await travail;
    return json({ ok: true, essai: ligne.id }, 202);
  } catch (e) {
    return json({ ok: false, error: messageErreur(e) }, 500);
  }
});
