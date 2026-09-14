import {
  resoudreApplication,
  SLUG_MICABO,
  type ApplicationRow,
} from "../_shared/applications.ts";
import { retirerContentCredentialsBytes } from "../_shared/c2pa.ts";
import { estLabelSysteme, idsLabelsAssignables } from "../_shared/labels_systeme.ts";
import { appliquerIdentiteInstantanee } from "../_shared/persona.ts";
import { estRoleManager } from "../_shared/roles.ts";
import {
  assertRole,
  corsHeaders,
  json,
  messageErreur,
  serviceClient,
} from "../_shared/supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;
const DOMAINE = "micabo.app";
const BUCKET = "medias";

interface FileLabelItem {
  label_id: string;
  ugc: boolean;
}

/** Entrée consommée depuis une file admin — à restaurer au même endroit si échec. */
interface FileLabelQueued {
  item: FileLabelItem;
  /** `"general"` ou code langue (`fr`, `de`, …). */
  queueKey: string;
  applicationSlug?: string;
}

interface FileLabelsSlice {
  items: FileLabelItem[];
  par_langue: Record<string, FileLabelItem[]>;
}

interface FileLabelsValeur {
  items: FileLabelItem[];
  par_langue: Record<string, FileLabelItem[]>;
  par_application?: Record<string, FileLabelsSlice>;
}

interface PersonaUgcLibre {
  id: string;
  nom: string;
  image_face_url: string;
  image_profile_url: string | null;
}

/** Aligné sur `premierCompteDemande` (src/features/moteur/comptesPoster.ts). */
function resoudrePremierCompte(type: unknown, langue: string): "perso" | "aucun" {
  const t = String(type ?? "").trim().toLowerCase();
  if (t === "aucun" || t === "none") return "aucun";
  return langue ? "perso" : "aucun";
}

/**
 * Gestion des posters / recruteurs.
 *
 *   { action: "create", prenom, nom, password, langue?, type_compte?, … }
 *     type_compte: perso (défaut si langue) | aucun (login seul)
 *   { action: "ensure_compte", userId, langue, posts_par_jour? } — 1er compte (idempotent)
 *   { action: "ajouter_compte", userId, langue, … } — compte supplémentaire
 *   { action: "start_warmup", compteId }  — créateur (son compte) ou admin
 *   { action: "skip_warmup", compteId }   — admin : compte actif immédiat
 *   { action: "delete", userId }
 *
 * Création poster : premier compte, ou aucun (login seul).
 * File FIFO `file_labels_comptes` :
 *   { items: [...], par_langue: { fr: [...], de: [...] } }
 * Priorité : file de la langue du poster → file générale (`items`) → least-used.
 * UGC slideshow → persona libre, nom + avatar (profil 1:1 si dispo, sinon face)
 * sans métadonnées ; label forcé parmi ceux qui ont des slideshows ugc_compatible.
 */
Deno.serve(async (request) => {
  // Préflight CORS : doit répondre 2xx AVANT tout parse JSON, sinon le
  // navigateur bloque avec « Failed to send a request to the Edge Function ».
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    return await gererRequete(request);
  } catch (error) {
    return json({ error: messageErreur(error) }, 500);
  }
});

