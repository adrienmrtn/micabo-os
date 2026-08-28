import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function SupabaseConfigBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <Alert variant="error" className="rounded-none border-x-0 border-t-0">
      <AlertDescription className="text-center">
        Supabase n'est pas configuré — copiez .env.example vers .env et
        renseignez VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
      </AlertDescription>
    </Alert>
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
