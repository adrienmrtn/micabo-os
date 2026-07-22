import * as React from "react";
import { NavLink } from "react-router-dom";
import { Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Courte explication de ce que fait l'écran, montrée sous le libellé. */
  description?: string;
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {items.map(({ to, label, icon: Icon, description }) => (
        <NavLink
          key={to}
          to={to}
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-start gap-3 rounded-md px-3 py-2 transition-colors",
              isActive
                ? "bg-sidebar-active/20 text-white"
                : "text-sidebar-foreground hover:bg-white/5 hover:text-white",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm", isActive && "font-medium")}>
                  {label}
                </span>
                {description && (
                  <span className="mt-0.5 block text-[11px] leading-tight text-sidebar-foreground/55">
                    {description}
                  </span>
                )}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-active/25">
        <Sparkles className="size-4 text-white" />
      </div>
      <span className="truncate text-sm font-semibold text-white">{title}</span>
    </div>
  );
}

export function Sidebar({
  title,
  items,
  footer,
}: {
  title: string;
  items: NavItem[];
  footer?: React.ReactNode;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar lg:flex">
      <Brand title={title} />
      <div className="flex-1 overflow-y-auto scrollbar-slim">
        <NavList items={items} />
      </div>
      {footer && <div className="border-t border-white/10 p-3">{footer}</div>}
    </aside>
  );
}

/** Tiroir mobile : un simple overlay suffit ici et évite une dépendance de
 *  plus pour une seule surface. */
export function MobileDrawer({
  open,
  onClose,
  title,
  items,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  items: NavItem[];
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        aria-label="Fermer le menu"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-64 animate-slide-in flex-col bg-sidebar">
        <div className="flex items-center justify-between pr-3">
          <Brand title={title} />
          <button
            onClick={onClose}
            className="rounded-md p-2 text-sidebar-foreground hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-slim">
          <NavList items={items} onNavigate={onClose} />
        </div>
        {footer && <div className="border-t border-white/10 p-3">{footer}</div>}
      </div>
    </div>
  );
}
