-- 0014: 予備日の審判（名前を「、」でつないで保存）
alter table public.activity_units add column if not exists reserve_umpires text;
