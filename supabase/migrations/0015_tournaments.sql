-- 0015: 大会名の登録（選んで使えるようにする）
create table if not exists public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.tournaments enable row level security;

drop policy if exists tournaments_select on public.tournaments;
create policy tournaments_select on public.tournaments
  for select to authenticated using (public.is_staff());

drop policy if exists tournaments_insert on public.tournaments;
create policy tournaments_insert on public.tournaments
  for insert to authenticated with check (public.is_admin());

drop policy if exists tournaments_delete on public.tournaments;
create policy tournaments_delete on public.tournaments
  for delete to authenticated using (public.is_admin());

grant select, insert, delete on public.tournaments to authenticated;
revoke all on public.tournaments from anon;

insert into public.tournaments (name) values ('STORM杯・JJBF大会'), ('JJBF大会') on conflict (name) do nothing;
