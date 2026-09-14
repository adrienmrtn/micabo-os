import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  creerFormat,
  listerBlocsPng,
  listerFormats,
  majFormat,
  supprimerBlocPng,
  supprimerFormat,
  televerserBlocPng,
} from "@/features/moteur/fileValidationApi";

/**
 * Deux réglages qui servent la file de validation : la liste des formats
 * éditoriaux, et la bibliothèque de calques PNG.
 *
 * Les formats sont **descriptifs** : ils ne changent rien à l'assignation, ils
 * servent à croiser label × format dans les statistiques.
 */
export function ReglagesFormats() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const formats = useQuery({ queryKey: ["formats"], queryFn: () => listerFormats() });
  const [nom, setNom] = React.useState("");
  const [couleur, setCouleur] = React.useState("#2f6f4e");

  const rafraichir = () => void qc.invalidateQueries({ queryKey: ["formats"] });

  const creer = useMutation({
    mutationFn: () => creerFormat({ nom, couleur }),
    onSuccess: () => {
      setNom("");
      rafraichir();
    },
  });
  const basculer = useMutation({
    mutationFn: (f: { id: string; actif: boolean }) => majFormat(f.id, { actif: !f.actif }),
    onSuccess: rafraichir,
  });
  const retirer = useMutation({
    mutationFn: (id: string) => supprimerFormat(id),
    onSuccess: rafraichir,
  });

  return (
    <Card id="formats">
      <CardHeader>
        <CardTitle>{t("formats.titre")}</CardTitle>
        <CardDescription>{t("formats.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (nom.trim()) creer.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="format-nom">{t("formats.nom")}</Label>
            <Input
              id="format-nom"
              value={nom}
              placeholder={t("formats.nomPh")}
              onChange={(e) => setNom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="format-couleur">{t("formats.couleur")}</Label>
            <input
              id="format-couleur"
              type="color"
              value={couleur}
              onChange={(e) => setCouleur(e.target.value)}
              className="h-9 w-14 rounded-md border border-input bg-background px-1"
            />
          </div>
          <Button type="submit" disabled={creer.isPending || !nom.trim()}>
            {creer.isPending ? t("common.saving") : t("formats.creer")}
          </Button>
        </form>
        {creer.isError && (
          <p className="text-xs text-destructive">{(creer.error as Error).message}</p>
        )}

        {formats.isPending && (
          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
        )}
        {!formats.isPending && (formats.data ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">{t("formats.vide")}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {(formats.data ?? []).map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-1.5 rounded border border-border/80 px-2 py-1 text-xs"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: f.couleur ?? "#888" }}
              />
              <span className="font-medium">{f.nom}</span>
              {!f.actif && <Badge variant="secondary">{t("formats.inactif")}</Badge>}
              <button
                type="button"
                disabled={basculer.isPending}
                onClick={() => basculer.mutate({ id: f.id, actif: f.actif })}
                className="text-[10px] text-primary underline-offset-2 hover:underline"
              >
                {f.actif ? t("formats.desactiver") : t("formats.reactiver")}
              </button>
              <button
                type="button"
                aria-label={t("common.delete")}
                disabled={retirer.isPending}
                onClick={() => {
                  if (window.confirm(t("formats.confirmSuppr", { nom: f.nom }))) {
                    retirer.mutate(f.id);
                  }
                }}
                className="text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("formats.aide")}</p>
      </CardContent>
    </Card>
  );
}

export function ReglagesBlocsPng() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const blocs = useQuery({ queryKey: ["blocs-png"], queryFn: listerBlocsPng });
  const [nom, setNom] = React.useState("");
  const [fichier, setFichier] = React.useState<File | null>(null);
  const champ = React.useRef<HTMLInputElement>(null);

  const rafraichir = () => void qc.invalidateQueries({ queryKey: ["blocs-png"] });

  const envoyer = useMutation({
    mutationFn: async () => {
      if (!fichier) throw new Error(t("blocs.fichierRequis"));
      // Les dimensions natives servent l'aperçu et le ratio à la pose.
      const dims = await new Promise<{ largeur: number; hauteur: number } | null>((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(fichier);
        img.onload = () => {
          resolve({ largeur: img.naturalWidth, hauteur: img.naturalHeight });
          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          resolve(null);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      });
      return televerserBlocPng({
        nom,
        fichier,
        largeur: dims?.largeur ?? null,
        hauteur: dims?.hauteur ?? null,
      });
    },
    onSuccess: () => {
      setNom("");
      setFichier(null);
      if (champ.current) champ.current.value = "";
      rafraichir();
    },
  });

  const retirer = useMutation({
    mutationFn: (b: { id: string; storage_path: string }) => supprimerBlocPng(b),
    onSuccess: rafraichir,
  });

  return (
    <Card id="blocs-png">
      <CardHeader>
        <CardTitle>{t("blocs.titre")}</CardTitle>
        <CardDescription>{t("blocs.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            envoyer.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="bloc-nom">{t("blocs.nom")}</Label>
            <Input id="bloc-nom" value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bloc-fichier">{t("blocs.fichier")}</Label>
            <input
              ref={champ}
              id="bloc-fichier"
              type="file"
              accept="image/png,image/webp"
              onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
              className="block text-xs"
            />
          </div>
          <Button type="submit" disabled={envoyer.isPending || !fichier}>
            {envoyer.isPending ? t("common.saving") : t("blocs.ajouter")}
          </Button>
        </form>
        {envoyer.isError && (
          <p className="text-xs text-destructive">{(envoyer.error as Error).message}</p>
        )}

        {blocs.isPending && <p className="text-xs text-muted-foreground">{t("common.loading")}</p>}
        {!blocs.isPending && (blocs.data ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">{t("blocs.vide")}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {(blocs.data ?? []).map((b) => (
            <div key={b.id} className="w-24 space-y-1">
              <div className="size-24 overflow-hidden rounded border bg-[repeating-conic-gradient(#e5e5e5_0%_25%,transparent_0%_50%)] bg-[length:12px_12px] p-1">
                <img src={b.url} alt={b.nom} className="size-full object-contain" />
              </div>
              <p className="truncate text-[10px]" title={b.nom}>
                {b.nom}
              </p>
              <button
                type="button"
                disabled={retirer.isPending}
                onClick={() => {
                  if (window.confirm(t("blocs.confirmSuppr", { nom: b.nom }))) retirer.mutate(b);
                }}
                className="text-[10px] text-destructive underline-offset-2 hover:underline"
              >
                {t("common.delete")}
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
