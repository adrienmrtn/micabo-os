import type * as React from "react";

/** Cadre commun aux écrans auth secondaires (changement MDP…). */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="surface-atelier flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center animate-brand-in">
        <p className="font-display text-4xl font-semibold tracking-tight">Sophia</p>
      </div>

      <div className="w-full max-w-sm animate-fade-in border border-border/80 bg-card/90 p-6 shadow-lifted">
        <div className="mb-6 space-y-1">
          <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>

      {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
