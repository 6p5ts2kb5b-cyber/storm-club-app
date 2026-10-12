-- 0021: ランニングスコア（回ごとの点）と先攻を入れられるようにする（結果を保護者に送る機能用）
-- 何度実行しても大丈夫です。既存のデータは変わりません（空のまま）。
-- line_a = 先に書いたチーム（STORMが出る試合なら「うち」）の回ごとの点、line_b = 相手
-- first_bat = 先攻（a = 先に書いたチーム、b = 相手）

alter table public.games add column if not exists line_a    integer[];
alter table public.games add column if not exists line_b    integer[];
alter table public.games add column if not exists first_bat text;
