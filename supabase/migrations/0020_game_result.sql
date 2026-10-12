-- 0020: 試合の結果（点数・出塁数）を入れられるようにする（JJBF大会のリーグ戦の順位・次の日に進む条件用）
-- 何度実行しても大丈夫です。既存のデータは変わりません（空のまま）。
-- score_a = 先に書いたチーム（STORMが出る試合なら「うち」）の得点、score_b = 相手の得点

alter table public.games add column if not exists score_a   integer;
alter table public.games add column if not exists score_b   integer;
alter table public.games add column if not exists onbase_a  integer;
alter table public.games add column if not exists onbase_b  integer;
alter table public.games add column if not exists called    boolean;   -- コールドゲーム（STORM杯用）
alter table public.games add column if not exists innings   integer;   -- 試合の回数（STORM杯用。空なら7回）
