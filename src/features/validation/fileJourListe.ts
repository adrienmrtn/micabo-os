import { supabase } from "@/lib/supabase/client";
import {
  horsFileValidation,
  sourceUrlValidation,
  type ItemValidationJour,
} from "@/features/validation/fileJour";

function un<T>(x: T | T[] | null | undefined): T | null {
  if (Array.isArray(x)) return x[0] ?? null;
  return x ?? null;
}

type ContenuJoin = { titre: string | null; source_url: string | null };
type ProfilJoin = { prenom: string | null; nom: string | null };

/**
 * Posts prévus ce jour Paris, hors test / UGC VIDEO / déjà publiés / déjà validés.
 * Source URL = contenu v-next, sinon sujet legacy.
 */
export async function listerFileValidationJour(jour: string): Promise<ItemValidationJour[]> {
  const [{ data: posts, error: e1 }, { data: faits, error: e2 }] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, compte_id, type, statut, sujets(titre, source_url), comptes(poster_id, handle_tiktok, persona_nom, ugc_ai_video, langue, profiles(prenom, nom))",
      )
      .eq("date_publication_prevue", jour)
      .eq("est_test", false)
      .order("created_at", { ascending: true }),
    supabase.from("validation_jour_faits").select("post_id").eq("jour", jour),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const deja = new Set((faits ?? []).map((r) => r.post_id as string));
  const ids = (posts ?? []).map((p) => p.id as string);
  const slidesParPost = new Map<string, { nb: number; media: number }>();
  const passageParPost = new Map<
    string,
    { id: string; contenuId: string | null; titre: string | null; sourceUrl: string | null }
  >();
  if (ids.length > 0) {
    const chunk = 80;
    for (let i = 0; i < ids.length; i += chunk) {
      const slice = ids.slice(i, i + chunk);
      const [{ data: slides, error: e3 }, { data: passages, error: e4 }] = await Promise.all([
        supabase.from("post_slides").select("post_id, media_id").in("post_id", slice),
        supabase
          .from("passages")
          .select("id, post_id, contenu_id, contenus(titre, source_url)")
          .in("post_id", slice),
      ]);
      if (e3) throw e3;
      if (e4) throw e4;
      for (const s of slides ?? []) {
        const pid = s.post_id as string;
        const cur = slidesParPost.get(pid) ?? { nb: 0, media: 0 };
        cur.nb += 1;
        if (s.media_id) cur.media += 1;
        slidesParPost.set(pid, cur);
      }
      for (const raw of passages ?? []) {
        const p = raw as {
          id: string;
          post_id: string | null;
          contenu_id: string | null;
          contenus: ContenuJoin | ContenuJoin[] | null;
        };
        if (!p.post_id || passageParPost.has(p.post_id)) continue;
        const contenu = un(p.contenus);
        passageParPost.set(p.post_id, {
          id: p.id,
          contenuId: p.contenu_id ?? null,
          titre: contenu?.titre ?? null,
          sourceUrl: contenu?.source_url ?? null,
        });
      }
    }
  }

  const out: ItemValidationJour[] = [];
  for (const raw of posts ?? []) {
    const r = raw as {
      id: string;
      compte_id: string;
      type: string;
      statut: string;
      sujets:
        | { titre: string | null; source_url: string | null }
        | Array<{ titre: string | null; source_url: string | null }>
        | null;
      comptes:
        | {
            poster_id: string | null;
            handle_tiktok: string | null;
            persona_nom: string | null;
            ugc_ai_video: boolean | null;
            langue: string | null;
            profiles: ProfilJoin | ProfilJoin[] | null;
          }
        | Array<{
            poster_id: string | null;
            handle_tiktok: string | null;
            persona_nom: string | null;
            ugc_ai_video: boolean | null;
            langue: string | null;
            profiles: ProfilJoin | ProfilJoin[] | null;
          }>
        | null;
    };
    const comptes = un(r.comptes);
    const sujet = un(r.sujets);
    const passage = passageParPost.get(r.id);
    if (
      horsFileValidation({
        postId: r.id,
        statut: r.statut,
        ugcAiVideo: Boolean(comptes?.ugc_ai_video),
        deja,
      })
    ) {
      continue;
    }
    const profil = un(comptes?.profiles);
    const perso = [profil?.prenom, profil?.nom].filter(Boolean).join(" ");
    const counts = slidesParPost.get(r.id) ?? { nb: 0, media: 0 };
    out.push({
      postId: r.id,
      passageId: passage?.id ?? null,
      contenuId: passage?.contenuId ?? null,
      compteId: r.compte_id,
      posterNom:
        perso || comptes?.persona_nom || (comptes?.handle_tiktok ? `@${comptes.handle_tiktok}` : "—"),
      handle: comptes?.handle_tiktok ?? null,
      sourceUrl: sourceUrlValidation({
        passageSource: passage?.sourceUrl,
        sujetSource: sujet?.source_url,
      }),
      titre: passage?.titre ?? sujet?.titre ?? null,
      langue: comptes?.langue ?? null,
      type: r.type,
      statut: r.statut,
      slideshowVide: counts.nb === 0 || counts.media === 0,
    });
  }
  return out;
}

export async function marquerValideJour(postId: string, jour: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("validation_jour_faits").upsert(
    { post_id: postId, jour, admin_id: auth.user?.id ?? null },
    { onConflict: "post_id,jour" },
  );
  if (error) throw error;
}
