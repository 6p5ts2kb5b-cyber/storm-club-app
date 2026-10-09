-- 0016: 大会が実施されない場合に「休養日」にする選択肢を追加
alter table public.activity_units drop constraint if exists activity_units_tournament_state_check;
alter table public.activity_units
  add constraint activity_units_tournament_state_check
  check (tournament_state in ('pending', 'held', 'not_held', 'postponed', 'not_held_rest'));
