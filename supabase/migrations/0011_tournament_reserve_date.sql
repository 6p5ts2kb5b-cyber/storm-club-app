-- 0011: 大会の「予備日」
-- 「この日は ○月○日 の大会の予備日」を覚えておく。
-- 大会が実施された → この日は休養日 ／ 実施されなかった → この日は練習（0010 の設定と組み合わせて使う）
alter table public.activity_units add column if not exists tournament_date date;
