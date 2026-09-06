import * as React from "react";
import { ExternalLink, FileSignature, Send } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  ETAPES_AVEC_MESSAGE,
  LONGUEUR_MAX_MESSAGE,
  type ContexteModele,
  type UpworkModele,
  messageEnvoyable,
  composerMessage,
  modelePour,
} from "./modeles";
import type { EtapeTimelineCle } from "./timeline";
import type { UpworkAction, UpworkApproche } from "./types";

/**
 * Le message de l'étape, variables déjà remplies. Ce qui est affiché est
 * exactement ce qui partira : l'agent ne réécrit rien.
 */
export function MessageEtape({
  approche,
  etape,
  modeles,
  langue,
  contexte,
  actions,
  bloque,
  onEnvoyer,
  onPreparerContrat,
  onAnnuler,
}: {
  approche: UpworkApproche;
  etape: EtapeTimelineCle;
  modeles: UpworkModele[];
  langue: string | null;
  contexte: ContexteModele;
  actions: UpworkAction[];
  bloque: boolean;
  onEnvoyer: (proposalId: string, corps: string) => void;
  onPreparerContrat: (proposalId: string) => void;
  onAnnuler: (id: string) => void;
}) {
  const { t } = useTranslation();
  const modele = modelePour(modeles, etape, approche.role, langue);
  const source = modele?.corps ?? "";
  const { texte, manquantes } = React.useMemo(
    () => composerMessage(source, { ...contexte, role: approche.role, etape }),
    [source, contexte, approche.role, etape],
  );

  const [brouillon, setBrouillon] = React.useState(texte);
  const [modifie, setModifie] = React.useState(false);
  const affiche = modifie ? brouillon : texte;

  React.useEffect(() => {
    if (!modifie) setBrouillon(texte);
  }, [texte, modifie]);

  const messageEnFile =
    actions.find(
      (a) =>
        a.upwork_proposal_id === approche.upwork_proposal_id &&
        a.type === "envoyer_message" &&
        a.statut === "en_attente",
    ) ?? null;

  const contratEnFile =
    actions.find(
      (a) =>
        a.upwork_proposal_id === approche.upwork_proposal_id &&
        a.type === "preparer_contrat" &&
        a.statut === "en_attente",
    ) ?? null;

  const contratIci = etape === "contrat_envoye";
  if (!ETAPES_AVEC_MESSAGE.includes(etape) && !contratIci) return null;

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-dashed bg-muted/30 p-3">
      {contratIci && (
        <BlocContrat
          approche={approche}
          enFile={contratEnFile}
          bloque={bloque}
          onPreparer={onPreparerContrat}
          onAnnuler={onAnnuler}
        />
      )}

      {modele ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-xs">{t("upwork.messageEtape")}</p>
            {messageEnFile ? (
              <span className="inline-flex items-center gap-2">
                <Badge variant="warning" size="sm">
                  {t("upwork.messageEnFile")}
                </Badge>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={bloque}
                  onClick={() => onAnnuler(messageEnFile.id)}
                >
                  {t("upwork.actionAnnuler")}
                </Button>
              </span>
            ) : (
              <Button
                size="xs"
                disabled={bloque || !messageEnvoyable(affiche, modifie ? [] : manquantes)}
                onClick={() => onEnvoyer(approche.upwork_proposal_id, affiche)}
              >
                <Send className="size-3.5" />
                {t("upwork.messageEnvoyer")}
              </Button>
            )}
          </div>

          {messageEnFile ? (
            <p className="whitespace-pre-wrap text-muted-foreground text-xs leading-relaxed">
              {messageEnFile.message}
            </p>
          ) : (
            <>
              <Textarea
                value={affiche}
                rows={8}
                maxLength={LONGUEUR_MAX_MESSAGE}
                disabled={bloque}
                onChange={(e) => {
                  setModifie(true);
                  setBrouillon(e.target.value);
                }}
                className="text-xs leading-relaxed"
                aria-label={t("upwork.messageEtape")}
              />
              <p className="text-muted-foreground text-[11px]">
                {manquantes.length > 0 && !modifie
                  ? t("upwork.messageManque", { vars: manquantes.join(", ") })
                  : t("upwork.messageAide")}
              </p>
            </>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-xs">{t("upwork.messageAucunModele")}</p>
      )}
    </div>
  );
}

/**
 * Upwork ne laisse créer qu'un brouillon d'offre : l'agent le prépare, l'admin
 * ouvre le lien et envoie. La case se coche ensuite toute seule au sync.
 */
function BlocContrat({
  approche,
  enFile,
  bloque,
  onPreparer,
  onAnnuler,
}: {
  approche: UpworkApproche;
  enFile: UpworkAction | null;
  bloque: boolean;
  onPreparer: (proposalId: string) => void;
  onAnnuler: (id: string) => void;
}) {
  const { t } = useTranslation();

  if (approche.offre_finalize_url) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        <Button asChild size="xs" variant="outline">
          <a href={approche.offre_finalize_url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            {t("upwork.contratFinaliser")}
          </a>
        </Button>
        <p className="text-muted-foreground text-[11px]">{t("upwork.contratFinaliserAide")}</p>
      </div>
    );
  }

  if (enFile) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        <Badge variant="warning" size="sm">
          {t("upwork.contratEnPreparation")}
        </Badge>
        <Button variant="ghost" size="xs" disabled={bloque} onClick={() => onAnnuler(enFile.id)}>
          {t("upwork.actionAnnuler")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b pb-2">
      <Button
        size="xs"
        variant="outline"
        disabled={bloque}
        onClick={() => onPreparer(approche.upwork_proposal_id)}
      >
        <FileSignature className="size-3.5" />
        {t("upwork.contratPreparer")}
      </Button>
      <p className="text-muted-foreground text-[11px]">{t("upwork.contratPreparerAide")}</p>
    </div>
  );
}
