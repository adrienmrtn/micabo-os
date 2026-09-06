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
  MODELE_FRANCE,
  MODELE_GENERIQUE,
  VARIABLES_MODELE,
  type UpworkModele,
} from "./modeles";
import type { EtapeTimelineCle } from "./timeline";

const ROLES = ["hm"] as const;
const LANGUES_PLAYBOOK = [
  { code: MODELE_FRANCE, cle: "fr" },
  { code: MODELE_GENERIQUE, cle: "en" },
] as const;

/**
 * Playbook de l'étape, pas la lettre. FR pour la France, EN pour
 * tous les autres pays. L'OS compose le brouillon par personne.
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
              {ETAPES_AVEC_MESSAGE.filter(
                (cle) => !(role === "hm" && cle === "acces_envoyes"),
              ).map((cle) => {
                const versions = LANGUES_PLAYBOOK.map(({ code, cle: localeCle }) => ({
                  localeCle,
                  code,
                  modele: modeles.find(
                    (m) => m.cle === cle && m.role_cible === role && m.langue === code,
                  ),
                })).filter((v) => v.modele);
                if (versions.length === 0) return null;
                return (
                  <div key={`${role}-${cle}`} className="space-y-2">
                    {versions.map((v) => (
                      <ChampModele
                        key={`${role}-${cle}-${v.code}`}
                        cle={cle}
                        role={role}
                        langue={v.code}
                        localeCle={v.localeCle}
                        modele={v.modele!}
                      />
                    ))}
                  </div>
                );
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
  langue,
  localeCle,
  modele,
}: {
  cle: EtapeTimelineCle;
  role: "hm" | "createur";
  langue: string;
  localeCle: "fr" | "en";
  modele: UpworkModele;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [corps, setCorps] = React.useState(modele.corps);

  const enregistrer = useMutation({
    mutationFn: () => enregistrerModele({ cle, role_cible: role, langue, corps }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["upwork-dashboard"] }),
  });

  const modifie = corps !== modele.corps;

  return (
    <div className="rounded-lg border bg-background p-3">
      <Repliable
        entete={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{t(`upwork.timeline.${cle}`)}</span>
            <Badge variant="outline" size="sm">
              {t(`upwork.modelesLangue.${localeCle}`)}
            </Badge>
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
          aria-label={`${t(`upwork.timeline.${cle}`)} ${t(`upwork.modelesLangue.${localeCle}`)}`}
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