async function gererRequete(request: Request): Promise<Response> {
  const supabase = serviceClient();

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "corps JSON attendu" }, 400);
  }

  // Start warmup : le créateur lui-même (ou admin). Plus le HM.
  if (body.action === "start_warmup") {
    const acces = await assertRole(request, ["admin", "poster"]);
    if (acces instanceof Response) return acces;

    const compteId = String(body.compteId ?? "").trim();
    if (!compteId) return json({ error: "compteId requis" }, 400);

    const { data: compte, error } = await supabase
      .from("comptes")
      .select("id, poster_id, warmup_started_at, warmup_ends_at")
      .eq("id", compteId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!compte) return json({ error: "compte introuvable" }, 404);

    if (acces.role === "poster" && acces.userId !== "cron") {
      if (compte.poster_id !== acces.userId) {
        return json({ error: "forbidden" }, 403);
      }
    }

    if (compte.warmup_started_at && compte.warmup_ends_at) {
      return json({
        ok: true,
        deja: true,
        warmup_started_at: compte.warmup_started_at,
        warmup_ends_at: compte.warmup_ends_at,
      });
    }

    const heures = await lireWarmupHeures(supabase);
    const start = new Date();
    const end = new Date(start.getTime() + heures * 3600_000);
    const { error: updErr } = await supabase
      .from("comptes")
      .update({
        warmup_started_at: start.toISOString(),
        warmup_ends_at: end.toISOString(),
      })
      .eq("id", compteId);
    if (updErr) return json({ error: updErr.message }, 400);

    return json({
      ok: true,
      warmup_started_at: start.toISOString(),
      warmup_ends_at: end.toISOString(),
      heures,
    });
  }

  // Admin : coupe le timer warmup → compte immédiatement actif (en process).
  if (body.action === "skip_warmup") {
    const acces = await assertRole(request, ["admin"]);
    if (acces instanceof Response) return acces;

    const compteId = String(body.compteId ?? "").trim();
    if (!compteId) return json({ error: "compteId requis" }, 400);

    const { data: compte, error } = await supabase
      .from("comptes")
      .select("id, warmup_started_at, warmup_ends_at")
      .eq("id", compteId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!compte) return json({ error: "compte introuvable" }, 404);

    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("comptes")
      .update({
        warmup_started_at: compte.warmup_started_at ?? now,
        warmup_ends_at: now,
      })
      .eq("id", compteId);
    if (updErr) return json({ error: updErr.message }, 400);

    return json({
      ok: true,
      warmup_started_at: compte.warmup_started_at ?? now,
      warmup_ends_at: now,
    });
  }

  const acces = await assertRole(request, [
    "admin",
    "hiring_manager",
    "directing_manager",
  ]);
  if (acces instanceof Response) return acces;

  if (body.action === "create") {
    const prenom = String(body.prenom ?? "").trim();
    const nom = String(body.nom ?? "").trim();
    const password = String(body.password ?? "");
    const langue = String(body.langue ?? "").trim().toLowerCase();
    const typePremier = resoudrePremierCompte(body.type_compte, langue);
    const languesRecues = Array.isArray(body.langues)
      ? (body.langues as unknown[])
        .map((l) => String(l ?? "").trim().toLowerCase())
        .filter(Boolean)
      : [];
    const peutCreerHm =
      acces.role === "admin" || acces.role === "directing_manager";
    const roleVoulu =
      body.role === "hiring_manager" && peutCreerHm ? "hiring_manager" : "poster";
    const creerPerso = roleVoulu === "poster" && typePremier === "perso";

    if (!prenom || password.length < 8) {
      return json({ error: "Prénom requis et mot de passe d'au moins 8 caractères" }, 400);
    }

    if (roleVoulu === "poster" && estRoleManager(acces.role) && acces.userId !== "cron") {
      const { data: hm } = await supabase
        .from("profiles")
        .select("langues")
        .eq("id", acces.userId)
        .maybeSingle();
      const gerees = ((hm?.langues as string[] | null) ?? [])
        .map((l) => l.toLowerCase())
        .filter(Boolean);
      if (gerees.length > 0 && langue && !gerees.includes(langue)) {
        return json(
          { error: `Langue « ${langue} » hors des langues gérées (${gerees.join(", ")})` },
          400,
        );
      }
    }

    const application = await resoudreApplication(supabase, body);

    // File admin uniquement pour un premier compte (pas pour un login seul).
    let fileItem: FileLabelItem | null = null;
    let fileItemQueue: FileLabelQueued | null = null;
    let personaUgc: PersonaUgcLibre | null = null;
    if (creerPerso) {
      const prep = await preparerFileEtPersona(supabase, langue, application);
      if (!prep.ok) return json({ error: prep.error }, 409);
      fileItem = prep.fileItem;
      fileItemQueue = prep.fileItemQueue;
      personaUgc = prep.personaUgc;
    }

    // Référence source : best-effort (plus bloquant).
    let referenceId: string | null = null;
    if (creerPerso) {
      referenceId = await referenceLibre(supabase, langue, application.id);
    }

    const email = await emailDisponible(supabase, prenom, nom);

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { prenom },
    });

    if (error) {
      if (fileItemQueue) await unshiftLabelFile(supabase, fileItemQueue);
      const detail = [error.message, error.code, error.status].filter(Boolean).join(" · ");
      return json({ error: detail || `Création refusée pour ${email}` }, 400);
    }

    if (data.user) {
      await supabase
        .from("profiles")
        .update({ prenom, nom: nom || null, is_active: true, must_change_password: false })
        .eq("id", data.user.id);

      if (roleVoulu === "hiring_manager") {
        await supabase.from("user_roles").delete().eq("user_id", data.user.id);
        await supabase.from("user_roles").insert({ user_id: data.user.id, role: "hiring_manager" });
        const ensemble = [
          ...new Set(languesRecues.length > 0 ? languesRecues : (langue ? [langue] : [])),
        ];
        const patchHm: Record<string, unknown> = {};
        if (ensemble.length > 0) {
          patchHm.nationalite = ensemble[0];
          patchHm.langues = ensemble;
        }
        if (acces.role === "directing_manager" && acces.userId !== "cron") {
          patchHm.manager_id = acces.userId;
        }
        if (Object.keys(patchHm).length > 0) {
          await supabase.from("profiles").update(patchHm).eq("id", data.user.id);
        }
      } else if (estRoleManager(acces.role) && acces.userId !== "cron") {
        await supabase
          .from("profiles")
          .update({ manager_id: acces.userId })
          .eq("id", data.user.id);
      }
    }

    let compte: {
      id: string;
      reference: string | null;
      persona: boolean;
      labelId: string | null;
      ugc: boolean;
    } | null = null;
    if (data.user && creerPerso) {
      const postsParJour = normaliserPostsParJour(body.posts_par_jour);
      compte = {
        ...(await preparerCompte(
          supabase,
          data.user.id,
          langue,
          referenceId,
          fileItem,
          postsParJour,
          personaUgc,
          fileItemQueue,
          { application },
        )),
      };
      if (compte.id) await ajouterLangueProfil(supabase, data.user.id, langue);
      const handlePerso = String(body.handle_tiktok ?? "").trim().replace(/^@+/, "");
      if (compte.id && handlePerso) {
        await supabase.from("comptes").update({ handle_tiktok: handlePerso }).eq("id", compte.id);
      }
    } else if (fileItemQueue) {
      await unshiftLabelFile(supabase, fileItemQueue);
    }

    return json({
      ok: true,
      userId: data.user?.id,
      email,
      compte,
      role: roleVoulu,
    });
  }

  // Poster existant sans compte : consomme la file admin (label + UGC) comme à la création.
  if (body.action === "ensure_compte") {
    const userId = String(body.userId ?? "").trim();
    const langue = String(body.langue ?? "").trim().toLowerCase();
    if (!userId || !langue) {
      return json({ error: "userId et langue requis" }, 400);
    }
    if (estRoleManager(acces.role) && acces.userId !== "cron") {
      const { data: cible } = await supabase
        .from("profiles")
        .select("manager_id")
        .eq("id", userId)
        .maybeSingle();
      if (!cible || cible.manager_id !== acces.userId) {
        return json({ error: "forbidden" }, 403);
      }
    }

    const { data: deja } = await supabase
      .from("comptes")
      .select("id")
      .eq("poster_id", userId)
      .limit(1)
      .maybeSingle();
    if (deja?.id) {
      return json({ ok: true, deja: true, compteId: deja.id });
    }

    const application = await resoudreApplication(supabase, body);
    return await creerComptePersoPourPoster(
      supabase,
      acces,
      userId,
      langue,
      body.posts_par_jour,
      "",
      application,
    );
  }

  if (body.action === "ajouter_compte" || body.action === "ajouter_compte_perso") {
    const userId = String(body.userId ?? "").trim();
    const langue = String(body.langue ?? "").trim().toLowerCase();
    if (!userId || !langue) return json({ error: "userId et langue requis" }, 400);

    const interdit = await refuserSiHorsEquipe(supabase, acces, userId);
    if (interdit) return interdit;
    const langueInterdite = await restreindreLangueGeree(supabase, acces, langue);
    if (langueInterdite) return langueInterdite;

    const application = await resoudreApplication(supabase, body);
    return await creerComptePersoPourPoster(
      supabase,
      acces,
      userId,
      langue,
      body.posts_par_jour,
      String(body.handle_tiktok ?? "").trim().replace(/^@+/, ""),
      application,
    );
  }

  if (body.action === "delete") {
    if (!body.userId) return json({ error: "userId requis" }, 400);
    if (acces.role !== "admin") {
      const { data: cible } = await supabase
        .from("profiles")
        .select("manager_id")
        .eq("id", body.userId)
        .single();
      if (!cible || cible.manager_id !== acces.userId) return json({ error: "forbidden" }, 403);
    }
    await supabase
      .from("profiles")
      .update({ manager_id: null })
      .eq("manager_id", body.userId);

    const { error } = await supabase.rpc("supprimer_auth_user", { uid: body.userId });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "action inconnue" }, 400);
}


