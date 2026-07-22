import * as React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FlaskConical, Link2, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assignerTikTok, listerComptes } from "@/features/moteur/api";
import { SimulerMinuitCard } from "@/features/moteur/SimulerMinuitCard";
import { TestCompletCard } from "@/features/moteur/TestCompletCard";
import { TestScrapeCard } from "@/features/moteur/TestScrapeCard";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Tester UN TikTok précis, de bout en bout, sans l'assigner à personne :
 * import → nettoyage → Sophia → un post « test » (invisible sur les calendriers)
 * qu'on ouvre pour le QR et le téléchargement.
 */
function TesterUnTikTok() {
  const { t } = useTranslation();
  const comptes = useQuery({ queryKey: ["comptes"], queryFn: listerComptes });

  const [lien, setLien] = React.useState("");
  const [compteId, setCompteId] = React.useState("");

  const tester = useMutation({
    mutationFn: () => assignerTikTok({ url: lien, compteId, estTest: true }),
    onSuccess: () => setLien(""),
  });

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-4 text-primary" />
          {t("tests.tiktokTitre")}
        </CardTitle>
        <CardDescription>{t("tests.tiktokDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tLien">{t("posts.lienTikTok")}</Label>
          <Input
            id="tLien"
            placeholder="https://www.tiktok.com/@compte/photo/…"
            value={lien}
            onChange={(e) => setLien(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tCompte">{t("tests.langueVia")}</Label>
          <select
            id="tCompte"
            className={selectClass}
            value={compteId}
            onChange={(e) => setCompteId(e.target.value)}
          >
            <option value="">{t("common.none")}</option>
            {comptes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.persona_nom ?? c.handle_tiktok ?? c.id.slice(0, 8)} · {c.langue.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <Button
          disabled={tester.isPending || !lien.trim() || !compteId}
          onClick={() => tester.mutate()}
        >
          <Sparkles className="size-4" />
          {tester.isPending ? t("tests.enCours") : t("tests.tiktokLancer")}
        </Button>

        {tester.isError && (
          <p className="text-sm text-destructive">{(tester.error as Error).message}</p>
        )}
        {tester.isSuccess && tester.data?.postId && (
          <p className="text-sm text-success">
            {t("tests.tiktokOk")}{" "}
            <Link
              to={`/posts/${tester.data.postId}`}
              className="font-medium underline underline-offset-2"
            >
              {t("posts.voirLePost")}
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Le test nettoyage vit sur sa propre page : ici juste un raccourci. */
function TestNettoyageCard() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
        <div className="flex items-center gap-2">
          <Wand2 className="size-4 text-primary" />
          <div>
            <p className="text-sm font-medium">{t("tests.nettoyageTitre")}</p>
            <p className="text-xs text-muted-foreground">{t("tests.nettoyageDesc")}</p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/test-nettoyage">{t("tests.nettoyageBouton")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// Catalogue des tests : on choisit d'abord ici (chacun est expliqué), puis le
// test choisi s'affiche seul en dessous — plus de mur de cartes empilées.
const TESTS = [
  { value: "minuit", titreKey: "simMinuit.title", descKey: "simMinuit.subtitle", render: () => <SimulerMinuitCard /> },
  { value: "tiktok", titreKey: "tests.tiktokTitre", descKey: "tests.tiktokDesc", render: () => <TesterUnTikTok /> },
  { value: "complet", titreKey: "tests.completTitre", descKey: "tests.completDesc", render: () => <TestCompletCard /> },
  { value: "scrape", titreKey: "tests.scrapeTitre", descKey: "tests.scrapeDesc", render: () => <TestScrapeCard /> },
  { value: "nettoyage", titreKey: "tests.nettoyageTitre", descKey: "tests.nettoyageDesc", render: () => <TestNettoyageCard /> },
] as const;

export function AdminTestsPage() {
  const { t } = useTranslation();
  const [choix, setChoix] = React.useState<string>("");
  const actif = TESTS.find((x) => x.value === choix);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" />
            {t("tests.title")}
          </CardTitle>
          <CardDescription>{t("tests.choisir")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            aria-label={t("tests.choisir")}
            className={selectClass}
            value={choix}
            onChange={(e) => setChoix(e.target.value)}
          >
            <option value="">{t("tests.choisirPlaceholder")}</option>
            {TESTS.map((x) => (
              <option key={x.value} value={x.value}>
                {t(x.titreKey)}
              </option>
            ))}
          </select>
          {actif && <p className="text-sm text-muted-foreground">{t(actif.descKey)}</p>}
        </CardContent>
      </Card>

      {actif ? actif.render() : null}
    </div>
  );
}
