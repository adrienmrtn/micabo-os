import * as React from "react";

import { cn } from "@/lib/utils";

/** Barre de progression déterminée (valeur 0-100). */
export function Progress({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/**
 * Barre de chargement pour une opération SANS étapes discrètes (génération
 * d'identité, test « one-shot »…) : on ne connaît pas l'avancement réel côté
 * serveur, donc la barre approche 95 % de façon asymptotique pendant l'attente
 * (jamais bloquée à 100 avant la fin), puis se remplit à 100 % et disparaît une
 * fois terminé. `label` décrit ce qui tourne.
 */
export function BarreChargement({
  actif,
  dureeMs = 12_000,
  label,
}: {
  actif: boolean;
  /** Durée typique de l'opération : cale la vitesse de remplissage. */
  dureeMs?: number;
  label?: string;
}) {
  const [valeur, setValeur] = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (actif) {
      setVisible(true);
      const debut = Date.now();
      const id = setInterval(() => {
        const t = (Date.now() - debut) / dureeMs;
        // 1 - e^(-2t) : montée rapide au début, plafonnée à 95 % tant que pas fini.
        setValeur(Math.min(95, Math.max(6, 95 * (1 - Math.exp(-2 * t)))));
      }, 150);
      return () => clearInterval(id);
    }
    // Fin : on remplit puis on masque après un court instant.
    setValeur((v) => (v > 0 ? 100 : 0));
    const id = setTimeout(() => setVisible(false), 700);
    return () => clearTimeout(id);
  }, [actif, dureeMs]);

  if (!visible) return null;
  return (
    <div className="space-y-1.5">
      {label && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          {label}
        </p>
      )}
      <Progress value={valeur} />
    </div>
  );
}