async function restreindreLangueGeree(
  supabase: Supabase,
  acces: { userId: string; role: string },
  langue: string,
): Promise<Response | null> {
  if (!estRoleManager(acces.role) || acces.userId === "cron") return null;
  const { data: hm } = await supabase
    .from("profiles")
    .select("langues")
    .eq("id", acces.userId)
    .maybeSingle();
  const gerees = ((hm?.langues as string[] | null) ?? [])
    .map((l) => l.toLowerCase())
    .filter(Boolean);
  if (gerees.length > 0 && !gerees.includes(langue)) {
    return json(
      { error: `Langue « ${langue} » hors des langues gérées (${gerees.join(", ")})` },
      400,
    );
  }
  return null;
}

async function ajouterLangueProfil(
  supabase: Supabase,
  userId: string,
  langue: string,
): Promise<void> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("langues")
    .eq("id", userId)
    .maybeSingle();
  const actuelles = ((prof?.langues as string[] | null) ?? []).map((l) => l.toLowerCase());
  if (actuelles.includes(langue)) return;
  await supabase
    .from("profiles")
    .update({ langues: [...actuelles, langue] })
    .eq("id", userId);
}


async function creerComptePersoPourPoster(
  supabase: Supabase,
  acces: { userId: string; role: string },
  userId: string,
  langue: string,
  postsParJourBrut: unknown,
  handleTiktok = "",
  application?: ApplicationRow | null,
): Promise<Response> {
  const prep = await preparerFileEtPersona(supabase, langue, application);
  if (!prep.ok) return json({ error: prep.error }, 409);
  const fileItem: FileLabelItem | null = prep.fileItem;
  const fileItemQueue: FileLabelQueued | null = prep.fileItemQueue;
  const personaUgc: PersonaUgcLibre | null = prep.personaUgc;

  const referenceId = await referenceLibre(supabase, langue, application?.id ?? null);
  const postsParJour = normaliserPostsParJour(postsParJourBrut);
  const compte = await preparerCompte(
    supabase,
    userId,
    langue,
    referenceId,
    fileItem,
    postsParJour,
    personaUgc,
    fileItemQueue,
    { application },
  );
  if (!compte.id) return json({ error: "CREATION_COMPTE_ECHOUEE" }, 500);
  if (handleTiktok) {
    await supabase.from("comptes").update({ handle_tiktok: handleTiktok }).eq("id", compte.id);
  }
  await ajouterLangueProfil(supabase, userId, langue);
  return json({ ok: true, compte });
}


