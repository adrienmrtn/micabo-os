export interface TikTokAccount {
  id: string;
  handle: string;
  profile_url: string | null;
  avatar_url: string | null;
  niche: string | null;
  suggested_creator_handle: string | null;
  is_reference: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  poster_id: string;
  tiktok_account_id: string;
  assigned_at: string;
}

export interface AssignmentWithDetails extends Assignment {
  tiktok_accounts: Pick<TikTokAccount, "handle" | "niche" | "suggested_creator_handle"> | null;
  profiles: { display_name: string | null } | null;
}

export interface ManagedUser {
  id: string;
  display_name: string | null;
  is_active: boolean;
  account_setup_done: boolean;
  created_at: string;
  role: "admin" | "poster" | null;
}
