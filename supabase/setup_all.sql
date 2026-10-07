-- ============================================================
-- STORMクラブ運営アプリ データベース準備（まとめて1回で実行する版）
--
-- 使い方：Supabase の左メニュー「SQL Editor」→ 新しいクエリに
--         このファイルの中身をすべて貼り付けて「Run」を押すだけ。
--         何度実行しても壊れないように作ってあります。
--
-- 中身は supabase/migrations/0001〜0009 を順番につなげたものです。
-- ============================================================

-- >>>>>>>>>> 0001_staff_and_login.sql >>>>>>>>>>
-- ============================================================
-- STORMクラブ運営アプリ データベース準備 その1：スタッフマスターとログインの許可
--
-- 使い方：Supabase の画面左の「SQL Editor」→「New query」に
--         このファイルの中身をすべて貼り付けて「Run」を押します。
--         何度実行しても壊れないように作ってあります。
-- ============================================================

-- ------------------------------------------------------------
-- スタッフマスター
-- ------------------------------------------------------------
create table if not exists public.staff (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                                   -- 氏名
  email       text not null,                                   -- Googleメールアドレス（ログインの照合に使用）
  role        text not null default 'staff'
              check (role in ('admin', 'staff', 'viewer')),    -- 権限：管理者／スタッフ／閲覧のみ
  can_coach   boolean not null default true,                   -- 指導者として参加可能
  can_umpire  boolean not null default false,                  -- 審判可能
  can_plate   boolean not null default false,                  -- 球審可能
  can_base    boolean not null default false,                  -- 塁審可能
  is_active   boolean not null default true,                   -- 有効／無効（やめた人は削除せず無効に）
  note        text,                                            -- 備考
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- メールアドレスは大文字・小文字を区別せず1人1件
create unique index if not exists staff_email_unique on public.staff (lower(email));

-- 更新日時を自動で記録
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists staff_set_updated_at on public.staff;
create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 「いまログインしている人は誰か」を調べる関数
-- ------------------------------------------------------------

-- ログイン中の人のスタッフ情報（有効な人だけ）
create or replace function public.current_staff()
returns setof public.staff
language sql stable security definer set search_path = public
as $$
  select * from public.staff
  where lower(email) = lower(auth.jwt() ->> 'email')
    and is_active
  limit 1;
$$;

-- 有効なスタッフか
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where lower(email) = lower(auth.jwt() ->> 'email') and is_active
  );
$$;

-- 管理者か
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where lower(email) = lower(auth.jwt() ->> 'email') and is_active and role = 'admin'
  );
$$;

-- ログインしていない人には関数を使わせない
revoke execute on function public.current_staff() from public, anon;
revoke execute on function public.is_staff()      from public, anon;
revoke execute on function public.is_admin()      from public, anon;
grant  execute on function public.current_staff() to authenticated;
grant  execute on function public.is_staff()      to authenticated;
grant  execute on function public.is_admin()      to authenticated;

-- ------------------------------------------------------------
-- 見てよい人・書いてよい人のルール（RLS：行レベルセキュリティ）
--   見る：有効なスタッフ全員
--   追加・変更・削除：管理者だけ
-- ------------------------------------------------------------
alter table public.staff enable row level security;

drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff
  for select to authenticated using (public.is_staff());

drop policy if exists staff_insert on public.staff;
create policy staff_insert on public.staff
  for insert to authenticated with check (public.is_admin());

drop policy if exists staff_update on public.staff;
create policy staff_update on public.staff
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists staff_delete on public.staff;
create policy staff_delete on public.staff
  for delete to authenticated using (public.is_admin());

-- >>>>>>>>>> 0002_activity_days.sql >>>>>>>>>>
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

-- >>>>>>>>>> 0003_grounds.sql >>>>>>>>>>
-- ============================================================
-- STORMクラブ運営アプリ データベース準備 その3：グラウンド候補
--
-- 使い方：0001・0002 を実行したあと、SQL Editor にこの中身を貼り付けて「Run」。
--         何度実行しても壊れないように作ってあります。
-- ============================================================

-- 入力してよい人（管理者・スタッフ。閲覧のみの人は不可）
create or replace function public.can_edit()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where lower(email) = lower(auth.jwt() ->> 'email') and is_active and role in ('admin', 'staff')
  );
$$;
revoke execute on function public.can_edit() from public, anon;
grant  execute on function public.can_edit() to authenticated;

