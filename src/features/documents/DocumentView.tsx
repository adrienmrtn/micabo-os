import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { richTextClass } from "@/components/ui/RichTextEditor";
import { lireDocument } from "@/features/moteur/api";

/** Le contenu vient d'un éditeur riche interne (admin), il peut donc contenir du
 *  HTML de mise en forme ; sinon (ancien texte simple) on préserve les sauts. */
function estHtml(contenu: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(contenu);
}

/**
 * Affiche un document (guide, FAQ) en lecture seule pour un manager ou un poster.
 * Le contenu est du texte simple : on préserve les sauts de ligne. L'admin l'édite
 * depuis la page Documents.
 */
export function DocumentView({ cle }: { cle: string }) {
  const { t } = useTranslation();
  const doc = useQuery({ queryKey: ["document", cle], queryFn: () => lireDocument(cle) });

  if (doc.isPending) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!doc.data) {
    return <p className="text-sm text-muted-foreground">{t("common.empty")}</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{doc.data.titre}</CardTitle>
      </CardHeader>
      <CardContent>
        {estHtml(doc.data.contenu) ? (
          <div
            className={richTextClass}
            // Contenu rédigé par l'admin via l'éditeur interne (pas d'entrée tierce).
            dangerouslySetInnerHTML={{ __html: doc.data.contenu }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{doc.data.contenu}</div>
        )}
      </CardContent>
    </Card>
  );
}
