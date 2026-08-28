import { BrandLogo } from "@/components/brand/BrandLogo";
import { Spinner } from "@/components/ui/spinner";

/** Écran d'attente pendant la résolution de session, avant tout rendu d'app. */
export function FullPageLoader() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-background">
      <BrandLogo size="md" />
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}
