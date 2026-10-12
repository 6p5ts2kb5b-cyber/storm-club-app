-- 0018: 試合ごとの「結果しだいで審判が必要になる」条件
-- 例：第3試合は「第1試合に負けたら」審判が必要。結果が決まったら「負けた／勝った」を押す。
-- 何度実行しても大丈夫です。既存のデータは変わりません。

alter table public.games add column if not exists umpire_cond_game    smallint;  -- どの試合の結果しだいか（例：1）
alter table public.games add column if not exists umpire_cond_result  text;      -- 審判が必要になる結果（lose=負けたら / win=勝ったら）
alter table public.games add column if not exists umpire_cond_outcome text;      -- 実際の結果（lose / win / 空=まだ）

alter table public.games drop constraint if exists games_umpire_cond_result_check;
alter table public.games add constraint games_umpire_cond_result_check check (umpire_cond_result is null or umpire_cond_result in ('lose','win'));
alter table public.games drop constraint if exists games_umpire_cond_outcome_check;
alter table public.games add constraint games_umpire_cond_outcome_check check (umpire_cond_outcome is null or umpire_cond_outcome in ('lose','win'));
