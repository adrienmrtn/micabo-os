import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { enregistrerModele } from "./api";
import { Repliable } from "./Deroule";
import {
  ETAPES_AVEC_MESSAGE,
  LONGUEUR_MAX_MESSAGE,
  MODELE_GENERIQUE,
  VARIABLES_MODELE,
  type UpworkModele,
  modelePour,
} from "./modeles";
import type { EtapeTimelineCle } from "./timeline";

const ROLES = ["hm", "createur"] as const;

/**
 * Playbook de l'étape, pas la lettre. L'OS compose le brouillon par
 * personne (ce qu'elle a dit, ce qu'il lui manque) avant d'afficher.
 */
export function EditeurModeles({ modeles }: { modeles: UpworkModele[] }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border bg-card p-4">
      <Repliable
        entete={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{t("upwork.modelesTitre")}</span>
            <span className="text-muted-foreground text-xs">
              {t("upwork.modelesCompte", { n: modeles.length })}
            </span>
          </span>
        }
      >
        <p className="mb-3 text-muted-foreground text-xs">
          {t("upwork.modelesAide", { vars: VARIABLES_MODELE.map((v) => `{{${v}}}`).join(" ") })}
        </p>
        <div className="space-y-4">
          {ROLES.map((role) => (
            <section key={role} className="space-y-2">
              <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {t(`upwork.modelesRole.${role}`)}
              </h3>
              {ETAPES_AVEC_MESSAGE.map((cle) => {
                const modele = modelePour(modeles, cle, role, null);
                if (!modele) return null;
                return <ChampModele key={`${role}-${cle}`} cle={cle} role={role} modele={modele} />;
              })}
            </section>
          ))}
        </div>
      </Repliable>
    </div>
  );
}

function ChampModele({
  cle,
  role,
  modele,
}: {
  cle: EtapeTimelineCle;
  role: "hm" | "createur";
  modele: UpworkModele;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [corps, setCorps] = React.useState(modele.corps);

  const enregistrer = useMutation({
    mutationFn: () =>
      enregistrerModele({ cle, role_cible: role, langue: MODELE_GENERIQUE, corps }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["upwork-dashboard"] }),
  });

  const modifie = corps !== modele.corps;

  return (
    <div className="rounded-lg border bg-background p-3">
      <Repliable
        entete={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{t(`upwork.timeline.${cle}`)}</span>
            {modifie && (
              <Badge variant="warning" size="sm">
                {t("upwork.modelesModifie")}
              </Badge>
            )}
          </span>
        }
      >
        <Textarea
          value={corps}
          rows={10}
          maxLength={LONGUEUR_MAX_MESSAGE}
          disabled={enregistrer.isPending}
          onChange={(e) => setCorps(e.target.value)}
          className="text-xs leading-relaxed"
          aria-label={t(`upwork.timeline.${cle}`)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="xs" disabled={!modifie || enregistrer.isPending} onClick={() => enregistrer.mutate()}>
            {t("common.save")}
          </Button>
          {modifie && (
            <Button
              variant="ghost"
              size="xs"
              disabled={enregistrer.isPending}
              onClick={() => setCorps(modele.corps)}
            >
              {t("common.cancel")}
            </Button>
          )}
          {enregistrer.error && (
            <span className="text-destructive text-xs">
              {(enregistrer.error as Error).message}
            </span>
          )}
        </div>
      </Repliable>
    </div>
  );
}
