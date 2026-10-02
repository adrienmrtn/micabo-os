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
 * Quand le parent porte sa slide micabo comme un élément de la liste (835c1781 :
 * « je révise mes fiches micabo dans les toilettes »), la variante écrit la
 * sienne au même endroit, dans la même forme : c'est le moule qui a marché.
 * Sinon le placement est simulé comme à l'assignation (`placement_micabo`,
 * corrections, règles de la marque). Dans les deux cas on juge un post entier.
 *
 * Le travail dépasse le délai d'un appel `pg_net` (120 s) : la fonction rend
 * la main tout de suite et range son résultat dans `essai_variations` (RLS,
 * aucune policy), la seule table qu'elle écrit.
 */

import { type Concurrent, CONCURRENTS_DEFAUT, concurrentsCites, versMicaboDepuis } from "../_shared/concurrents.ts";
import { callWithFallback, integrateSophia, MODELES_LECTURE_BURN, textOf, TEXT_MODELS } from "../_shared/gemini.ts";
import { decrireGabarit, ecartsGabarit, type Gabarit, gabarit, modeleMicabo } from "../_shared/gabarit.ts";
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
  gabarits: Map<number, Gabarit>;
  posMicabo: number | null;
  pool: Image[];
  n: number;
}): string {
  const posMicabo = input.posMicabo;
  const deck = input.deck
    .map((s) => {
      const img = input.imagesParent.get(s.position);
      const marque = s.position === posMicabo ? " (SLIDE micabo)" : "";
      const g = input.gabarits.get(s.position);
      return `Slide ${s.position}${marque}${img ? ` [image : ${img}]` : ""} : « ${s.texte_overlay ?? ""} »` +
        (g ? `\n→ gabarit à reproduire : ${decrireGabarit(g)}` : "");
    })
    .join("\n\n");
  const regleMicabo = posMicabo != null
    ? `LA SLIDE micabo — slide ${posMicabo}, comme dans le parent
- À la slide ${posMicabo}, et seulement là, écris la slide micabo dans la MÊME forme que celle du parent : un élément de la liste comme les autres (le même genre d'habitude que les autres slides, aussi bizarre, aussi concrète), où l'appli micabo est l'outil, pas le sujet. Sa FORME est celle des autres éléments de la liste, jamais une phrase d'un seul bloc : suis le gabarit donné pour la slide ${posMicabo}, même s'il ne ressemble pas au texte du parent à cette place.
- Écris toujours « l'appli micabo », en minuscules, une seule fois dans tout le slideshow.
- Ce que fait micabo, et RIEN d'autre : à partir de ses cours, de ses notes ou d'un PDF, l'appli crée les fiches ou les flashcards, et on se teste dessus quelques minutes par jour. N'invente aucune autre fonction (pas d'audio, pas de planning, pas de rappel, pas de professeur, pas d'IA qui « sait » ou « devine »), aucun chiffre sur l'appli, aucune matière ni note que le parent ne cite pas.
- Ailleurs que sur cette slide, aucune appli, aucun site, aucune marque.`
    : `Aucun nom d'application, de site ou de marque, et ne cite jamais micabo : la slide micabo est ajoutée après toi.`;
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
- La FORME de chaque slide est celle de la slide du parent à la même position, donnée par son « gabarit » : même nombre de paragraphes (séparés par une ligne vide, écrite \\n\\n), même nombre de lignes dans chaque paragraphe (une de plus ou de moins au plus), lignes pas plus longues que celles du parent. Reviens à la ligne comme le parent, au même rythme, et garde la même construction (par exemple : une phrase-titre, puis l'exemple concret, puis l'explication, puis la chute). Le code mesure ce gabarit et te renverra toute slide qui ne le tient pas.
- La couverture peut reprendre la promesse du parent presque mot pour mot, ou la décliner. Les deux sont permis, varie entre les ${input.n} slideshows.

CE QUI DOIT ÊTRE NEUF — le contenu
- Chaque élément de liste est une IDÉE DIFFÉRENTE de toutes celles du parent : pas une reformulation, pas la même astuce avec d'autres mots, pas un exemple voisin. Si le parent parle de chewing-gum, aucune variante ne parle de goût, de saveur ou d'odeur.
- Les ${input.n} slideshows ne se recopient pas entre eux non plus : aucune idée ne revient deux fois.
- Chaque élément tient la promesse de la couverture AUSSI FORT que le parent. Si la couverture promet des choses bizarres, extrêmes ou gênantes, chaque élément est un COMPORTEMENT qu'un témoin trouverait vraiment étrange (on le raconterait à ses amis), pas un conseil de révision classique qu'on lit partout (relire le lendemain, ranger son téléphone, faire des pauses, se fixer un objectif…).
- Tout ce qui est affirmé doit être vrai et vérifiable : un vrai effet de psychologie ou de mémoire, une vraie technique, un vrai nom. N'invente ni étude, ni chiffre, ni nom d'effet. En cas de doute, reste concret et n'avance pas de science.
- Aucun nom de personne.
- Pas de tiret long (—). Pas d'emoji si le parent n'en a pas.
- Rien qui ne parle pas à un élève ou un étudiant qui révise.

${regleMicabo}

LES IMAGES
Pour chaque slide, choisis UNE image dans la liste ci-dessous (identifiant exact), qui illustre CETTE slide : le décor, l'objet ou la situation dont parle la slide. Pour la couverture, prends de préférence une image marquée [couverture]. Jamais deux fois la même image dans un slideshow, et pas deux fois la même image entre les ${input.n} slideshows. Si aucune image ne colle vraiment, prends la plus neutre (bureau, cahier, élève qui travaille), jamais une image qui contredit la slide.

${pool}

LÉGENDE TikTok : une phrase dans le ton du parent puis 3 à 5 hashtags de révision, comme la légende du parent.

Réponds en JSON strict, rien d'autre. Dans les textes, jamais de guillemet droit : écris « » ou ’.
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
function defauts(
  v: Variante,
  nb: number,
  pool: Map<string, Image>,
  concurrents: Concurrent[],
  posMicabo: number | null,
  prisesAilleurs: Set<string>,
): string[] {
  const d: string[] = [];
  if (v.slides.length !== nb) d.push(`${v.slides.length} slides au lieu de ${nb}`);
  const vus = new Set<string>();
  const micabo = v.slides.filter((s) => citeMicabo(s.texte)).map((s) => s.position);
  if (posMicabo != null && (micabo.length !== 1 || micabo[0] !== posMicabo)) {
    d.push(`micabo attendu sur la slide ${posMicabo}, trouvé sur [${micabo.join(", ")}]`);
  }
  if (posMicabo == null && micabo.length > 0) d.push(`cite micabo (slides ${micabo.join(", ")})`);
  for (const s of v.slides) {
    if (!pool.has(s.media_id)) d.push(`slide ${s.position} : image hors du pool (${s.media_id})`);
    if (vus.has(s.media_id)) d.push(`slide ${s.position} : image déjà prise`);
    if (prisesAilleurs.has(s.media_id)) d.push(`slide ${s.position} : image prise par une autre variante`);
    vus.add(s.media_id);
    const c = concurrentsCites(s.texte, concurrents);
    if (c.length > 0) d.push(`slide ${s.position} : cite ${c.join(", ")}`);
    if (s.texte.includes("—")) d.push(`slide ${s.position} : tiret long`);
  }
  return d;
}

/**
 * Renvoie au modèle les slides qui ne tiennent pas leur gabarit, avec leurs
 * écarts mesurés, et ne remplace que celles qui reviennent conformes. Deux
 * tours au plus : au-delà, l'écart reste dans `defauts` et se voit.
 */
async function tenirGabarit(
  v: Variante,
  gabarits: Map<number, Gabarit>,
  langue: string,
): Promise<{ variante: Variante; tours: number }> {
  let courante = v;
  for (let tour = 1; tour <= 2; tour++) {
    const fautives = courante.slides
      .map((s) => ({ s, g: gabarits.get(s.position) }))
      .filter((x): x is { s: SlideVariante; g: Gabarit } => !!x.g)
      .map(({ s, g }) => ({ s, g, ecarts: ecartsGabarit(g, gabarit(s.texte)) }))
      .filter((x) => x.ecarts.length > 0);
    if (fautives.length === 0) return { variante: courante, tours: tour - 1 };
    const demande = `Langue : ${langue}. Voici un slideshow TikTok, slide par slide :
${courante.slides.map((s) => `Slide ${s.position} : « ${s.texte} »`).join("\n\n")}

Ces slides ne tiennent pas leur gabarit. Réécris-les en gardant EXACTEMENT la même idée, le même ton et les mêmes mots autant que possible : ne change que la mise en forme (retours à la ligne, paragraphes séparés par une ligne vide écrite \\n\\n) et, s'il le faut, la longueur.
${fautives.map((f) => `- Slide ${f.s.position} : gabarit à tenir = ${decrireGabarit(f.g)} · écarts mesurés : ${f.ecarts.join(" · ")}`).join("\n")}

Réponds en JSON strict, rien d'autre. Jamais de guillemet droit dans les textes : écris « » ou ’.
{"slides":[{"position":2,"texte":"…"}]}`;
    let corrigees: Array<{ position: number; texte: string }> = [];
    try {
      const brut = textOf(await callWithFallback(MODELES_VARIANTES, [{ text: demande }]));
      const m = brut.match(/\{[\s\S]*\}/);
      const lu = m ? (JSON.parse(m[0]) as { slides?: Array<{ position?: unknown; texte?: unknown }> }) : {};
      corrigees = (lu.slides ?? [])
        .map((x) => ({ position: Number(x.position), texte: String(x.texte ?? "") }))
        .filter((x) => Number.isFinite(x.position) && x.texte.trim());
    } catch {
      return { variante: courante, tours: tour };
    }
    const parPos = new Map(corrigees.map((c) => [c.position, c.texte]));
    courante = {
      ...courante,
      slides: courante.slides.map((s) => {
        const neuf = parPos.get(s.position);
        const g = gabarits.get(s.position);
        if (!neuf || !g) return s;
        // On ne garde la réécriture que si elle fait mieux que l'original.
        return ecartsGabarit(g, gabarit(neuf)).length < ecartsGabarit(g, gabarit(s.texte)).length
          ? { ...s, texte: neuf }
          : s;
      }),
    };
  }
  return { variante: courante, tours: 2 };
}

/**
 * Le modèle de placement de chaque position : la slide du TikTok d'origine,
 * texte compris, là où le créateur voit où poser le sien. Quand l'éditeur de la
 * file a remplacé une image, `raw_url` et `reference_url` pointent sur un propre
 * sans texte, qui ne montre rien : on reprend alors l'original à la même
 * position (`brut/<tiktok>/<position>`), mais seulement si le TikTok avait
 * autant de slides que le slideshow — une slide retirée ou déplacée ferait
 * pointer le modèle sur la mauvaise.
 */
async function modelesDePlacement(
  supabase: ReturnType<typeof serviceClient>,
  structure: Array<{ position: number; raw_url?: string | null; reference_url?: string | null }>,
): Promise<Map<number, string | null>> {
  const BRUT = /\/medias\/brut\/([^/]+)\/(\d+)\.[a-z]+/i;
  const ids = structure.map((s) => (s.reference_url ?? s.raw_url ?? "").match(BRUT)?.[1]).filter((x): x is string => !!x);
  const tiktok = ids[0] ?? null;
  let originaux: string[] = [];
  if (tiktok) {
    const { data } = await supabase.storage.from("medias").list(`brut/${tiktok}`, { limit: 100 });
    originaux = (data ?? []).map((f) => f.name);
  }
  const memeNombre = originaux.length === structure.length;
  const out = new Map<number, string | null>();
  for (const s of structure) {
    const propre = s.reference_url ?? s.raw_url ?? null;
    if (propre && BRUT.test(propre)) {
      out.set(Number(s.position), propre);
      continue;
    }
    const nom = originaux.find((n) => n.startsWith(`${s.position}.`));
    out.set(
      Number(s.position),
      tiktok && memeNombre && nom
        ? supabase.storage.from("medias").getPublicUrl(`brut/${tiktok}/${nom}`).data.publicUrl
        : null,
    );
  }
  return out;
}

async function essayer(contenuId: string, n: number): Promise<Record<string, unknown>> {
  const supabase = serviceClient();
  const { data: parent, error } = await supabase
    .from("contenus")
    .select("id, titre, langue_source, compte_reference_id, structure_slides, source_url")
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

  const structure = (parent.structure_slides ?? []) as Array<{
    position: number;
    media_id?: string | null;
    raw_url?: string | null;
    reference_url?: string | null;
  }>;
  const modeles = await modelesDePlacement(supabase, structure);
  const posMicabo = deck.find((s) => s.position_sophia || citeMicabo(s.texte_overlay))?.position ?? null;
  const gabarits = new Map<number, Gabarit>(deck.map((s) => [s.position, gabarit(s.texte_overlay)]));
  if (posMicabo != null) {
    gabarits.set(
      posMicabo,
      modeleMicabo(
        deck.map((s) => ({ position: s.position, texte: s.texte_overlay ?? "", placement: !!s.position_sophia })),
        posMicabo,
      ),
    );
  }
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
  // Florence décrit le BRUT : une légende qui parle de texte, de mots ou
  // d'écriture signale une image où il reste peut-être de quoi lire, dans une
  // seule langue. Une appli, un écran ou un logo nommés peuvent montrer un
  // concurrent (« Hyperfocus app open on the screen » est sorti sur une slide
  // micabo au troisième essai). On ne les propose pas.
  const AVEC_TEXTE =
    /\b(text|texte|written|writing|words?|phrase|says|letters?|caption|title|app|application|logo|brand|screen|écran|french|français|english|anglais)\b/i;
  const candidates = ((poolBrut ?? []) as Image[]).filter((i) =>
    i.contenu_id !== contenuId && !idsParent.includes(i.id) && !AVEC_TEXTE.test(i.caption ?? "")
  );
  // `texte_restant = false` ne prouve rien (0295) : seule une image que l'audit
  // a relue et trouvée sans texte entre, et pas celle d'un slideshow encore en
  // file, qu'Adrien n'a pas vu.
  const ids = candidates.map((i) => i.id);
  const sources = [...new Set(candidates.map((i) => i.contenu_id).filter((x): x is string => !!x))];
  const [{ data: audit, error: ea }, { data: statuts, error: es }] = await Promise.all([
    supabase.from("audit_propres_0295").select("media_id, reste").in("media_id", ids),
    supabase.from("contenus").select("id, statut").in("id", sources),
  ]);
  if (ea) throw ea;
  if (es) throw es;
  const propres = new Set((audit ?? []).filter((a) => a.reste === "aucun").map((a) => a.media_id as string));
  const enFile = new Set((statuts ?? []).filter((c) => c.statut === "brouillon").map((c) => c.id as string));
  const pool = candidates.filter((i) => propres.has(i.id) && !(i.contenu_id && enFile.has(i.contenu_id)));
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
  const texteConsigne = consigne({
    langue,
    vues: Number(vuesMax?.vues ?? 0),
    titre: parent.titre ?? "",
    deck,
    imagesParent,
    gabarits,
    posMicabo,
    pool,
    n,
  });
  // Un guillemet droit oublié dans une slide casse tout le JSON : un second
  // essai, pas plus — c'est un appel long.
  let variantes: Variante[] = [];
  for (let essai = 0; ; essai++) {
    try {
      variantes = lireVariantes(textOf(await callWithFallback(MODELES_VARIANTES, [{ text: texteConsigne }])));
      break;
    } catch (e) {
      if (essai >= 1) throw e;
    }
  }
  // Le gabarit se mesure, il ne se croit pas : une slide qui ne le tient pas
  // repart au modèle avec ses écarts, deux fois au plus.
  const corrections_gabarit = await Promise.all(
    variantes.map((v) => tenirGabarit(v, gabarits, langue)),
  );
  variantes = corrections_gabarit.map((c) => c.variante);
  const dureeVariantes = Date.now() - debut;

  // Le placement, comme à l'assignation : prompt courant, corrections, marque.
  const { data: corrections } = await supabase
    .from("corrections")
    .select("texte_origine, texte_corrige")
    .order("created_at", { ascending: false })
    .limit(40);
  const masterPrompt = (await chargerPrompt(supabase, "placement_micabo")) ?? "";

  const resultats = await Promise.all(variantes.map(async (v, k) => {
    const slides = v.slides
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ ...s, texte: nettoyerTexteDeck(s.texte, langue) }));
    const prisesAilleurs = new Set(variantes.filter((_, j) => j !== k).flatMap((x) => x.slides.map((s) => s.media_id)));
    const base = {
      angle: v.angle,
      titre: v.titre,
      defauts: [
        ...defauts({ ...v, slides }, deck.length, parId, concurrents, posMicabo, prisesAilleurs),
        ...slides.flatMap((s) => {
          const g = gabarits.get(s.position);
          return g ? ecartsGabarit(g, gabarit(s.texte)).map((e) => `slide ${s.position} : ${e}`) : [];
        }),
      ],
      tours_gabarit: corrections_gabarit[k].tours,
      slides: slides.map((s) => {
        const img = parId.get(s.media_id);
        return {
          ...s,
          url: img?.url ?? null,
          caption: img?.caption ?? null,
          image_de: img?.contenu_id ?? null,
          // Le modèle de placement montré au créateur : la slide du TikTok
          // d'origine à la même position, puisque la variante en a la forme.
          modele_url: modeles.get(s.position) ?? null,
        };
      }),
    };
    // Comme `slideCitantMicabo` à l'assignation : une slide qui cite déjà
    // micabo EST le placement, le moteur n'en ajoute pas un second.
    const deja = slides.find((s) => citeMicabo(s.texte));
    if (deja) return { ...base, placement: { position: deja.position, texte: deja.texte, remplace: null, mode: "écrit par la variante" } };
    const p = await integrateSophia({
      masterPrompt,
      corrections: (corrections ?? []).map((c) => ({ original_text: c.texte_origine, corrected_text: c.texte_corrige })),
      slides: slides.map((s) => ({ position: s.position, text: s.texte })),
      caption: v.titre,
      langue,
      marque: "micabo",
    }).catch(() => null);
    return {
      ...base,
      placement: p
        ? { position: p.chosenPosition, texte: nettoyerTexteDeck(p.variants[p.bestIndex] ?? "", langue), remplace: slides.find((s) => s.position === p.chosenPosition)?.texte ?? null, mode: "placement_micabo" }
        : null,
    };
  }));

  return {
    parent: {
      id: contenuId,
      titre: parent.titre,
      source_url: parent.source_url ?? null,
      vues: vuesMax?.vues ?? null,
      langue,
      slides: deck.map((s) => {
        const mid = structure.find((x) => x.position === s.position)?.media_id;
        const img = mid ? capParent.get(mid) : null;
        return {
          position: s.position,
          texte: s.texte_overlay,
          micabo: !!s.position_sophia,
          url: img?.url ?? null,
          caption: img?.caption ?? null,
          modele_url: modeles.get(s.position) ?? null,
          gabarit: decrireGabarit(gabarits.get(s.position) ?? gabarit(s.texte_overlay)),
        };
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