/** Admin : tout. HM : ses créateurs. DM : créateurs des HM de son équipe. */
async function refuserSiHorsEquipe(
  supabase: Supabase,
  acces: { userId: string; role: string },
  posterId: string,
): Promise<Response | null> {
  if (acces.role === "admin" || acces.userId === "cron") return null;

  const { data: cible } = await supabase
    .from("profiles")
    .select("manager_id")
    .eq("id", posterId)
    .maybeSingle();
  if (!cible) return json({ error: "forbidden" }, 403);

  if (cible.manager_id === acces.userId) return null;

  if (acces.role === "directing_manager" && cible.manager_id) {
    const { data: hm } = await supabase
      .from("profiles")
      .select("manager_id")
      .eq("id", cible.manager_id)
      .maybeSingle();
    if (hm?.manager_id === acces.userId) return null;
  }

  return json({ error: "forbidden" }, 403);
}

function normaliser(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function emailDisponible(
  supabase: ReturnType<typeof serviceClient>,
  prenom: string,
  nom: string,
): Promise<string> {
  const base = normaliser(prenom) + normaliser(nom).slice(0, 1);

  for (let suffixe = 0; suffixe < 50; suffixe += 1) {
    const email = `${base}${suffixe || ""}@${DOMAINE}`;
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!data) return email;
  }

  return `${base}${Date.now()}@${DOMAINE}`;
}

async function lireWarmupHeures(supabase: Supabase): Promise<number> {
  const { data } = await supabase
    .from("reglages")
    .select("valeur")
    .eq("cle", "warmup")
    .maybeSingle();
  const h = Number((data?.valeur as { heures?: number } | null)?.heures ?? 24);
  return Number.isFinite(h) && h > 0 ? Math.min(168, h) : 24;
}

function normaliserFileLabelItemList(raw: unknown): FileLabelItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      const o = (it ?? {}) as { label_id?: string; ugc?: boolean };
      return {
        label_id: String(o.label_id ?? "").trim(),
        ugc: Boolean(o.ugc),
      };
    })
    .filter((it) => it.label_id);
}

async function idsLabelsNonAssignables(supabase: Supabase): Promise<Set<string>> {
  const { data } = await supabase
    .from("labels")
    .select("id, slug")
    .in("slug", ["hook", "ugc-ai-video"]);
  return new Set(
    (data ?? [])
      .filter((l) => estLabelSysteme(l))
      .map((l) => l.id as string)
      .filter(Boolean),
  );
}

function retirerLabelsNonAssignablesItems(
  items: FileLabelItem[],
  interdits: Set<string>,
): FileLabelItem[] {
  return items.filter((it) => !interdits.has(it.label_id));
}

