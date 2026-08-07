import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarreChargement } from "@/components/ui/progress";
import { LANGUES_CIBLES, nomLangue } from "@/features/moteur/langues";
import {
  brulerTexteTestStream,
  listerContenus,
  type BurnTexteEvent,
} from "@/features/moteur/api";
import {
  assurerPoliceTikTok,
  brulerTexteSurImage,
  calculerTaillesSlideshow,
  type SlideBurnInput,
  type ZoneBurn,
} from "@/features/moteur/brulerTexteCanvas";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type PreviewSlide = {
  position: number;
  propreUrl: string;
  brutUrl: string;
  texteTraduit: string;
  previewUrl?: string;
  detail?: string;
  statut: "attente" | "encours" | "ok" | "saute" | "echec";
};

function zonesDepuisEvent(
  zones: NonNullable<BurnTexteEvent["zones"]>,
): ZoneBurn[] {
  return zones.map((z) => ({
    x: Number(z.x),
    y: Number(z.y),
    w: Number(z.w),
    h: Number(z.h),
    couleur: String(z.couleur ?? "#FFFFFF"),
    // Contour seulement si explicitement true (pas de défaut true)
    ombre: z.ombre === true,
    nbLignes: z.nbLignes != null ? Number(z.nbLignes) : undefined,
    role: z.role === "titre" || z.role === "corps" ? z.role : undefined,
    texte: String(z.texte ?? ""),
  }));
}

/**
 * Test admin : burn texte traduit sur images propres (Canvas).
 * Analyse boxes+couleur sur le brut. Aucune sauvegarde.
 * Taille de police unifiée sur tout le slideshow (titre vs corps).
 */
