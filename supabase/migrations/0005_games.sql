-- ============================================================
-- STORMクラブ運営アプリ データベース準備 その5：試合
--
-- 使い方：0001〜0004 を実行したあと、SQL Editor にこの中身を貼り付けて「Run」。
--         何度実行しても壊れないように作ってあります。
-- ============================================================

create table if not exists public.games (
  id                  uuid primary key default gen_random_uuid(),
  unit_id             uuid not null references public.activity_units (id) on delete cascade,  -- どの活動単位（トップ／アカデミー／STORM）の試合か
  game_no             integer not null check (game_no between 1 and 20),                       -- 第何試合か
  start_time          time,                                                                    -- 試合開始時間
  opponent            text,                                                                    -- 対戦相手（任意）
  umpire_system       smallint not null default 4 check (umpire_system between 1 and 4),        -- 審判の人数制：1人制〜4人制（基本は4人制）
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (unit_id, game_no) deferrable initially immediate
);

create index if not exists games_unit_idx on public.games (unit_id);

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

-- 見る：スタッフ全員 ／ 登録・変更・削除：管理者だけ
alter table public.games enable row level security;

drop policy if exists games_select on public.games;
create policy games_select on public.games for select to authenticated using (public.is_staff());
drop policy if exists games_insert on public.games;
create policy games_insert on public.games for insert to authenticated with check (public.is_admin());
drop policy if exists games_update on public.games;
create policy games_update on public.games for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists games_delete on public.games;
create policy games_delete on public.games for delete to authenticated using (public.is_admin());

-- 試合を削除したとき、後ろの試合の番号を1つずつ詰める（第1・第3試合 → 第1・第2試合）
create or replace function public.delete_game(p_game_id uuid)
returns void
language plpgsql security invoker set search_path = public
as $$
declare
  v_unit uuid;
  v_no   integer;
begin
  select unit_id, game_no into v_unit, v_no from public.games where id = p_game_id;
  if v_unit is null then
    return;
  end if;
  delete from public.games where id = p_game_id;
  set constraints all deferred;
  update public.games set game_no = game_no - 1 where unit_id = v_unit and game_no > v_no;
end;
$$;
revoke execute on function public.delete_game(uuid) from public, anon;
grant  execute on function public.delete_game(uuid) to authenticated;
