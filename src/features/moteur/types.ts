export type PipelineStatut = "pending" | "running" | "done" | "failed";
export type SujetStatut = "propose" | "retenu" | "rejete" | "utilise";
export type PostType = "recycle" | "remanie" | "nouveau";
export type PostStatut = "brouillon" | "assigne" | "valide_par_poster" | "publie";
export type MediaSource =
  | "nettoye_reference"
  | "stock_libre_de_droits"
  | "genere_ia"
  | "fourni_par_freelance";

export interface CompteReference {
  id: string;
  handle_tiktok: string;
  niche: string | null;
  langue: string;
  /** Prompt adapté (voix / ton de traduction) propre à cette source. */
  style_profile: string | null;
  is_active: boolean;
  dernier_scrape_at: string | null;
  created_at: string;
}

export interface Compte {
  id: string;
  poster_id: string;
  compte_reference_id: string | null;
  langue: string;
  persona_nom: string | null;
  persona_bio: string | null;
  avatar_url: string | null;
  avatar_source: string | null;
  handle_tiktok: string | null;
  style_profile: string | null;
  demarre_le: string;
  is_active: boolean;
  /** null = suit les réglages globaux. */
  repartition: { recycle: number; remanie: number; nouveau: number } | null;
  posts_par_jour: number | null;
}

export interface CompteAvecDetails extends Compte {
  profiles: { prenom: string | null; nom: string | null; upwork_url: string | null } | null;
  comptes_reference: { handle_tiktok: string } | null;
}

/** Une slide telle que stockée dans `sujets.structure_slides`. */
export interface SujetSlide {
  position: number;
  raw_url: string;
  texte_original: string | null;
  media_id: string | null;
}

export interface Sujet {
  id: string;
  titre: string;
  structure_slides: SujetSlide[];
  compte_reference_id: string | null;
  langue: string;
  source_url: string | null;
  pertinence_score: number | null;
  pertinence_raison: string | null;
  statut: SujetStatut;
  preparation_statut: PipelineStatut;
  preparation_erreur: string | null;
  musique_url: string | null;
  created_at: string;
}

export interface Media {
  id: string;
  compte_id: string | null;
  compte_reference_id: string | null;
  storage_path: string;
  url: string;
  source: MediaSource;
  tags: string[];
  langue: string | null;
  visage_identifiable: boolean | null;
  used_count: number;
  created_at: string;
}

export interface Post {
  id: string;
  compte_id: string;
  sujet_id: string | null;
  date_publication_prevue: string | null;
  type: PostType;
  statut: PostStatut;
  musique_url: string | null;
  musique_titre: string | null;
  musique_plateforme: string | null;
  publie_at: string | null;
  publie_url: string | null;
  pipeline_statut: PipelineStatut;
  pipeline_etape: string | null;
  pipeline_erreur: string | null;
  created_at: string;
}

export interface PostSlide {
  id: string;
  post_id: string;
  position: number;
  media_id: string | null;
  texte_overlay: string | null;
  position_sophia: boolean;
  /** Visuel d'origine, texte encore incrusté : modèle de placement. */
  reference_url: string | null;
  media_library: { url: string; storage_path: string } | null;
}

export interface PosterProfil {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  langues: string[];
  nationalite: string | null;
  upwork_url: string | null;
  handle_tiktok: string | null;
  reference_handle: string | null;
  manager_id: string | null;
  manager_nom: string | null;
  is_active: boolean;
  must_change_password: boolean;
  role: "admin" | "poster" | "hiring_manager" | null;
}

export interface Reglages {
  repartition: { recycle: number; remanie: number; nouveau: number };
  frequence: { posts_par_jour: number };
  semaine1: {
    actif: boolean;
    jours: number;
    posts_par_jour: number;
    tout_recycle: boolean;
  };
}

export interface StatsCompte {
  compte_id: string;
  persona_nom: string | null;
  handle_tiktok: string | null;
  langue: string;
  is_active: boolean;
  poster_prenom: string | null;
  poster_nom: string | null;
  posts_total: number;
  posts_publies: number;
  posts_en_attente: number;
  vues_totales: number;
  likes_totaux: number;
  vues_moyennes: number;
}

export interface StatsPost {
  id: string;
  compte_id: string;
  persona_nom: string | null;
  handle_tiktok: string | null;
  type: PostType;
  statut: PostStatut;
  date_publication_prevue: string | null;
  publie_at: string | null;
  publie_url: string | null;
  sujet_titre: string | null;
  vues: number | null;
  likes: number | null;
  commentaires: number | null;
  partages: number | null;
}
