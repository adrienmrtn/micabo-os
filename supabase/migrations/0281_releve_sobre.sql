-- 0281 — Le relevé payait jusqu'à soixante fois chaque post (01/10/2026).
--
-- Le 28/09, journée normale : 74 scrapes de profil Apify (~2 450 résultats
-- lus) pour ~50 nouveaux posts. Trois causes, deux se règlent ici, la
-- troisième dans `_shared/releve_file.ts` :
--
-- 1. Le verrou du drain n'était pas atomique. `rattrapage-elo` lisait
--    `elo_dernier_run`, vérifiait `busy`, puis écrivait. Entre la fin d'un lot
--    (busy=false, curseur avancé) et le kick du lot suivant, le cron minute
--    lisait le même curseur et traitait le même compte : la chaîne se
--    dédoublait jusqu'à la fin de la file. 23 scrapes en double sur 74 le
--    28/09, jusqu'à trois sur le même compte à 10 ms d'écart.
--    `prendre_verrou_drain_elo` prend le verrou en UNE instruction (compare-and-
--    set sur la ligne de `reglages`, que l'UPDATE verrouille) et refuse un kick
--    dont le curseur a déjà été dépassé par un autre worker.
--
-- 2. Un post introuvable (supprimé, lien faux) déclenchait un `scrapePost`
--    Apify à chaque passe pendant 30 jours. `stats_echecs` compte les relevés
--    sans correspondance ; au bout de RELEVE_ECHECS_MAX (3), on cesse de payer.
--    `stats_tentative_at` date la dernière tentative, réussie ou non, pour ne
--    pas retenter dans la même journée.
--
-- 3. (code) Tout passage publié depuis 30 jours était re-mesuré dès que son
--    relevé avait 6 h. Désormais : relevé à 20 h d'intervalle, figé après
--    7 jours, profondeur de scrape calée sur l'âge du plus vieux passage dû.
--
-- Rien n'est réécrit dans les données : deux colonnes nulles/à zéro et une
-- fonction. Un chargeur encore sur l'ancien bundle ignore les colonnes et
-- n'appelle pas la fonction — la migration peut précéder le redéploiement.

alter table public.passages
  add column if not exists stats_echecs integer not null default 0,
  add column if not exists stats_tentative_at timestamptz;

comment on column public.passages.stats_echecs is
  'Relevés de stats consécutifs sans correspondance TikTok (post supprimé, lien faux). Remis à 0 au premier relevé réussi ; au-delà de RELEVE_ECHECS_MAX (releve_file.ts), le passage n''est plus relevé (0281).';
comment on column public.passages.stats_tentative_at is
  'Dernière tentative de relevé, réussie ou non. Une tentative de moins de 20 h n''est pas refaite (0281).';

create or replace function public.prendre_verrou_drain_elo(
  p_offset integer,
  p_restart boolean,
  p_perime_secondes integer default 240
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  -- Une seule instruction : l'UPDATE verrouille la ligne, donc deux workers
  -- concurrents se sérialisent et le second voit busy=true → aucune ligne.
  update public.reglages r
     set valeur = r.valeur || jsonb_build_object(
           'busy', true,
           'at', to_jsonb(now()),
           'offset', case
                       when p_restart then 0
                       else coalesce(p_offset, (r.valeur->>'offset')::integer, 0)
                     end,
           'done', false
         ),
         updated_at = now()
   where r.cle = 'elo_dernier_run'
     -- Libre, ou tenu par un worker mort (timeout Edge sans libération).
     and (
       not coalesce((r.valeur->>'busy')::boolean, false)
       or coalesce((r.valeur->>'at')::timestamptz, '-infinity'::timestamptz)
            < now() - make_interval(secs => p_perime_secondes)
     )
     -- Un kick porte le curseur qu'il croit courant : s'il a été dépassé, un
     -- autre worker a déjà traité ce compte.
     and (
       p_restart
       or p_offset is null
       or coalesce((r.valeur->>'offset')::integer, 0) = p_offset
     )
  returning r.valeur into v;

  -- null : un autre worker tient le drain, ou le curseur a déjà avancé.
  return v;
end;
$$;

comment on function public.prendre_verrou_drain_elo(integer, boolean, integer) is
  'Prend le verrou du drain rattrapage-elo en une instruction (compare-and-set sur reglages.elo_dernier_run). Rend la valeur verrouillée, ou null si un autre worker tient le drain ou a déjà avancé le curseur (0281).';

revoke all on function public.prendre_verrou_drain_elo(integer, boolean, integer) from public, anon, authenticated;
grant execute on function public.prendre_verrou_drain_elo(integer, boolean, integer) to service_role;

-- Sans ce reload, le premier appel rend PGRST202 « function not found »
-- (leçon de 0265).
notify pgrst, 'reload schema';
