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
