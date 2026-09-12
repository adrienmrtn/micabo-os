import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { Qualification } from "@/features/moteur/qualification";

/**
 * Les cinq cases, toujours dessinées pareil.
 *
 * Un composant plutôt qu'un `<Badge>` recopié à chaque page : la couleur d'une
 * case est une information, pas une décoration, et deux pages qui la peignent
 * différemment finiraient par se contredire.
 */
const VARIANTE: Record<Qualification, "error" | "warning" | "secondary" | "success" | "default"> = {
  INACTIF: "error",
  MAUVAISES_VUES: "warning",
  PASSABLE: "secondary",
  BIEN: "success",
  STAR: "default",
};

export function QualificationBadge({
  qualification,
  manuelle,
  size,
}: {
  qualification: Qualification;
  /** Case posée à la main : la nuit ne la réécrira pas, ça se voit. */
  manuelle?: boolean;
  size?: "sm" | "default" | "lg";
}) {
  const { t } = useTranslation();
  return (
    <Badge
      variant={VARIANTE[qualification]}
      size={size}
      title={manuelle ? t("qualification.manuelleAide") : t("qualification.aide")}
    >
      {t(`qualification.${qualification}`)}
      {manuelle ? " ·" : null}
    </Badge>
  );
}
