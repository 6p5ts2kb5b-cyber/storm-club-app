-- 0012: 予備日に大会を行う（延期）を選べるようにする
alter table public.activity_units drop constraint if exists activity_units_tournament_state_check;
alter table public.activity_units
  add constraint activity_units_tournament_state_check check (tournament_state in ('pending', 'held', 'not_held', 'postponed'));
