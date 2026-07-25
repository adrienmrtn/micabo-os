-- `auth.admin.deleteUser` (API GoTrue) échoue depuis la migration du projet vers
-- des clés JWT asymétriques (ES256) : « unrecognized JWT kid <nil> for algorithm
-- ES256 » dès qu'on supprime un utilisateur RÉEL. On contourne en supprimant la
-- ligne auth.users directement en SQL : ça cascade sur profiles → comptes et
-- libère ainsi le compte de référence. SECURITY DEFINER car auth.users n'est pas
-- accessible au rôle applicatif ; réservé au service_role (appelé par la fonction
-- edge manage-users, qui a déjà vérifié les droits admin / hiring_manager).
create or replace function public.supprimer_auth_user(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = uid;
$$;

revoke all on function public.supprimer_auth_user(uuid) from public, anon, authenticated;
grant execute on function public.supprimer_auth_user(uuid) to service_role;
