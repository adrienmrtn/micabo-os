import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Check, ChevronRight, Clapperboard, Copy, UserRoundCog, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { drapeauLangue } from "@/features/moteur/langues";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { annulerActionUpwork, chargerUpworkDashboard, sauverAccesUpwork } from "@/features/upwork/api";
import { CONSIGNE_DEFAUT } from "@/features/upwork/savoir";
import { Repliable } from "@/features/upwork/Deroule";
import { EditeurModeles } from "@/features/upwork/EditeurModeles";
import { UPWORK_ORG_NOM } from "@/features/upwork/org";
import { nomPays } from "@/features/upwork/pipeline";
import { ICONE_KPI } from "@/features/upwork/icones";
import { totauxUpwork } from "@/features/upwork/totaux";
import type { UpworkAction } from "@/features/upwork/types";

function CompteRendu({ texte }: { texte: string }) {
  const blocs = texte
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="mt-3 max-h-[28rem] space-y-3 overflow-y-auto rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
      {blocs.map((bloc) => (
        <div key={bloc.slice(0, 48)} className="space-y-1">
          {bloc.split("\n").map((ligne) => {
            const titre = !ligne.startsWith("•") && !ligne.includes(" — ");
            return (
              <p
                key={ligne}
                className={titre ? "font-medium text-foreground" : "text-muted-foreground"}
              >
                {ligne}
              </p>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function formatQuand(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}

function Total({
  label,
  valeur,
  icone: Icone,
}: {
  label: string;
  valeur: string;
  icone: typeof ICONE_KPI.hm;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <Icone className="mb-2 size-4 text-muted-foreground" aria-hidden />
      <p className="font-semibold text-2xl tabular-nums">{valeur}</p>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

function CarteAction({
  action,
  locale,
  onAnnuler,
  bloque,
}: {
  action: UpworkAction;
  locale: string;
  onAnnuler: (id: string) => void;
  bloque: boolean;
}) {
  const { t } = useTranslation();
  const [copie, setCopie] = React.useState(false);

  const copier = async () => {
    await navigator.clipboard.writeText(action.prompt);
    setCopie(true);
    window.setTimeout(() => setCopie(false), 1500);
  };

  return (
    <div className="rounded-lg border bg-background p-3">
      <Repliable
        entete={
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{action.cible_nom}</span>
            <Badge variant="warning" size="sm">
              {t(`upwork.action.${action.type}`)}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {t("upwork.actionDepuis", { date: formatQuand(action.demande_at, locale) })}
            </span>
          </span>
        }
      >
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
          {action.prompt}
        </pre>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="xs" onClick={copier}>
            {copie ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copie ? t("upwork.actionCopie") : t("upwork.actionCopier")}
          </Button>
          <Button variant="ghost" size="xs" disabled={bloque} onClick={() => onAnnuler(action.id)}>
            {t("upwork.actionAnnuler")}
          </Button>
        </div>
      </Repliable>
    </div>
  );
}

function ChampSlack({
  initial,
  osUrl,
}: {
  initial: string;
  osUrl: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [lien, setLien] = React.useState(initial);

  React.useEffect(() => {
    setLien(initial);
  }, [initial]);

  const sauver = useMutation({
    mutationFn: () =>
      sauverAccesUpwork({ slack_invite_manager: lien.trim(), os_url: osUrl }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["upwork-dashboard"] }),
  });

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-1 font-medium text-sm">{t("upwork.slackInviteTitre")}</p>
      <p className="mb-3 text-muted-foreground text-xs">{t("upwork.slackInviteAide")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          value={lien}
          onChange={(e) => setLien(e.target.value)}
          placeholder={t("upwork.slackInvitePh")}
          className="max-w-xl"
          aria-label={t("upwork.slackInviteTitre")}
        />
        <Button
          size="sm"
          disabled={sauver.isPending || lien.trim() === initial.trim()}
          onClick={() => sauver.mutate()}
        >
          {sauver.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

function ChampConsigne({ initial }: { initial: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [texte, setTexte] = React.useState(initial || CONSIGNE_DEFAUT);

  React.useEffect(() => {
    setTexte(initial || CONSIGNE_DEFAUT);
  }, [initial]);

  const sauver = useMutation({
    mutationFn: () => sauverAccesUpwork({ consigne: texte.trim() || CONSIGNE_DEFAUT }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["upwork-dashboard"] }),
  });

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-1 font-medium text-sm">{t("upwork.consigneTitre")}</p>
      <p className="mb-3 text-muted-foreground text-xs">
        {t("upwork.consigneAide")}{" "}
        <Link to="/admin/documents" className="underline underline-offset-2">
          {t("upwork.consigneDocs")}
        </Link>
      </p>
      <Textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={4}
        placeholder={t("upwork.consignePh")}
        className="text-sm leading-relaxed"
        aria-label={t("upwork.consigneTitre")}
      />
      <div className="mt-2">
        <Button
          size="sm"
          disabled={sauver.isPending || texte.trim() === (initial || CONSIGNE_DEFAUT).trim()}
          onClick={() => sauver.mutate()}
        >
          {sauver.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

export function AdminUpworkPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const dash = useQuery({
    queryKey: ["upwork-dashboard"],
    queryFn: chargerUpworkDashboard,
  });

  const annuler = useMutation({
    mutationFn: (id: string) => annulerActionUpwork(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["upwork-dashboard"] }),
  });

  const d = dash.data;
  const totaux = d ? totauxUpwork(d.missions, d.contrats) : null;
  const enAttente = (d?.actions ?? []).filter((a) => a.statut === "en_attente");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-lg tracking-tight">{t("upwork.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("upwork.subtitle", { org: UPWORK_ORG_NOM })}
        </p>
      </div>

      {dash.isPending && <p className="text-muted-foreground text-sm">{t("common.loading")}</p>}
      {dash.isError && (
        <p className="text-destructive text-sm">
          {(dash.error as Error).message || t("common.error")}
        </p>
      )}

      {d && totaux && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-card p-4 md:col-span-2">
              <p className="mb-2 font-medium text-sm">{t("upwork.syncTitre")}</p>
              <p className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                {d.sync && (
                  <Badge variant={d.sync.last_ok ? "success" : "destructive"} size="sm">
                    {d.sync.last_ok ? t("upwork.syncOk") : t("upwork.syncKo")}
                  </Badge>
                )}
                <span>
                  {d.sync?.last_run_at
                    ? t("upwork.syncQuand", {
                        date: formatQuand(d.sync.last_run_at, i18n.language),
                      })
                    : t("upwork.syncJamais")}
                </span>
              </p>
              {d.sync?.last_detail && <CompteRendu texte={d.sync.last_detail} />}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="mb-2 flex flex-wrap items-center gap-2 font-medium text-sm">
                {t("upwork.promptsTitre")}
                {enAttente.length > 0 && (
                  <Badge variant="warning" size="sm">
                    {enAttente.length}
                  </Badge>
                )}
              </p>
              {enAttente.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("upwork.promptsVide")}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs">{t("upwork.promptsAide")}</p>
                  {enAttente.map((a) => (
                    <CarteAction
                      key={a.id}
                      action={a}
                      locale={i18n.language}
                      bloque={annuler.isPending}
                      onAnnuler={(id) => annuler.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Total icone={ICONE_KPI.hm} label={t("upwork.kpiHm")} valeur={String(totaux.hms)} />
            <Total
              icone={ICONE_KPI.createurs}
              label={t("upwork.kpiCreateurs")}
              valeur={String(totaux.createurs)}
            />
            <Total
              icone={ICONE_KPI.jobHm}
              label={t("upwork.kpiJobHmOuverts")}
              valeur={String(totaux.jobsHmOuverts)}
            />
            <Total
              icone={ICONE_KPI.jobCrea}
              label={t("upwork.kpiJobCreaOuverts")}
              valeur={String(totaux.jobsCreateursOuverts)}
            />
          </div>

          <ChampSlack
            initial={d.acces.slack_invite_manager}
            osUrl={d.acces.os_url}
          />

          <ChampConsigne initial={d.acces.consigne} />

          <EditeurModeles modeles={d.modeles} />

          {totaux.parPays.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("upwork.vide")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {totaux.parPays.map((pays) => (
                <Link key={pays.langue} to={`/admin/upwork/${pays.langue}`}>
                  <Card className="h-full transition-colors hover:bg-accent/40">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span aria-hidden>{pays.langue ? drapeauLangue(pays.langue) : "—"}</span>
                        {nomPays(pays.langue || null, i18n.language)}
                      </CardTitle>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <p className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <UserRoundCog className="size-3.5" aria-hidden />
                          {pays.hms}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" aria-hidden />
                          {pays.createurs}
                        </span>
                      </p>
                      <p className="flex flex-wrap items-center gap-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="size-3.5" aria-hidden />
                          {pays.jobsHmOuverts}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clapperboard className="size-3.5" aria-hidden />
                          {pays.jobsCreateursOuverts}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