function retirerLabelsNonAssignablesSlice(
  slice: FileLabelsSlice,
  interdits: Set<string>,
): FileLabelsSlice {
  const par_langue: Record<string, FileLabelItem[]> = {};
  for (const [code, liste] of Object.entries(slice.par_langue)) {
    const propre = retirerLabelsNonAssignablesItems(liste, interdits);
    if (propre.length > 0) par_langue[code] = propre;
  }
  return {
    items: retirerLabelsNonAssignablesItems(slice.items, interdits),
    par_langue,
  };
}

function fileFifoAChange(avant: FileLabelsSlice, apres: FileLabelsSlice): boolean {
  if (avant.items.length !== apres.items.length) return true;
  const langues = new Set([
    ...Object.keys(avant.par_langue),
    ...Object.keys(apres.par_langue),
  ]);
  for (const code of langues) {
    if ((avant.par_langue[code]?.length ?? 0) !== (apres.par_langue[code]?.length ?? 0)) {
      return true;
    }
  }
  return false;
}

async function filtrerIdsAssignables(
  supabase: Supabase,
  labelIds: string[],
): Promise<string[]> {
  const uniques = [...new Set(labelIds.filter(Boolean))];
  if (uniques.length === 0) return [];
  const { data } = await supabase.from("labels").select("id, slug").in("id", uniques);
  return idsLabelsAssignables(data ?? []);
}

/** Normalise `{ items, par_langue }` (+ legacy `label_ids`). */
function normaliserFileLabelsValeur(valeur: unknown): FileLabelsValeur {
  const v = (valeur ?? {}) as {
    items?: Array<{ label_id?: string; ugc?: boolean }>;
    label_ids?: string[];
    par_langue?: Record<string, unknown>;
  };

  let items = normaliserFileLabelItemList(v.items);
  if (items.length === 0) {
    items = (v.label_ids ?? [])
      .map((id) => String(id ?? "").trim())
      .filter(Boolean)
      .map((label_id) => ({ label_id, ugc: false }));
  }

  const par_langue: Record<string, FileLabelItem[]> = {};
  if (v.par_langue && typeof v.par_langue === "object" && !Array.isArray(v.par_langue)) {
    for (const [code, arr] of Object.entries(v.par_langue)) {
      const lang = String(code ?? "").trim().toLowerCase();
      if (!lang) continue;
      const liste = normaliserFileLabelItemList(arr);
      if (liste.length > 0) par_langue[lang] = liste;
    }
  }

  return { items, par_langue };
}

function sliceFileLabels(file: FileLabelsValeur, slug: string): FileLabelsSlice {
  const inner = file.par_application?.[slug];
  if (inner) return { items: inner.items ?? [], par_langue: inner.par_langue ?? {} };
  if (slug === "micabo") return { items: file.items, par_langue: file.par_langue };
  return { items: [], par_langue: {} };
}

function avecSliceApplication(
  file: FileLabelsValeur,
  slug: string,
  slice: FileLabelsSlice,
): FileLabelsValeur {
  const par_application = { ...(file.par_application ?? {}) };
  par_application[slug] = slice;
  if (slug === "micabo") {
    return { items: slice.items, par_langue: slice.par_langue, par_application };
  }
  return { items: file.items, par_langue: file.par_langue, par_application };
}

