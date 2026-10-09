-- 0017: 予備日の予備日（予備日2）：日付・会場・審判
alter table public.activity_units add column if not exists reserve2_date date;
alter table public.activity_units add column if not exists reserve2_venue text;
alter table public.activity_units add column if not exists reserve2_umpires text;
