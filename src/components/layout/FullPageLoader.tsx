/** Écran d'attente pendant la résolution de session, avant tout rendu d'app. */
export function FullPageLoader() {
  return (
    <div className="surface-atelier flex min-h-screen flex-col items-center justify-center gap-5">
      <span className="brand-mark animate-pulse" aria-hidden>
        S
      </span>
      <div className="h-0.5 w-28 overflow-hidden rounded-sm bg-border">
        <div className="h-full w-1/2 animate-[slide-in_1.1s_ease-in-out_infinite] bg-primary" />
      </div>
    </div>
  );
}
