import { Spinner } from "@/components/ui/spinner";

/** Écran d'attente pendant la résolution de session, avant tout rendu d'app. */
export function FullPageLoader() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-background">
      <span className="brand-mark" aria-hidden>
        S
      </span>
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}
