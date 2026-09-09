import * as React from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
  compteEnEssai,
  essaiEndsAt,
  essaiRestantMs,
  formaterCountdownEssai,
} from "@/features/moteur/essai";

/** Badge admin : countdown 5 j. depuis la création du compte OS. Invisible hors essai. */
export function EssaiBadge({ createdAt }: { createdAt: string | null | undefined }) {
  const { t } = useTranslation();
  const [, setTick] = React.useState(0);
  const enEssai = compteEnEssai(createdAt);

  React.useEffect(() => {
    if (!enEssai) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [enEssai]);

  if (!createdAt || !enEssai) return null;

  const restant = essaiRestantMs(createdAt);
  const fin = essaiEndsAt(createdAt);
  return (
    <Badge
      variant="info"
      title={t("essai.fin", { date: fin.toLocaleString() })}
    >
      {t("essai.badge", { temps: formaterCountdownEssai(restant) })}
    </Badge>
  );
}
