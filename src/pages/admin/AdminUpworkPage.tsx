import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import { chargerUpworkDashboard } from "@/features/upwork/api";
import { UPWORK_ORG_NOM } from "@/features/upwork/org";
import { missionsFiltrees, totauxUpwork } from "@/features/upwork/totaux";
import type { FamilleMission, UpworkMission } from "@/features/upwork/types";
import { cn } from "@/lib/utils";

type FiltreFamille = FamilleMission | "toutes";

function badgeStatut(statut: string | null): "success" | "warning" | "secondary" | "destructive" {
  const s = (statut ?? "").toUpperCase();
  if (s === "PUBLISHED" || s === "ACTIVE" || s === "ACTIF") return "success";
  if (s === "FILLED") return "secondary";
  if (s === "CANCELLED" || s === "CLOSED") return "destructive";
  return "warning";
}

function Total({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums">{valeur}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function formatQuand(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}

function FiltreChip({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs",
        actif ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted/40",
      )}
    >
      {children}
    </button>
  );
}

function LigneMission({ m }: { m: UpworkMission }) {
  const { t } = useTranslation();
  return (
    <tr className="border-t">
      <td className="px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{m.titre}</span>
          <Badge variant="outline">{t(`upwork.famille.${m.famille}`)}</Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">{m.type ?? "—"}</p>
      </td>
      <td className="px-2.5 py-2">
        <Badge variant={badgeStatut(m.statut)}>{m.statut ?? "—"}</Badge>
      </td>
      <td className="px-2.5 py-2 text-right tabular-nums">{m.applicants}</td>
      <td className="px-2.5 py-2 text-right tabular-nums">{m.new_applicants}</td>
      <td className="px-2.5 py-2 text-right tabular-nums">{m.shortlisted}</td>
      <td className="px-2.5 py-2 text-right tabular-nums">{m.messaged}</td>
      <td className="px-2.5 py-2 text-right tabular-nums">{m.offered}</td>
      <td className="px-2.5 py-2 text-right tabular-nums">{m.hired}</td>
      <td className="px-2.5 py-2 text-right tabular-nums">{m.pending_invitations}</td>
      <td className="px-2.5 py-2">
        {m.job_url ? (
          <a
            href={m.job_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

export function AdminUpworkPage() {
  const { t, i18n } = useTranslation();
  const [famille, setFamille] = React.useState<FiltreFamille>("toutes");
  const [ouvertes, setOuvertes] = React.useState(true);

  const dash = useQuery({
    queryKey: ["upwork-dashboard"],
    queryFn: chargerUpworkDashboard,
  });

  const d = dash.data;
  const totaux = d ? totauxUpwork(d.missions, d.contrats, d.alertes) : null;
  const missions = d ? missionsFiltrees(d.missions, famille, ouvertes) : [];
  const alertesL2 = (d?.alertes ?? []).filter((a) => a.niveau === "l2");
  const alertesL1 = (d?.alertes ?? []).filter((a) => a.niveau === "l1");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{t("upwork.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("upwork.subtitle", { org: UPWORK_ORG_NOM })}</p>
      </div>

      {dash.isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {dash.isError && (
        <p className="text-sm text-destructive">
          {(dash.error as Error).message || t("common.error")}
        </p>
      )}

      {d && totaux && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("upwork.syncTitre")}</CardTitle>
              <CardDescription>
                {d.sync?.last_run_at
                  ? t("upwork.syncQuand", { date: formatQuand(d.sync.last_run_at, i18n.language) })
                  : t("upwork.syncJamais")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {d.sync && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={d.sync.last_ok ? "success" : "destructive"}>
                      {d.sync.last_ok ? t("upwork.syncOk") : t("upwork.syncKo")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{UPWORK_ORG_NOM}</span>
                  </div>
                  {d.sync.last_detail && (
                    <p className="text-muted-foreground">{d.sync.last_detail}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Total label={t("upwork.kpiOuvertes")} valeur={String(totaux.missionsOuvertes)} />
            <Total label={t("upwork.kpiHm")} valeur={String(totaux.missionsHmOuvertes)} />
            <Total label={t("upwork.kpiNew")} valeur={String(totaux.newApplicants)} />
            <Total label={t("upwork.kpiContrats")} valeur={String(totaux.contratsActifs)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Total label={t("upwork.kpiL2")} valeur={String(totaux.alertesL2)} />
            <Total label={t("upwork.kpiL1")} valeur={String(totaux.alertesL1)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("upwork.missionsTitre")}</CardTitle>
              <CardDescription>{t("upwork.missionsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(["toutes", "hm", "createur", "autre"] as const).map((f) => (
                  <FiltreChip key={f} actif={famille === f} onClick={() => setFamille(f)}>
                    {t(`upwork.famille.${f}`)}
                  </FiltreChip>
                ))}
                <FiltreChip actif={ouvertes} onClick={() => setOuvertes((v) => !v)}>
                  {ouvertes ? t("upwork.ouvertesOn") : t("upwork.ouvertesOff")}
                </FiltreChip>
              </div>
              {missions.length === 0 ? (
                <EmptyState title={t("upwork.vide")} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2.5 py-1.5 font-medium">{t("upwork.colTitre")}</th>
                        <th className="px-2.5 py-1.5 font-medium">{t("upwork.colStatut")}</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">{t("upwork.colAppl")}</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">{t("upwork.colNew")}</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">{t("upwork.colShort")}</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">{t("upwork.colMsg")}</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">{t("upwork.colOffre")}</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">{t("upwork.colHired")}</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">{t("upwork.colInvites")}</th>
                        <th className="px-2.5 py-1.5 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {missions.map((m) => (
                        <LigneMission key={m.id} m={m} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("upwork.contratsTitre")}</CardTitle>
              <CardDescription>{t("upwork.contratsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {d.contrats.length === 0 ? (
                <EmptyState title={t("upwork.vide")} />
              ) : (
                <div className="space-y-2">
                  {d.contrats.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{c.freelancer_nom || t("upwork.sansNom")}</p>
                        <p className="text-xs text-muted-foreground">{c.titre || "—"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={badgeStatut(c.statut)}>{c.statut ?? "—"}</Badge>
                        {c.profile_id ? (
                          <Badge variant="outline">{t("upwork.lieOs")}</Badge>
                        ) : (
                          <Badge variant="warning">{t("upwork.pasLie")}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("upwork.alertesTitre")}</CardTitle>
              <CardDescription>{t("upwork.alertesDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {d.alertes.length === 0 ? (
                <EmptyState title={t("upwork.videAlertes")} />
              ) : (
                <>
                  {alertesL2.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{t("upwork.l2")}</p>
                      {alertesL2.map((a) => (
                        <div
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm"
                        >
                          <span className="truncate">
                            {a.nom}
                            {a.handle ? (
                              <span className="ml-1.5 text-xs text-muted-foreground">@{a.handle}</span>
                            ) : null}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">
                              {t("upwork.jours", { n: a.jours_sans_post })}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {a.manager_nom || t("upwork.sansHm")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {alertesL1.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{t("upwork.l1")}</p>
                      {alertesL1.map((a) => (
                        <div
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm"
                        >
                          <span className="truncate">
                            {a.nom}
                            {a.handle ? (
                              <span className="ml-1.5 text-xs text-muted-foreground">@{a.handle}</span>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {a.manager_nom || t("upwork.sansHm")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
