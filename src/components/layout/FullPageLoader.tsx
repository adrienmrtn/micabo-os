import { Sparkles } from "lucide-react";

/** Écran d'attente pendant la résolution de session, avant tout rendu d'app. */
export function FullPageLoader() {
  return (
    <div className="surface-gradient flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="flex size-11 animate-pulse items-center justify-center rounded-lg bg-primary">
        <Sparkles className="size-5 text-primary-foreground" />
      </div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 animate-[slide-in_1s_ease-in-out_infinite] bg-primary" />
      </div>
    </div>
  );
}
