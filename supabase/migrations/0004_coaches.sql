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
