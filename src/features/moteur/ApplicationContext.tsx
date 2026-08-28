import * as React from "react";

import { listerApplications } from "./api";
import { SLUG_MICABO, type ApplicationOs } from "./applications";

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
  const [isPending, setIsPending] = React.useState(true);

  React.useEffect(() => {
    try {
      localStorage.removeItem("os-application-slug");
    } catch {
      /* private mode */
    }
    let alive = true;
    void listerApplications()
      .then((liste) => {
        if (!alive) return;
        setApplications(liste.filter((a) => a.slug === SLUG_MICABO));
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

  const application = applications.find((a) => a.slug === SLUG_MICABO) ?? applications[0] ?? null;

  const value = React.useMemo<ApplicationContextValue>(
    () => ({
      applications: application ? [application] : [],
      application,
      applicationId: application?.id ?? null,
      slug: SLUG_MICABO,
      setSlug: () => undefined,
      isPending,
    }),
    [application, isPending],
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
      slug: SLUG_MICABO,
      setSlug: () => undefined,
      isPending: false,
    };
  }
  return ctx;
}
