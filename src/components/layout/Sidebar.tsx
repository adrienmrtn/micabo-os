import * as React from "react";
import { NavLink } from "react-router-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Explication courte, montrée en infobulle au survol (garde la nav compacte). */
  description?: string;
}

/** Un bloc de navigation, avec un intitulé de section optionnel. */
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-5 px-3 py-2">
      {groups.map((groupe, i) => (
        <div key={groupe.title ?? i} className="flex flex-col gap-0.5">
          {groupe.title && (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {groupe.title}
            </p>
          )}
          {groupe.items.map(({ to, label, icon: Icon, description }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={onNavigate}
              title={description}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-active/20 font-medium text-white"
                    : "text-sidebar-foreground/85 hover:bg-white/[0.06] hover:text-white",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0 transition-colors",
                      isActive ? "text-white" : "text-sidebar-foreground/60 group-hover:text-white",
                    )}
                  />
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function Brand({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <img src="/favicon.svg" alt="Sophia" className="size-9 shrink-0 rounded-xl shadow-sm" />
      <span className="truncate text-[15px] font-semibold tracking-tight text-white">{title}</span>
    </div>
  );
}

export function Sidebar({
  title,
  groups,
  footer,
}: {
  title: string;
  groups: NavGroup[];
  footer?: React.ReactNode;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col self-start border-r border-white/5 bg-sidebar lg:flex">
      <Brand title={title} />
      <div className="flex-1 overflow-y-auto scrollbar-slim">
        <NavList groups={groups} />
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
  groups,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  groups: NavGroup[];
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
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
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
          <NavList groups={groups} onNavigate={onClose} />
        </div>
        {footer && <div className="border-t border-white/10 p-3">{footer}</div>}
      </div>
    </div>
  );
}
