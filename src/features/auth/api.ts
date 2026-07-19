import { supabase } from "@/lib/supabase/client";

export function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

// display_name is read back by the handle_new_user() trigger to provision the
// creator's public.creators row (see migration 0003).
export function signUpWithPassword(
  email: string,
  password: string,
  displayName: string,
) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}
