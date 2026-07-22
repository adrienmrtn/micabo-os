import * as React from "react";
import { useTranslation } from "react-i18next";
import { LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthContext";
import { signOut } from "@/features/auth/api";
import { SUPPORTED_LANGUAGES } from "@/locales";
import { MobileDrawer, Sidebar, type NavGroup } from "./Sidebar";

interface ProfilAffiche {
  prenom: string | null;
  nom: string | null;
  email: string | null;
}

/** Prénom + nom si on les a, sinon l'email : un poster doit toujours se
 *  reconnaître dans la barre latérale. */
function nomAffiche(profil: ProfilAffiche | null): string | null {
  if (!profil) return null;
  const complet = [profil.prenom, profil.nom].filter(Boolean).join(" ");
  return complet || profil.email;
}

function initiales(profil: ProfilAffiche | null): string {
  const nom = nomAffiche(profil);
  if (!nom) return "?";
  return nom
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function UserBlock() {
  const { profil } = useAuth();
  return (
    <div className="flex items-center gap-2.5 px-2 py-1">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-active/25 text-xs font-semibold text-white">
        {initiales(profil)}
      </div>
      <span className="min-w-0 flex-1 truncate text-sm text-sidebar-foreground">
        {nomAffiche(profil) ?? "—"}
      </span>
    </div>
  );
}

export function AppShell({
  navLabel,
  groups,
  children,
}: {
  navLabel: string;
  groups: NavGroup[];
  children: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const footer = <UserBlock />;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar title={t("app.name")} groups={groups} footer={footer} />
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t("app.name")}
        groups={groups}
        footer={footer}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-5 lg:px-10">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label="Ouvrir le menu"
              >
                <Menu />
              </Button>
              <span className="truncate text-[15px] font-semibold tracking-tight">
                {navLabel}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {SUPPORTED_LANGUAGES.length > 1 && (
                <select
                  aria-label="langue"
                  className="h-8 rounded-lg border border-input bg-card px-2 text-sm"
                  value={i18n.resolvedLanguage}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang.toUpperCase()}
                    </option>
                  ))}
                </select>
              )}
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                <LogOut />
                <span className="hidden sm:inline">{t("auth.logout")}</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 animate-fade-in px-5 py-7 lg:px-10 lg:py-9">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