create table if not exists public.grounds (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.activity_units (id) on delete cascade,  -- どの活動単位（トップ／アカデミー／STORM）の候補か
  school_name  text not null,                                                           -- 学校名
  ground_name  text,                                                                    -- グラウンド名（第2グラウンドなど）
  school_use   text not null default 'unknown'
               check (school_use in ('none', 'planned', 'unknown')),                    -- 学校側の使用予定：なし／あり／不明
  storm_use    text not null default 'unknown'
               check (storm_use in ('ok', 'ng', 'unknown')),                            -- STORMが使えるか：可能／不可／未確認
  status       text not null default 'candidate'
               check (status in ('candidate', 'checking', 'available', 'unavailable', 'decided')),
               -- 候補／確認中／使用可能／使用不可／使用決定
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists grounds_unit_idx on public.grounds (unit_id);

-- 「使用決定」は1つの活動単位につき1校だけ
create unique index if not exists grounds_one_decided on public.grounds (unit_id) where status = 'decided';

drop trigger if exists grounds_set_updated_at on public.grounds;
create trigger grounds_set_updated_at
  before update on public.grounds
  for each row execute function public.set_updated_at();

-- 見る：スタッフ全員 ／ 登録・変更・削除：管理者とスタッフ
alter table public.grounds enable row level security;

drop policy if exists grounds_select on public.grounds;
create policy grounds_select on public.grounds for select to authenticated using (public.is_staff());
drop policy if exists grounds_insert on public.grounds;
create policy grounds_insert on public.grounds for insert to authenticated with check (public.can_edit());
drop policy if exists grounds_update on public.grounds;
create policy grounds_update on public.grounds for update to authenticated using (public.can_edit()) with check (public.can_edit());
drop policy if exists grounds_delete on public.grounds;
create policy grounds_delete on public.grounds for delete to authenticated using (public.can_edit());

-- グラウンドを決めたとき、会場が空なら学校名を入れる（スタッフも会場を埋められるように、ここだけ特別に許可）
create or replace function public.fill_venue_from_ground()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'decided' then
    update public.activity_units
       set venue = new.school_name
     where id = new.unit_id and (venue is null or venue = '');
  end if;
  return new;
end;
$$;

drop trigger if exists grounds_fill_venue on public.grounds;
create trigger grounds_fill_venue
  after insert or update of status on public.grounds
  for each row execute function public.fill_venue_from_ground();

-- >>>>>>>>>> 0004_coaches.sql >>>>>>>>>>
-- ============================================================
-- STORMクラブ運営アプリ データベース準備 その4：指導者の参加
--
-- 使い方：0001〜0003 を実行したあと、SQL Editor にこの中身を貼り付けて「Run」。
--         何度実行しても壊れないように作ってあります。
--
-- ※ 選手集合時間・集合場所は 0002 で作った activity_units の
--    player_gather_time / gather_place に保存します（追加の準備は不要）。
-- ============================================================

create table if not exists public.coach_assignments (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references public.activity_units (id) on delete cascade,  -- どの活動単位（トップ／アカデミー／STORM）か
  staff_id    uuid not null references public.staff (id) on delete cascade,           -- 参加する指導者（スタッフマスターの人）
  created_at  timestamptz not null default now(),
  unique (unit_id, staff_id)                                                          -- 同じ人を2回登録しない
);

create index if not exists coach_assignments_unit_idx on public.coach_assignments (unit_id);

-- 見る：スタッフ全員 ／ 追加・取り消し：管理者とスタッフ（閲覧のみは不可）
alter table public.coach_assignments enable row level security;

drop policy if exists coach_select on public.coach_assignments;
create policy coach_select on public.coach_assignments for select to authenticated using (public.is_staff());
drop policy if exists coach_insert on public.coach_assignments;
create policy coach_insert on public.coach_assignments for insert to authenticated with check (public.can_edit());
drop policy if exists coach_delete on public.coach_assignments;
create policy coach_delete on public.coach_assignments for delete to authenticated using (public.can_edit());

-- >>>>>>>>>> 0005_games.sql >>>>>>>>>>
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

-- >>>>>>>>>> 0006_umpires.sql >>>>>>>>>>
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

-- >>>>>>>>>> 0007_grants.sql >>>>>>>>>>
-- ============================================================
-- STORMクラブ運営アプリ データベース準備 その7：アプリからの読み書きの許可
--
-- Supabaseの「Automatically expose new tables」がオフでも動くように、
-- ログインした人（authenticated）にだけ表の読み書きを許可します。
-- 実際に「誰が何をできるか」は、各表の行レベルセキュリティ（RLS）で細かく守られています。
-- ログインしていない人（anon）には何も許可しません。
-- ============================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.staff,
  public.activity_days,
  public.activity_units,
  public.grounds,
  public.coach_assignments,
  public.games,
  public.umpire_slots,
  public.umpire_people
to authenticated;

revoke all on
  public.staff,
  public.activity_days,
  public.activity_units,
  public.grounds,
  public.coach_assignments,
  public.games,
  public.umpire_slots,
  public.umpire_people
from anon;

grant execute on function public.delete_game(uuid) to authenticated;

-- >>>>>>>>>> 0008_rosters.sql >>>>>>>>>>
-- ============================================================
-- STORMクラブ運営アプリ データベース準備 その8：名簿を分ける
--
--   ログイン名簿 … メールアドレスがある人（その Google アカウントでログインできる）
--   審判名簿・指導者名簿 … ログインしない人も、名前だけで登録できる
--
-- メールアドレスを「空でもよい」に変えるだけです。
-- 何度実行しても壊れません。
-- ============================================================

alter table public.staff alter column email drop not null;

-- 空文字のメールアドレスは「なし」として扱う
update public.staff set email = null where email is not null and btrim(email) = '';

-- >>>>>>>>>> 0009_game_matchup.sql >>>>>>>>>>
-- ============================================================
-- STORMクラブ運営アプリ データベース準備 その9：3チーム以上の試合
--
-- 使い方：SQL Editor にこの中身を貼り付けて「Run」。何度実行しても壊れません。
--
-- 追加する項目（games）：
--   storm_plays   … STORMが試合に出るか（false なら「審判だけ担当する試合」）
--   opponent2     … STORMが出ない試合の、もう一方のチーム名（opponent が一方のチーム名）
--   umpire_team   … 審判の枠で「他チームが担当」を選んだときの、チーム名（例：第1試合の勝者）
-- ============================================================

alter table public.games add column if not exists storm_plays boolean not null default true;
alter table public.games add column if not exists opponent2   text;
alter table public.games add column if not exists umpire_team text;

