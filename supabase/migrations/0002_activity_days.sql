-- ============================================================
-- STORMクラブ運営アプリ データベース準備 その2：活動日と活動単位
--
-- 使い方：0001 を実行したあと、SQL Editor にこの中身を貼り付けて「Run」。
--         何度実行しても壊れないように作ってあります。
--
-- しくみ：
--   activity_days  … 1日につき1件。mode = split（トップ・アカデミー）／single（STORMクラブ）
--   activity_units … その日の「トップ」「アカデミー」「STORM」それぞれの1日分
--   区分を切り替えても、入力済みの活動単位は削除せず残します（戻したときに復活します）。
-- ============================================================

create table if not exists public.activity_days (
  id          uuid primary key default gen_random_uuid(),
  date        date not null unique,                                    -- 日付（1日1件）
  mode        text not null check (mode in ('split', 'single')),       -- 区分モード
  note        text,                                                    -- その日全体のメモ
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.activity_units (
  id                   uuid primary key default gen_random_uuid(),
  day_id               uuid not null references public.activity_days (id) on delete cascade,
  division             text not null check (division in ('storm', 'top', 'academy')),
  activity_type        text,                                           -- 活動内容（練習試合・公式戦など）
  venue                text,                                           -- 会場
  player_gather_time   time,                                           -- 選手集合時間
  gather_place         text,                                           -- 集合場所（将来用）
  umpire_required      boolean not null default false,                 -- 審判が必要か
  umpire_needed_count  integer not null default 0
                       check (umpire_needed_count between 0 and 8),    -- 必要人数（最大8名）
  umpire_offset_min    integer not null default 60
                       check (umpire_offset_min between 0 and 240),    -- 試合開始の何分前に集合か
  umpire_gather_time   time,                                           -- 基本の審判集合時間（手動で決めた場合）
  note                 text,                                           -- メモ
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (day_id, division)
);

create index if not exists activity_units_day_idx on public.activity_units (day_id);

drop trigger if exists activity_days_set_updated_at on public.activity_days;
create trigger activity_days_set_updated_at
  before update on public.activity_days
  for each row execute function public.set_updated_at();

drop trigger if exists activity_units_set_updated_at on public.activity_units;
create trigger activity_units_set_updated_at
  before update on public.activity_units
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 見てよい人・書いてよい人のルール
--   見る：有効なスタッフ全員
--   作成・変更・削除：管理者だけ（グラウンド・指導者・審判の入力は別の表で、スタッフも可能にします）
-- ------------------------------------------------------------
alter table public.activity_days  enable row level security;
alter table public.activity_units enable row level security;

drop policy if exists days_select on public.activity_days;
create policy days_select on public.activity_days for select to authenticated using (public.is_staff());
drop policy if exists days_insert on public.activity_days;
create policy days_insert on public.activity_days for insert to authenticated with check (public.is_admin());
drop policy if exists days_update on public.activity_days;
create policy days_update on public.activity_days for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists days_delete on public.activity_days;
create policy days_delete on public.activity_days for delete to authenticated using (public.is_admin());

drop policy if exists units_select on public.activity_units;
create policy units_select on public.activity_units for select to authenticated using (public.is_staff());
drop policy if exists units_insert on public.activity_units;
create policy units_insert on public.activity_units for insert to authenticated with check (public.is_admin());
drop policy if exists units_update on public.activity_units;
create policy units_update on public.activity_units for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists units_delete on public.activity_units;
create policy units_delete on public.activity_units for delete to authenticated using (public.is_admin());
