import * as React from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supprimerVideoRemarque, televerserVideoRemarque } from "@/features/moteur/api";
import {
  formaterOctets,
  preparerVideoRemarque,
  refusFichierVideo,
  SOURCE_OCTETS_MAX,
} from "@/features/reviews/videoRemarque";

/**
 * Emplacement vidéo d'une puce générique, côté admin.
 *
 * Le fichier part dès qu'il est déposé — l'aperçu immédiat vaut mieux qu'un
 * envoi différé —, mais le lien n'est rattaché à la puce qu'à l'enregistrement
 * du réglage : c'est ce que dit l'aide sous le champ.
 */
export function VideoRemarqueChamp({
  remarqueId,
  videoUrl,
  videoPath,
  disabled,
  onChange,
}: {
  remarqueId: string;
  videoUrl: string | null | undefined;
  videoPath: string | null | undefined;
  disabled?: boolean;
  onChange: (v: { videoUrl: string | null; videoPath: string | null }) => void;
}) {
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [etat, setEtat] = React.useState<string | null>(null);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [occupe, setOccupe] = React.useState(false);

  async function deposer(fichier: File) {
    setErreur(null);
    const refus = refusFichierVideo(fichier);
    if (refus) {
      setErreur(
        refus === "trop_gros"
          ? t("reviewsJour.videoTropGros", { max: formaterOctets(SOURCE_OCTETS_MAX) })
          : t("reviewsJour.videoPasUneVideo"),
      );
      return;
    }
    setOccupe(true);
    try {
      const prete = await preparerVideoRemarque(fichier, setEtat);
      setEtat(t("reviewsJour.videoEnvoi"));
      const { path, url } = await televerserVideoRemarque(remarqueId, prete.blob, prete.mime);
      onChange({ videoUrl: url, videoPath: path });
      setEtat(t("reviewsJour.videoPrete", { taille: formaterOctets(prete.blob.size) }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEtat(null);
    } finally {
      setOccupe(false);
    }
  }

  async function retirer() {
    setErreur(null);
    setOccupe(true);
    try {
      if (videoPath) await supprimerVideoRemarque(videoPath);
      onChange({ videoUrl: null, videoPath: null });
      setEtat(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="space-y-1.5 rounded border border-dashed p-2">
      {videoUrl ? (
        <video
          src={videoUrl}
          className="max-h-40 w-full rounded bg-black object-contain"
          muted
          playsInline
          controls
          preload="metadata"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void deposer(f);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={disabled || occupe}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-3" />
          {videoUrl ? t("reviewsJour.videoRemplacer") : t("reviewsJour.videoAjouter")}
        </Button>
        {videoUrl && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            disabled={disabled || occupe}
            onClick={() => void retirer()}
          >
            <Trash2 className="size-3" />
            {t("common.delete")}
          </Button>
        )}
      </div>
      {etat && <p className="text-[11px] text-muted-foreground">{etat}</p>}
      {erreur && <p className="text-[11px] text-destructive">{erreur}</p>}
      <p className="text-[11px] text-muted-foreground">{t("reviewsJour.videoAide")}</p>
    </div>
  );
}
