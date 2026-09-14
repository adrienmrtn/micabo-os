import * as React from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownToLine, ArrowUpToLine, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  auDernierPlan,
  auPremierPlan,
  borner,
  calqueParDefaut,
  type CalquePng,
} from "@/features/moteur/fileValidation";
import type { BlocPng } from "@/features/moteur/types";
import { cn } from "@/lib/utils";

/**
 * Montage d'une slide : l'image propre, plus des calques PNG de la
 * bibliothèque qu'on déplace et redimensionne à la souris.
 *
 * Tout se passe dans le navigateur — l'Edge n'a ni Pillow ni OpenCV, et le
 * lambda de burn est un moteur à part, qu'on ne détourne pas pour ça. L'aplat
 * final part en JPEG par-dessus l'image propre existante.
 *
 * Les coordonnées sont des FRACTIONS de l'image, pas des pixels : l'aperçu
 * s'affiche à la taille de l'écran, l'aplat se fait à la taille native.
 */

type Poignee = "deplacer" | "taille";

export interface EditeurSlideHandle {
  /** Aplat à la résolution native de l'image. `null` si aucun calque. */
  aplatir: (qualite?: number) => Promise<Blob | null>;
}

function chargerImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Sans ça, le canvas est « taint » et `toBlob` jette une SecurityError.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image illisible : ${url}`));
    img.src = url;
  });
}

export const EditeurSlide = React.forwardRef<
  EditeurSlideHandle,
  {
    imageUrl: string;
    calques: CalquePng[];
    onCalques: (calques: CalquePng[]) => void;
    blocs: BlocPng[];
    disabled?: boolean;
  }
>(function EditeurSlide({ imageUrl, calques, onCalques, blocs, disabled }, ref) {
  const { t } = useTranslation();
  const cadre = React.useRef<HTMLDivElement>(null);
  const [selection, setSelection] = React.useState<number | null>(null);
  const [glisse, setGlisse] = React.useState<{
    index: number;
    poignee: Poignee;
    departX: number;
    departY: number;
    calque: CalquePng;
  } | null>(null);

  const tries = React.useMemo(
    () => calques.map((c, i) => ({ c, i })).sort((a, b) => a.c.z - b.c.z),
    [calques],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      async aplatir(qualite = 0.95) {
        if (calques.length === 0) return null;
        const fond = await chargerImage(imageUrl);
        const canvas = document.createElement("canvas");
        canvas.width = fond.naturalWidth;
        canvas.height = fond.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponible");
        ctx.drawImage(fond, 0, 0);

        for (const { c } of tries) {
          const png = await chargerImage(c.url);
          const largeur = c.largeur * canvas.width;
          const hauteur = png.naturalHeight
            ? (largeur * png.naturalHeight) / png.naturalWidth
            : largeur;
          ctx.drawImage(png, c.x * canvas.width, c.y * canvas.height, largeur, hauteur);
        }

        return await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/jpeg", qualite),
        );
      },
    }),
    [calques, imageUrl, tries],
  );

  React.useEffect(() => {
    if (!glisse) return;
    const bouger = (e: PointerEvent) => {
      const box = cadre.current?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) return;
      const dx = (e.clientX - glisse.departX) / box.width;
      const dy = (e.clientY - glisse.departY) / box.height;
      const suivant = [...calques];
      suivant[glisse.index] = borner(
        glisse.poignee === "deplacer"
          ? { ...glisse.calque, x: glisse.calque.x + dx, y: glisse.calque.y + dy }
          : { ...glisse.calque, largeur: glisse.calque.largeur + dx },
      );
      onCalques(suivant);
    };
    const lacher = () => setGlisse(null);
    window.addEventListener("pointermove", bouger);
    window.addEventListener("pointerup", lacher);
    return () => {
      window.removeEventListener("pointermove", bouger);
      window.removeEventListener("pointerup", lacher);
    };
  }, [glisse, calques, onCalques]);

  const commencer = (index: number, poignee: Poignee) => (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setSelection(index);
    setGlisse({
      index,
      poignee,
      departX: e.clientX,
      departY: e.clientY,
      calque: calques[index]!,
    });
  };

  const ajouter = (bloc: BlocPng) => {
    const z = calques.reduce((max, c) => Math.max(max, c.z + 1), 0);
    onCalques([...calques, calqueParDefaut(bloc, z)]);
    setSelection(calques.length);
  };

  const retirer = (index: number) => {
    onCalques(calques.filter((_, i) => i !== index).map((c, i) => ({ ...c, z: i })));
    setSelection(null);
  };

  return (
    <div className="space-y-2">
      <div
        ref={cadre}
        className="relative w-full select-none overflow-hidden rounded-md border bg-muted"
        onPointerDown={() => setSelection(null)}
      >
        <img src={imageUrl} alt="" className="block w-full" draggable={false} />
        {tries.map(({ c, i }) => (
          <div
            key={`${c.blocId}-${i}`}
            style={{
              left: `${c.x * 100}%`,
              top: `${c.y * 100}%`,
              width: `${c.largeur * 100}%`,
              zIndex: c.z + 1,
            }}
            className={cn(
              "absolute",
              !disabled && "cursor-move",
              selection === i && "outline outline-2 outline-primary",
            )}
            onPointerDown={commencer(i, "deplacer")}
          >
            <img src={c.url} alt="" className="block w-full" draggable={false} />
            {selection === i && !disabled && (
              <span
                role="presentation"
                onPointerDown={commencer(i, "taille")}
                className="absolute -bottom-1.5 -right-1.5 size-3.5 cursor-se-resize rounded-full border-2 border-background bg-primary"
              />
            )}
          </div>
        ))}
      </div>

      {selection != null && calques[selection] && !disabled && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCalques(auPremierPlan(calques, selection))}
          >
            <ArrowUpToLine className="size-3.5" />
            {t("file.calqueDevant")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCalques(auDernierPlan(calques, selection))}
          >
            <ArrowDownToLine className="size-3.5" />
            {t("file.calqueDerriere")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => retirer(selection)}
          >
            <Trash2 className="size-3.5" />
            {t("file.calqueRetirer")}
          </Button>
        </div>
      )}

      {!disabled && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("file.blocsAide")}</p>
          {blocs.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("file.blocsVide")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {blocs.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  title={b.nom}
                  onClick={() => ajouter(b)}
                  className="size-12 overflow-hidden rounded border bg-[repeating-conic-gradient(#e5e5e5_0%_25%,transparent_0%_50%)] bg-[length:12px_12px] p-0.5 transition hover:ring-2 hover:ring-primary"
                >
                  <img src={b.url} alt={b.nom} className="size-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
