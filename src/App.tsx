import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function SupabaseConfigBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="bg-destructive px-4 py-2 text-center text-sm text-destructive-foreground">
      Supabase n'est pas configuré — copiez .env.example vers .env et
      renseignez VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
    </div>
  );
}

export function App() {
  return (
    <AppProviders>
      <SupabaseConfigBanner />
      <AppRouter />
    </AppProviders>
  );
}
