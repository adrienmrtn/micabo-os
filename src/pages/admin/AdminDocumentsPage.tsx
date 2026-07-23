import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listerDocuments, majDocument } from "@/features/moteur/api";
import type { DocumentEditable } from "@/features/moteur/api";

function EditeurDocument({ doc }: { doc: DocumentEditable }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Deux versions par document : FR (défaut) et EN. Le lecteur voit celle qui
  // correspond à la langue de son interface (repli sur le FR si l'EN est vide).
  const [langue, setLangue] = React.useState<"fr" | "en">("fr");
  const [titre, setTitre] = React.useState(doc.titre);
  const [contenu, setContenu] = React.useState(doc.contenu);
  const [titreEn, setTitreEn] = React.useState(doc.titre_en ?? "");
  const [contenuEn, setContenuEn] = React.useState(doc.contenu_en ?? "");

  const modifie =
    titre !== doc.titre ||
    contenu !== doc.contenu ||
    titreEn !== (doc.titre_en ?? "") ||
    contenuEn !== (doc.contenu_en ?? "");

  const enregistrer = useMutation({
    mutationFn: () =>
      majDocument(doc.id, {
        titre,
        contenu,
        titre_en: titreEn.trim() || null,
        contenu_en: contenuEn.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document", doc.cle] });
    },
  });

  const audienceLabel =
    doc.audience === "manager"
      ? t("documents.pourManagers")
      : doc.audience === "poster"
        ? t("documents.pourCreateurs")
        : t("documents.pourTous");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{doc.titre}</CardTitle>
          <Badge variant="secondary">{audienceLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={langue === "fr" ? "default" : "outline"}
            onClick={() => setLangue("fr")}
          >
            🇫🇷 Français
          </Button>
          <Button
            size="sm"
            variant={langue === "en" ? "default" : "outline"}
            onClick={() => setLangue("en")}
          >
            🇬🇧 English
          </Button>
          <span className="pl-2 text-xs text-muted-foreground">{t("documents.versionAide")}</span>
        </div>

        {langue === "fr" ? (
          <>
            <Input value={titre} onChange={(e) => setTitre(e.target.value)} />
            {/* key : l'éditeur pose son contenu au montage — on le remonte au
                changement de langue pour afficher la bonne version. */}
            <RichTextEditor key="fr" value={contenu} onChange={setContenu} />
          </>
        ) : (
          <>
            <Input
              value={titreEn}
              placeholder={t("documents.titreEnPlaceholder")}
              onChange={(e) => setTitreEn(e.target.value)}
            />
            <RichTextEditor key="en" value={contenuEn} onChange={setContenuEn} />
          </>
        )}
        <div className="flex items-center gap-3">
          <Button disabled={!modifie || enregistrer.isPending} onClick={() => enregistrer.mutate()}>
            {enregistrer.isPending ? t("common.saving") : t("common.save")}
          </Button>
          {enregistrer.isSuccess && !modifie && (
            <span className="text-sm text-success">{t("prompts.saved")}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminDocumentsPage() {
  const { t } = useTranslation();
  const docs = useQuery({ queryKey: ["documents"], queryFn: listerDocuments });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("documents.title")}</CardTitle>
          <CardDescription>{t("documents.subtitle")}</CardDescription>
        </CardHeader>
      </Card>

      {docs.isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {docs.data?.map((doc) => <EditeurDocument key={doc.id} doc={doc} />)}
    </div>
  );
}
