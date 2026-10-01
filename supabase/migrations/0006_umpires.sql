-- ============================================================
-- STORMクラブ運営アプリ データベース準備 その6：審判の割り当て・集合時間
--
-- 使い方：0001〜0005 を実行したあと、SQL Editor にこの中身を貼り付けて「Run」。
--         何度実行しても壊れないように作ってあります。
--
-- しくみ：
--   umpire_slots  … 試合ごとの「審判の枠」。1つの枠に、スタッフ1人 または「相手チーム」が入る
--                    （例：第1試合の球審＝田中、二塁審＝相手チーム）
--                    同じ人が第2・第3試合の枠に入れば「第2〜3試合 担当（2試合）」になります。
--   umpire_people … 審判一人ずつの集合時間の設定（何分前集合か・手動で決めた時刻・備考）
--   活動全体の「何分前集合か」「手動の審判集合時間」は activity_units にあります（0002）。
-- ============================================================

create table if not exists public.umpire_slots (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games (id) on delete cascade,
  position     text not null check (position in ('plate', 'first', 'second', 'third', 'base')),
               -- 球審／一塁審／二塁審／三塁審／塁審（2人制）
  staff_id     uuid references public.staff (id) on delete set null,   -- 担当するスタッフ
  is_opponent  boolean not null default false,                         -- 相手チームが担当
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (game_id, position),                                          -- 1つの枠に入るのは1人だけ
  check (not (is_opponent and staff_id is not null))                   -- 「相手チーム」とスタッフを同時に入れない
);

create index if not exists umpire_slots_game_idx on public.umpire_slots (game_id);

drop trigger if exists umpire_slots_set_updated_at on public.umpire_slots;
create trigger umpire_slots_set_updated_at
  before update on public.umpire_slots
  for each row execute function public.set_updated_at();

create table if not exists public.umpire_people (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.activity_units (id) on delete cascade,
  staff_id     uuid not null references public.staff (id) on delete cascade,
  offset_min   integer check (offset_min between 0 and 240),   -- この人だけ「何分前集合か」を変える場合
  gather_time  time,                                           -- この人の集合時間を手動で決めた場合
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (unit_id, staff_id)
);

drop trigger if exists umpire_people_set_updated_at on public.umpire_people;
create trigger umpire_people_set_updated_at
  before update on public.umpire_people
  for each row execute function public.set_updated_at();

-- 見てよい人・書いてよい人のルール
--   審判の枠：見る＝スタッフ全員、入力＝管理者とスタッフ
--   一人ずつの集合時間：見る＝スタッフ全員、入力＝管理者だけ
alter table public.umpire_slots  enable row level security;
alter table public.umpire_people enable row level security;

drop policy if exists slots_select on public.umpire_slots;
create policy slots_select on public.umpire_slots for select to authenticated using (public.is_staff());
drop policy if exists slots_insert on public.umpire_slots;
create policy slots_insert on public.umpire_slots for insert to authenticated with check (public.can_edit());
drop policy if exists slots_update on public.umpire_slots;
create policy slots_update on public.umpire_slots for update to authenticated using (public.can_edit()) with check (public.can_edit());
drop policy if exists slots_delete on public.umpire_slots;
create policy slots_delete on public.umpire_slots for delete to authenticated using (public.can_edit());

drop policy if exists people_select on public.umpire_people;
create policy people_select on public.umpire_people for select to authenticated using (public.is_staff());
drop policy if exists people_insert on public.umpire_people;
create policy people_insert on public.umpire_people for insert to authenticated with check (public.is_admin());
drop policy if exists people_update on public.umpire_people;
create policy people_update on public.umpire_people for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists people_delete on public.umpire_people;
create policy people_delete on public.umpire_people for delete to authenticated using (public.is_admin());