async function ecrireFileLabels(
  supabase: Supabase,
  file: FileLabelsValeur,
): Promise<void> {
  const par_langue: Record<string, FileLabelItem[]> = {};
  for (const [code, liste] of Object.entries(file.par_langue)) {
    if (liste.length > 0) par_langue[code] = liste;
  }
  const par_application: Record<string, FileLabelsSlice> = {};
  for (const [slug, slice] of Object.entries(file.par_application ?? {})) {
    par_application[slug] = {
      items: slice.items ?? [],
      par_langue: slice.par_langue ?? {},
    };
  }
  await supabase.from("reglages").upsert(
    {
      cle: "file_labels_comptes",
      valeur: { items: file.items, par_langue, par_application },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cle" },
  );
}

/**
 * Tire la première entrée (FIFO) :
 *   1) file de la langue (surpasse la générale)
 *   2) sinon file générale
 *   3) sinon label classique le moins utilisé (ne consomme pas les files)
 */
async function popLabelFile(
  supabase: Supabase,
  langue: string,
  application?: ApplicationRow | null,
): Promise<
  | { ok: true; item: FileLabelItem; fromQueue: false }
  | { ok: true; item: FileLabelItem; fromQueue: true; queueKey: string }
  | { ok: false; error: string }
> {
  const { data } = await supabase
    .from("reglages")
    .select("valeur")
    .eq("cle", "file_labels_comptes")
    .maybeSingle();
  const file = normaliserFileLabelsValeur(data?.valeur);
  const slug = application?.slug ?? "micabo";
  const interdits = await idsLabelsNonAssignables(supabase);
  const sliceBrut = sliceFileLabels(file, slug);
  const slice = retirerLabelsNonAssignablesSlice(sliceBrut, interdits);
  if (fileFifoAChange(sliceBrut, slice)) {
    await ecrireFileLabels(
      supabase,
      avecSliceApplication(file, slug, slice),
    );
  }
  const lang = String(langue ?? "").trim().toLowerCase();

  const fileLangue = lang ? (slice.par_langue[lang] ?? []) : [];
  if (fileLangue.length > 0) {
    const [first, ...rest] = fileLangue;
    if (!first) return { ok: false, error: "NO_LABELS" };
    await ecrireFileLabels(
      supabase,
      avecSliceApplication(file, slug, {
        items: slice.items,
        par_langue: { ...slice.par_langue, [lang]: rest },
      }),
    );
    return { ok: true, item: first, fromQueue: true, queueKey: lang };
  }

  if (slice.items.length > 0) {
    const [first, ...rest] = slice.items;
    if (!first) return { ok: false, error: "NO_LABELS" };
    await ecrireFileLabels(
      supabase,
      avecSliceApplication(file, slug, { items: rest, par_langue: slice.par_langue }),
    );
    return { ok: true, item: first, fromQueue: true, queueKey: "general" };
  }

  const labelId = await labelMoinsUtiliseParLangue(supabase, langue, {
    ugcOnly: false,
    applicationId: application?.id ?? null,
  });
  if (!labelId) return { ok: false, error: "NO_LABELS" };
  return { ok: true, item: { label_id: labelId, ugc: false }, fromQueue: false };
}





/**
 * Consomme la file admin (langue > générale) + persona UGC si besoin.
 * `fileItemQueue` = entrée exacte à remettre dans LA MÊME file en cas d'échec.
 */
async function preparerFileEtPersona(
  supabase: Supabase,
  langue: string,
  application?: ApplicationRow | null,
): Promise<
  | {
    ok: true;
    fileItem: FileLabelItem;
    fileItemQueue: FileLabelQueued | null;
    personaUgc: PersonaUgcLibre | null;
  }
  | { ok: false; error: string }
> {
  const popped = await popLabelFile(supabase, langue, application);
  if (!popped.ok) return { ok: false, error: popped.error };

  let fileItem = popped.item;
  const fileItemQueue: FileLabelQueued | null = popped.fromQueue
    ? {
      item: { ...popped.item },
      queueKey: popped.queueKey,
      applicationSlug: application?.slug,
    }
    : null;
  let personaUgc: PersonaUgcLibre | null = null;

  if (fileItem.ugc) {
    const labelOk = await labelADesContenusUgc(supabase, fileItem.label_id);
    if (!labelOk) {
      const fallback = await labelMoinsUtiliseParLangue(supabase, langue, {
        ugcOnly: true,
        applicationId: application?.id ?? null,
      });
      if (!fallback) {
        if (fileItemQueue) await unshiftLabelFile(supabase, fileItemQueue);
        return { ok: false, error: "NO_UGC_LABEL" };
      }
      fileItem = { label_id: fallback, ugc: true };
    }
    personaUgc = await personaUgcLibre(supabase, application?.id ?? null);
    if (!personaUgc) {
      if (fileItemQueue) await unshiftLabelFile(supabase, fileItemQueue);
      return { ok: false, error: "NO_UGC_PERSONA" };
    }
  }

  return { ok: true, fileItem, fileItemQueue, personaUgc };
}

/** Label avec le moins de comptes actifs dans la langue (ou global si langue vide). */
async function labelMoinsUtiliseParLangue(
  supabase: Supabase,
  langue: string,
  opts: { ugcOnly: boolean; applicationId?: string | null },
): Promise<string | null> {
  let pool: string[] = [];
  if (opts.ugcOnly) {
    pool = await labelIdsAvecContenusUgc(supabase, opts.applicationId);
  } else {
    let q = supabase.from("labels").select("id, slug");
    if (opts.applicationId) q = q.eq("application_id", opts.applicationId);
    const { data: tous } = await q;
    pool = idsLabelsAssignables(tous ?? []);
  }
  if (pool.length === 0) return null;

  const counts = new Map<string, number>(pool.map((id) => [id, 0]));
  let q = supabase
    .from("compte_labels")
    .select("label_id, comptes!inner(langue, is_active)")
    .eq("comptes.is_active", true)
    .in("label_id", pool);
  if (langue) q = q.eq("comptes.langue", langue);
  const { data: usages } = await q;
  for (const u of usages ?? []) {
    const id = u.label_id as string;
    if (!counts.has(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  let min = Infinity;
  const candidats: string[] = [];
  for (const [id, n] of counts) {
    if (n < min) {
      min = n;
      candidats.length = 0;
      candidats.push(id);
    } else if (n === min) {
      candidats.push(id);
    }
  }
  if (candidats.length === 0) return null;
  return candidats[Math.floor(Math.random() * candidats.length)] ?? null;
}

async function labelIdsAvecContenusUgc(
  supabase: Supabase,
  applicationId?: string | null,
): Promise<string[]> {
  let q = supabase
    .from("contenu_labels")
    .select("label_id, contenus!inner(ugc_compatible, application_id)")
    .eq("contenus.ugc_compatible", true);
  if (applicationId) q = q.eq("contenus.application_id", applicationId);
  const { data } = await q;
  const ids = [...new Set((data ?? []).map((r) => r.label_id as string).filter(Boolean))];
  if (ids.length === 0) return [];
  const { data: labs } = await supabase.from("labels").select("id, slug").in("id", ids);
  return idsLabelsAssignables(labs ?? []);
}

async function labelADesContenusUgc(supabase: Supabase, labelId: string): Promise<boolean> {
  const { data } = await supabase
    .from("contenu_labels")
    .select("contenu_id, contenus!inner(ugc_compatible)")
    .eq("label_id", labelId)
    .eq("contenus.ugc_compatible", true)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Remet une entrée en tête de la file d’où elle a été tirée (langue ou générale). */
async function unshiftLabelFile(
  supabase: Supabase,
  queued: FileLabelQueued,
): Promise<void> {
  const { data } = await supabase
    .from("reglages")
    .select("valeur")
    .eq("cle", "file_labels_comptes")
    .maybeSingle();
  const file = normaliserFileLabelsValeur(data?.valeur);
  const slug = queued.applicationSlug ?? "micabo";
  const slice = sliceFileLabels(file, slug);
  const key = String(queued.queueKey ?? "general").trim().toLowerCase() || "general";

  const next: FileLabelsSlice = key === "general"
    ? { items: [queued.item, ...slice.items], par_langue: slice.par_langue }
    : {
      items: slice.items,
      par_langue: { ...slice.par_langue, [key]: [queued.item, ...(slice.par_langue[key] ?? [])] },
    };
  await ecrireFileLabels(supabase, avecSliceApplication(file, slug, next));
}

async function personaUgcLibre(
  supabase: Supabase,
  applicationId?: string | null,
): Promise<PersonaUgcLibre | null> {
  let q = supabase.from("ugc_personas").select("id, nom, image_face_url, image_profile_url");
  if (applicationId) q = q.eq("application_id", applicationId);
  const { data: personas } = await q;
  if (!personas?.length) return null;

  const { data: pris } = await supabase
    .from("comptes")
    .select("ugc_persona_id")
    .not("ugc_persona_id", "is", null);
  const used = new Set((pris ?? []).map((c) => c.ugc_persona_id as string).filter(Boolean));

  const libres = personas.filter(
    (p) =>
      !used.has(p.id as string) &&
      typeof p.image_face_url === "string" &&
      p.image_face_url.length > 0 &&
      typeof p.nom === "string" &&
      p.nom.trim().length > 0,
  ) as PersonaUgcLibre[];
  if (libres.length === 0) return null;
  return libres[Math.floor(Math.random() * libres.length)] ?? null;
}

/** Télécharge la PDP persona (profil 1:1 ou face), strip C2PA, upload avatar compte. */
async function avatarDepuisFacePersona(
  supabase: Supabase,
  compteId: string,
  faceUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(faceUrl);
    if (!res.ok) return null;
    const raw = new Uint8Array(await res.arrayBuffer());
    const strip = await retirerContentCredentialsBytes(raw);
    const mime =
      strip.mime === "application/octet-stream"
        ? (res.headers.get("content-type") || "image/png")
        : strip.mime;
    const ext = mime.includes("jpeg") || mime.includes("jpg")
      ? "jpg"
      : mime.includes("webp")
        ? "webp"
        : "png";
    const path = `avatars/ugc/${compteId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, strip.bytes, {
      contentType: mime || "image/png",
      upsert: true,
      cacheControl: "3600",
    });
    if (error) return null;
    const pub = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return `${pub}?v=${Date.now()}`;
  } catch {
    return null;
  }
}

/**
 * Compte créé avec warmup NON démarré (started/ends null).
 * Label posé tout de suite ; identité instantanée.
 * UGC slideshow : ugc_ai + persona + nom persona + avatar face stripée.
 */
/** Quota d'assignation journalier : 1–3, défaut 2 à la création. */
function normaliserPostsParJour(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 2;
  return Math.min(3, Math.max(1, Math.round(v)));
}

async function preparerCompte(
  supabase: Supabase,
  posterId: string,
  langue: string,
  referenceId: string | null,
  fileItem: FileLabelItem | null,
  postsParJour: number,
  personaUgc: PersonaUgcLibre | null,
  /** Entrée admin à restaurer si l'insert échoue (pas le fallback label). */
  fileItemQueue: FileLabelQueued | null = null,
  opts: { application?: ApplicationRow | null } = {},
): Promise<{
  id: string;
  reference: string | null;
  persona: boolean;
  labelId: string | null;
  ugc: boolean;
}> {
  const ugc = Boolean(fileItem?.ugc && personaUgc);
  const avecPersona = Boolean(ugc && personaUgc);
  const labelId = fileItem?.label_id ?? null;
  const aRestaurer = fileItemQueue;

  const { data: compte, error } = await supabase
    .from("comptes")
    .insert({
      poster_id: posterId,
      type_compte: "perso",
      compte_reference_id: referenceId,
      langue,
      application_id: opts.application?.id ??
        (await resoudreApplication(supabase, {})).id,
      posts_par_jour: postsParJour,
      warmup_started_at: null,
      warmup_ends_at: null,
      is_active: true,
      ugc_ai: ugc,
      ugc_persona_id: avecPersona ? personaUgc!.id : null,
      persona_nom: avecPersona ? personaUgc!.nom.trim() : null,
    })
    .select("id")
    .single();
  if (error || !compte) {
    if (aRestaurer) await unshiftLabelFile(supabase, aRestaurer);
    return { id: "", reference: referenceId, persona: false, labelId, ugc };
  }

  let labelNom: string | null = null;
  if (labelId) {
    const ok = await filtrerIdsAssignables(supabase, [labelId]);
    if (ok[0]) {
      await supabase.from("compte_labels").insert({ compte_id: compte.id, label_id: ok[0] });
      const { data: lab } = await supabase
        .from("labels")
        .select("nom, slug")
        .eq("id", ok[0])
        .maybeSingle();
      labelNom = (lab?.nom as string | undefined) ?? (lab?.slug as string | undefined) ?? null;
    }
  }

  if (avecPersona && personaUgc) {
    const sourceAvatar =
      (typeof personaUgc.image_profile_url === "string" &&
        personaUgc.image_profile_url.length > 0
        ? personaUgc.image_profile_url
        : null) || personaUgc.image_face_url;
    const avatarUrl = await avatarDepuisFacePersona(
      supabase,
      compte.id,
      sourceAvatar,
    );
    if (avatarUrl) {
      await supabase
        .from("comptes")
        .update({
          avatar_url: avatarUrl,
          avatar_source: "ugc_persona",
          persona_nom: personaUgc.nom.trim(),
        })
        .eq("id", compte.id);
    }
  }

  const { applique } = await appliquerIdentiteInstantanee(supabase, compte.id, {
    labelId,
    labelNom,
  });

  // Sécurité : le nom UGC ne doit pas être écrasé si déjà posé (?? côté persona).
  if (avecPersona && personaUgc) {
    await supabase
      .from("comptes")
      .update({
        persona_nom: personaUgc.nom.trim(),
        ugc_ai: ugc,
        ugc_persona_id: personaUgc.id,
      })
      .eq("id", compte.id);
  }

  return { id: compte.id, reference: referenceId, persona: applique, labelId, ugc };
}

async function referenceLibre(
  supabase: Supabase,
  langue: string,
  applicationId?: string | null,
): Promise<string | null> {
  let q = supabase
    .from("comptes_reference")
    .select("id, langue, ordre_assignation, ordre_par_langue, created_at")
    .eq("is_active", true)
    .is("parent_id", null);
  if (applicationId) q = q.eq("application_id", applicationId);
  const { data: refs } = await q;
  if (!refs || refs.length === 0) return null;

  const { data: comptes } = await supabase
    .from("comptes")
    .select("compte_reference_id")
    .eq("langue", langue)
    .not("compte_reference_id", "is", null);
  const prisDansCetteLangue = new Set((comptes ?? []).map((c) => c.compte_reference_id));

  const libres = refs.filter((r) => !prisDansCetteLangue.has(r.id));
  if (libres.length === 0) return null;

  // deno-lint-ignore no-explicit-any
  const rang = (r: any) =>
    (r.ordre_par_langue?.[langue] as number | undefined) ?? r.ordre_assignation ?? 9999;
  libres.sort(
    (a, b) => rang(a) - rang(b) || String(a.created_at).localeCompare(String(b.created_at)),
  );
  return libres[0].id;
}
