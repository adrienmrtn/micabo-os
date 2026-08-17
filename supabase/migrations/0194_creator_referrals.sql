-- Parrainage créateur : un poster recommande une personne (pays OS, fiable,
-- majeure, contact Upwork/email/téléphone). L'admin accepte ou refuse.
-- Bonus affiché : 5 posts de la recrue → 10 $ pour le parrain (indicatif).

create table if not exists public.creator_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  prenom text not null,
  nom text,
  pays text not null check (
    pays in (
      'fr', 'en', 'de', 'it', 'es', 'pt', 'cs',
      'nl', 'el', 'hu', 'pl', 'ro', 'sv', 'tr'
    )
  ),
  contact_upwork text,
  contact_email text,
  contact_telephone text,
  confirme_present boolean not null,
  confirme_fiable boolean not null,
  confirme_majeur boolean not null,
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'accepte', 'refuse')),
  note_admin text,
  decide_par uuid references public.profiles (id) on delete set null,
  decide_at timestamptz,
  recrue_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_referrals_prenom_chk check (length(btrim(prenom)) > 0),
  constraint creator_referrals_contact_chk check (
    length(btrim(coalesce(contact_upwork, ''))) > 0
    or length(btrim(coalesce(contact_email, ''))) > 0
    or length(btrim(coalesce(contact_telephone, ''))) > 0
  ),
  constraint creator_referrals_confirm_chk check (
    confirme_present and confirme_fiable and confirme_majeur
  )
);

create index if not exists creator_referrals_referrer_idx
  on public.creator_referrals (referrer_id, created_at desc);
create index if not exists creator_referrals_statut_idx
  on public.creator_referrals (statut, created_at desc);

alter table public.creator_referrals enable row level security;

drop policy if exists creator_referrals_poster_select on public.creator_referrals;
create policy creator_referrals_poster_select on public.creator_referrals
  for select using (
    referrer_id = auth.uid()
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'poster'
    )
  );

drop policy if exists creator_referrals_poster_insert on public.creator_referrals;
create policy creator_referrals_poster_insert on public.creator_referrals
  for insert with check (
    referrer_id = auth.uid()
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'poster'
    )
  );

drop policy if exists creator_referrals_admin_all on public.creator_referrals;
create policy creator_referrals_admin_all on public.creator_referrals
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.creator_referrals to authenticated;