export function TestBrulerTexteCard() {
  const { t } = useTranslation();
  const [langue, setLangue] = React.useState("en");
  const [contenuId, setContenuId] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);
  const [logs, setLogs] = React.useState<string[]>([]);
  const [previews, setPreviews] = React.useState<PreviewSlide[]>([]);
  const [erreur, setErreur] = React.useState<string | null>(null);

  const slideshows = useQuery({
    queryKey: ["slideshows-bruler-test"],
    queryFn: () => listerContenus({ statut: "valide", limit: 80 }),
    staleTime: 30_000,
  });

  React.useEffect(() => {
    void assurerPoliceTikTok();
  }, []);

  async function lancer() {
    if (!contenuId || enCours) return;
    setEnCours(true);
    setErreur(null);
    setLogs([]);
    setPreviews([]);
    const push = (l: string) =>
      setLogs((prev) => [...prev.slice(-60), l]);

    const aBurner: SlideBurnInput[] = [];

    try {
      push(t("tests.brulerDebut", { langue: nomLangue(langue) }));
      await brulerTexteTestStream(
        { contenuId, langue },
        async (ev: BurnTexteEvent) => {
          if (ev.etape === "deck" || ev.etape === "slide") {
            if (ev.detail) {
              push(
                `#${ev.position ?? "—"} · ${ev.statut ?? ""} · ${ev.detail}`,
              );
            }
          }
          if (ev.etape === "analyse" && ev.detail) {
            push(`#${ev.position} analyse · ${ev.detail}`);
          }
          if (ev.etape === "payload" && ev.propreUrl && ev.zones) {
            const pos = Number(ev.position);
            const zones = zonesDepuisEvent(ev.zones);
            aBurner.push({
              position: pos,
              propreUrl: ev.propreUrl,
              zones,
            });
            setPreviews((prev) => {
              const next = prev.filter((p) => p.position !== pos);
              next.push({
                position: pos,
                propreUrl: ev.propreUrl!,
                brutUrl: ev.brutUrl ?? "",
                texteTraduit: ev.texteTraduit ?? "",
                statut: "attente",
                detail: "en file (taille unifiée)…",
              });
              return next.sort((a, b) => a.position - b.position);
            });
          }
          if (ev.etape === "ready") {
            push(ev.detail ?? `ready · ${ev.statut}`);
          }
        },
      );

      if (aBurner.length === 0) {
        push("aucun slide à brûler");
        return;
      }

      push(`calcul taille unifiée sur ${aBurner.length} slide(s)…`);
      setPreviews((prev) =>
        prev.map((p) => ({ ...p, statut: "encours", detail: "taille…" })),
      );
      const tailles = await calculerTaillesSlideshow(aBurner);
      push(`taille corps=${tailles.corps}px · titre=${tailles.titre}px`);

      for (const slide of aBurner) {
        setPreviews((prev) =>
          prev.map((p) =>
            p.position === slide.position
              ? { ...p, statut: "encours", detail: "burn Canvas…" }
              : p,
          ),
        );
        try {
          const url = await brulerTexteSurImage(slide.propreUrl, slide.zones, {
            tailleCorps: tailles.corps,
            tailleTitre: tailles.titre,
          });
          setPreviews((prev) =>
            prev.map((p) =>
              p.position === slide.position
                ? {
                    ...p,
                    previewUrl: url,
                    statut: "ok",
                    detail: `corps ${tailles.corps}px`,
                  }
                : p,
            ),
          );
          push(`#${slide.position} burn OK`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setPreviews((prev) =>
            prev.map((p) =>
              p.position === slide.position
                ? { ...p, statut: "echec", detail: msg }
                : p,
            ),
          );
          push(`#${slide.position} burn échec · ${msg}`);
        }
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="size-4 text-primary" />
          {t("tests.brulerTitre")}
        </CardTitle>
        <CardDescription>{t("tests.brulerDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brulerLangue">{t("tests.langue")}</Label>
            <select
              id="brulerLangue"
              className={selectClass}
              value={langue}
              disabled={enCours}
              onChange={(e) => setLangue(e.target.value)}
            >
              {LANGUES_CIBLES.map((l) => (
                <option key={l} value={l}>
                  {nomLangue(l)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brulerSlide">{t("tests.brulerSlideshow")}</Label>
            <select
              id="brulerSlide"
              className={selectClass}
              value={contenuId}
              disabled={enCours || slideshows.isLoading}
              onChange={(e) => setContenuId(e.target.value)}
            >
              <option value="">{t("tests.brulerChoisir")}</option>
              {(slideshows.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.titre ?? c.id).slice(0, 70)}
                  {c.langue_source ? ` · ${c.langue_source}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          disabled={enCours || !contenuId}
          onClick={() => void lancer()}
        >
          <Type className="size-4" />
          {enCours ? t("tests.enCours") : t("tests.brulerLancer")}
        </Button>

        <BarreChargement
          actif={enCours}
          dureeMs={12_000}
          label={t("tests.enCours")}
        />

        {erreur && <p className="text-sm text-destructive">{erreur}</p>}

        {logs.length > 0 && (
          <div className="max-h-40 space-y-0.5 overflow-y-auto rounded border bg-muted/30 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {logs.map((l, i) => (
              <div key={`${i}-${l.slice(0, 12)}`}>{l}</div>
            ))}
          </div>
        )}

        {previews.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {previews.map((p) => (
              <figure
                key={p.position}
                className="overflow-hidden rounded-lg border"
              >
                {p.previewUrl ? (
                  <img
                    src={p.previewUrl}
                    alt={`slide ${p.position}`}
                    className="aspect-[9/16] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[9/16] items-center justify-center bg-muted text-xs text-muted-foreground">
                    #{p.position} · {p.statut}
                  </div>
                )}
                <figcaption className="space-y-0.5 p-2 text-[11px]">
                  <p className="font-medium">
                    {t("tests.brulerSlideN", { n: p.position })} · {p.statut}
                  </p>
                  {p.texteTraduit && (
                    <p className="line-clamp-2 text-muted-foreground">
                      {p.texteTraduit}
                    </p>
                  )}
                  {p.detail && (
                    <p className="text-muted-foreground">{p.detail}</p>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
