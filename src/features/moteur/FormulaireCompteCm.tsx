import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ajouterCompteCm,
  lireIdentifiantsCm,
  majIdentifiantsCm,
} from "@/features/moteur/api";
import { languesDisponiblesPourCm } from "@/features/moteur/comptesCm";
import { nomLangue } from "@/features/moteur/langues";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function FormulaireCompteCm({
  posterId,
  languesProposees,
  languesPrises,
  onCree,
}: {
  posterId: string;
  languesProposees: string[];
  languesPrises: string[];
  onCree?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const libres = languesDisponiblesPourCm(languesProposees, languesPrises);
  const [ouvert, setOuvert] = React.useState(false);
  const [langue, setLangue] = React.useState(libres[0] ?? "");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [deuxFa, setDeuxFa] = React.useState("");
  const [handle, setHandle] = React.useState("");

  React.useEffect(() => {
    if (langue && libres.includes(langue)) return;
    setLangue(libres[0] ?? "");
  }, [libres, langue]);

  const creer = useMutation({
    mutationFn: () =>
      ajouterCompteCm({
        posterId,
        langue,
        tiktok_email: email,
        tiktok_password: password,
        tiktok_2fa_note: deuxFa,
        handle_tiktok: handle,
      }),
    onSuccess: () => {
      setEmail("");
      setPassword("");
      setDeuxFa("");
      setHandle("");
      setOuvert(false);
      void queryClient.invalidateQueries({ queryKey: ["comptes"] });
      void queryClient.invalidateQueries({ queryKey: ["posters"] });
      onCree?.();
    },
  });

  if (libres.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("cm.toutesLanguesPrises")}</p>;
  }

  if (!ouvert) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOuvert(true)}>
        {t("cm.ajouter")}
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-md border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        creer.mutate();
      }}
    >
      <p className="text-sm font-medium">{t("cm.ajouter")}</p>
      <p className="text-xs text-muted-foreground">{t("cm.ajouterAide")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`cm-langue-${posterId}`}>{t("cm.langue")}</Label>
          <select
            id={`cm-langue-${posterId}`}
            className={selectClass}
            value={langue}
            onChange={(e) => setLangue(e.target.value)}
            required
          >
            {libres.map((l) => (
              <option key={l} value={l}>
                {nomLangue(l)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`cm-handle-${posterId}`}>{t("comptes.pseudo")}</Label>
          <Input
            id={`cm-handle-${posterId}`}
            value={handle}
            placeholder="pseudo.tiktok"
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`cm-email-${posterId}`}>{t("cm.email")}</Label>
          <Input
            id={`cm-email-${posterId}`}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`cm-pass-${posterId}`}>{t("cm.password")}</Label>
          <Input
            id={`cm-pass-${posterId}`}
            type="text"
            required
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`cm-2fa-${posterId}`}>{t("cm.deuxFa")}</Label>
          <Input
            id={`cm-2fa-${posterId}`}
            value={deuxFa}
            placeholder={t("cm.deuxFaPh")}
            onChange={(e) => setDeuxFa(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={creer.isPending || !langue}>
          {creer.isPending ? t("common.saving") : t("cm.creer")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOuvert(false)}>
          {t("common.cancel")}
        </Button>
      </div>
      {creer.isError && (
        <p className="text-xs text-destructive">
          {(creer.error as Error).message === "CM_LANGUE_PRISE"
            ? t("cm.languePrise")
            : (creer.error as Error).message}
        </p>
      )}
    </form>
  );
}

export function IdentifiantsCm({
  compteId,
  editable,
}: {
  compteId: string;
  editable: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["identifiants-cm", compteId],
    queryFn: () => lireIdentifiantsCm(compteId),
  });
  const [edit, setEdit] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [deuxFa, setDeuxFa] = React.useState("");

  const copier = (texte: string) => void navigator.clipboard?.writeText(texte);

  const maj = useMutation({
    mutationFn: () =>
      majIdentifiantsCm({
        compteId,
        tiktok_email: email,
        tiktok_password: password,
        tiktok_2fa_note: deuxFa,
      }),
    onSuccess: () => {
      setEdit(false);
      void queryClient.invalidateQueries({ queryKey: ["identifiants-cm", compteId] });
    },
  });

  if (q.isPending) {
    return <p className="text-xs text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!q.data) {
    return <p className="text-xs text-destructive">{t("cm.identifiantsAbsents")}</p>;
  }

  if (edit && editable) {
    return (
      <form
        className="space-y-2 rounded-md border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          maj.mutate();
        }}
      >
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {t("cm.identifiants")}
        </Label>
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="text"
          required
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input value={deuxFa} onChange={(e) => setDeuxFa(e.target.value)} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={maj.isPending}>
            {t("common.save")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEdit(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    );
  }

  const d = q.data;
  return (
    <div className="space-y-1.5 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("cm.identifiants")}
        </p>
        {editable && (
          <button
            type="button"
            className="text-xs text-primary underline underline-offset-2"
            onClick={() => {
              setEmail(d.tiktok_email);
              setPassword(d.tiktok_password);
              setDeuxFa(d.tiktok_2fa_note ?? "");
              setEdit(true);
            }}
          >
            {t("common.edit")}
          </button>
        )}
      </div>
      <LigneSecret label={t("cm.email")} valeur={d.tiktok_email} onCopy={() => copier(d.tiktok_email)} />
      <LigneSecret
        label={t("cm.password")}
        valeur={d.tiktok_password}
        onCopy={() => copier(d.tiktok_password)}
      />
      {d.tiktok_2fa_note && (
        <LigneSecret
          label={t("cm.deuxFa")}
          valeur={d.tiktok_2fa_note}
          onCopy={() => copier(d.tiktok_2fa_note!)}
        />
      )}
    </div>
  );
}

function LigneSecret({
  label,
  valeur,
  onCopy,
}: {
  label: string;
  valeur: string;
  onCopy: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <button
        type="button"
        className="min-w-0 truncate font-mono text-xs underline underline-offset-2"
        title={t("cm.copier")}
        onClick={onCopy}
      >
        {valeur}
      </button>
    </div>
  );
}
