import { supabase } from "@/lib/supabase/client";
import type { AssignmentWithDetails, ManagedUser, TikTokAccount } from "./types";

export const MAX_ACCOUNTS_PER_POSTER = 4;

// --- Comptes TikTok ---------------------------------------------------------

export async function listTikTokAccounts(): Promise<TikTokAccount[]> {
  const { data, error } = await supabase
    .from("tiktok_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TikTokAccount[];
}

export async function createTikTokAccount(input: {
  handle: string;
  niche: string;
  suggestedCreatorHandle: string;
  profileUrl: string;
  notes: string;
  createdBy: string;
}): Promise<TikTokAccount> {
  const handle = input.handle.trim().replace(/^@/, "");

  const { data, error } = await supabase
    .from("tiktok_accounts")
    .insert({
      handle,
      niche: input.niche.trim() || null,
      suggested_creator_handle: input.suggestedCreatorHandle.trim() || null,
      profile_url: input.profileUrl.trim() || `https://www.tiktok.com/@${handle}`,
      notes: input.notes.trim() || null,
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data as TikTokAccount;
}

export async function updateTikTokAccount(
  id: string,
  patch: Partial<Pick<TikTokAccount, "is_active" | "niche" | "suggested_creator_handle" | "notes">>,
): Promise<void> {
  const { error } = await supabase.from("tiktok_accounts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTikTokAccount(id: string): Promise<void> {
  const { error } = await supabase.from("tiktok_accounts").delete().eq("id", id);
  if (error) throw error;
}

// --- Assignations -----------------------------------------------------------

export async function listAssignments(): Promise<AssignmentWithDetails[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select("*, tiktok_accounts(handle, niche, suggested_creator_handle), profiles(display_name)")
    .order("assigned_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AssignmentWithDetails[];
}

export async function createAssignment(input: {
  posterId: string;
  tiktokAccountId: string;
  assignedBy: string;
}): Promise<void> {
  const { error } = await supabase.from("assignments").insert({
    poster_id: input.posterId,
    tiktok_account_id: input.tiktokAccountId,
    assigned_by: input.assignedBy,
  });

  if (error) throw error;
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  if (error) throw error;
}

// --- Utilisateurs & rôles ---------------------------------------------------

export async function listUsers(): Promise<ManagedUser[]> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, is_active, account_setup_done, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const { data: roles } = await supabase.from("user_roles").select("user_id, role");
  const roleByUser = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

  return (profiles ?? []).map((profile) => ({
    ...profile,
    role: (roleByUser.get(profile.id) ?? null) as ManagedUser["role"],
  }));
}

/** Un utilisateur ne porte qu'un rôle : l'ancien est retiré avant d'ajouter. */
export async function setUserRole(
  userId: string,
  role: "admin" | "poster",
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (error) throw error;
}

/** Posters assignables (les admins ne postent pas). */
export async function listPosters(): Promise<
  Array<{ id: string; display_name: string | null }>
> {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "poster");

  if (error) throw error;
  const ids = (roles ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids)
    .order("display_name");

  return (profiles ?? []) as Array<{ id: string; display_name: string | null }>;
}
