import * as React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link2, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assignerTikTok, listerComptes } from "@/features/moteur/api";
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

export function AdminTestsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("tests.title")}</CardTitle>
          <CardDescription>{t("tests.subtitle")}</CardDescription>
        </CardHeader>
      </Card>

      <TesterUnTikTok />
      <TestCompletCard />
      <TestScrapeCard />

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
    </div>
  );
}
