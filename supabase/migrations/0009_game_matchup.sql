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
