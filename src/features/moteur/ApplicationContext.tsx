import * as React from "react";

import { listerApplications } from "./api";
import { SLUG_SOPHIA, type ApplicationOs } from "./applications";

const STORAGE_KEY = "os-application-slug";

function lireSlugSauve(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? SLUG_SOPHIA;
  } catch {
    return SLUG_SOPHIA;
  }
}

interface ApplicationContextValue {
  applications: ApplicationOs[];
  application: ApplicationOs | null;
  applicationId: string | null;
  slug: string;
  setSlug: (slug: string) => void;
  isPending: boolean;
}

const ApplicationContext = React.createContext<ApplicationContextValue | null>(null);

export function ApplicationProvider({ children }: { children: React.ReactNode }) {
  const [applications, setApplications] = React.useState<ApplicationOs[]>([]);
  const [slug, setSlugState] = React.useState(lireSlugSauve);
  const [isPending, setIsPending] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    void listerApplications()
      .then((liste) => {
        if (!alive) return;
        setApplications(liste);
        setSlugState((actuel) => {
          if (liste.length > 0 && !liste.some((a) => a.slug === actuel)) {
            const fallback = liste[0]!.slug;
            try {
              localStorage.setItem(STORAGE_KEY, fallback);
            } catch {
              /* private mode */
            }
            return fallback;
          }
          return actuel;
        });
      })
      .catch(() => {
        if (!alive) return;
        setApplications([]);
      })
      .finally(() => {
        if (alive) setIsPending(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setSlug = React.useCallback((suivant: string) => {
    setSlugState(suivant);
    try {
      localStorage.setItem(STORAGE_KEY, suivant);
    } catch {
      /* private mode */
    }
  }, []);

  const application = applications.find((a) => a.slug === slug) ?? applications[0] ?? null;

  const value = React.useMemo<ApplicationContextValue>(
    () => ({
      applications,
      application,
      applicationId: application?.id ?? null,
      slug: application?.slug ?? slug,
      setSlug,
      isPending,
    }),
    [applications, application, slug, setSlug, isPending],
  );

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
}

export function useApplication(): ApplicationContextValue {
  const ctx = React.useContext(ApplicationContext);
  if (!ctx) {
    return {
      applications: [],
      application: null,
      applicationId: null,
      slug: SLUG_SOPHIA,
      setSlug: () => undefined,
      isPending: false,
    };
  }
  return ctx;
}
