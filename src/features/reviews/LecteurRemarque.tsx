import * as React from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Au-delà, on considère que la vidéo ne partira pas et on débloque la suite. */
const ATTENTE_MAX_MS = 8000;

/**
 * Lecteur d'une vidéo d'explication.
 *
 * Muet et `playsInline` : c'est la seule combinaison qu'iOS accepte de lancer
 * sans geste de l'utilisateur, et le retour est muet par choix. Pas de boucle —
 * la fin de la lecture est le signal qui débloque « Suivant », une lecture sans
 * fin ne dirait jamais que c'est vu.
 *
 * `onVue` part aussi quand la vidéo casse ou ne démarre pas : un créateur ne
 * doit pas se retrouver coincé devant un cadre noir parce que le réseau a
 * lâché. Mieux vaut un retour lu trop vite qu'un poster bloqué.
 */
export function LecteurRemarque({
  url,
  onVue,
}: {
  url: string;
  onVue: () => void;
}) {
  const { t } = useTranslation();
  const ref = React.useRef<HTMLVideoElement>(null);
  const [erreur, setErreur] = React.useState(false);
  const [rejouable, setRejouable] = React.useState(false);

  // Filet : autoplay refusé, fichier qui ne charge pas, onglet en arrière-plan.
  React.useEffect(() => {
    setErreur(false);
    setRejouable(false);
    const minuteur = window.setTimeout(() => {
      const v = ref.current;
      if (!v || v.currentTime === 0) onVue();
    }, ATTENTE_MAX_MS);
    return () => window.clearTimeout(minuteur);
  }, [url, onVue]);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border bg-black">
        <video
          ref={ref}
          src={url}
          className="max-h-[46vh] w-full object-contain"
          autoPlay
          muted
          playsInline
          controls
          preload="auto"
          onEnded={() => {
            setRejouable(true);
            onVue();
          }}
          onError={() => {
            setErreur(true);
            onVue();
          }}
        />
      </div>
      {erreur ? (
        <p className="text-xs text-destructive">{t("reviews.videoErreur")}</p>
      ) : rejouable ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => {
            const v = ref.current;
            if (!v) return;
            v.currentTime = 0;
            void v.play();
          }}
        >
          <RotateCcw className="size-3.5" />
          {t("reviews.videoRejouer")}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">{t("reviews.videoMuette")}</p>
      )}
    </div>
  );
}
