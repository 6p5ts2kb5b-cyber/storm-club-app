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
