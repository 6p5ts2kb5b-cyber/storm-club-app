-- ============================================================
-- STORMクラブ運営アプリ データベース準備 その10：大会しだいで変わる予定
--
-- 例：「STORM杯・JJBF大会が実施されたら休み／実施されなければ練習（会場つき）」
--
-- 追加する項目（activity_units）：
--   tournament_name   … 大会の名前（空なら、大会しだいの予定ではない）
--   tournament_state  … pending=確認中 / held=実施される（→休み） / not_held=実施されない（→練習）
-- ============================================================

alter table public.activity_units add column if not exists tournament_name text;
alter table public.activity_units add column if not exists tournament_state text not null default 'pending';

alter table public.activity_units drop constraint if exists activity_units_tournament_state_check;
alter table public.activity_units
  add constraint activity_units_tournament_state_check check (tournament_state in ('pending', 'held', 'not_held'));
