-- 0019: 大会が予定どおり実施された場合の「予備日の予定」を選べるようにする
-- 例：10/13に大会を実施 → 予備日の11/3は「休養日／練習／大会2日目／大会3日目／他の大会」
-- 何度実行しても大丈夫です。既存のデータは変わりません。

alter table public.activity_units add column if not exists reserve_plan  text;  -- 予備日の予定（大会が実施された場合）
alter table public.activity_units add column if not exists reserve2_plan text;  -- 予備日の予備日の予定（大会が実施された場合）
