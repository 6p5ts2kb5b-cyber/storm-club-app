-- 0013: 大会の予備日（予備日・予備日の表示名・予備日の会場）
-- 大会の日に「予備日」を入れると、その日付に自動で「☂ ○/○ ○○ の予備日」の案内が出る
alter table public.activity_units add column if not exists reserve_date date;
alter table public.activity_units add column if not exists reserve_name text;
alter table public.activity_units add column if not exists reserve_venue text;
