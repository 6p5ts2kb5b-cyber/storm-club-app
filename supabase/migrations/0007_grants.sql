-- ============================================================
-- STORMクラブ運営アプリ データベース準備 その7：アプリからの読み書きの許可
--
-- Supabaseの「Automatically expose new tables」がオフでも動くように、
-- ログインした人（authenticated）にだけ表の読み書きを許可します。
-- 実際に「誰が何をできるか」は、各表の行レベルセキュリティ（RLS）で細かく守られています。
-- ログインしていない人（anon）には何も許可しません。
-- ============================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.staff,
  public.activity_days,
  public.activity_units,
  public.grounds,
  public.coach_assignments,
  public.games,
  public.umpire_slots,
  public.umpire_people
to authenticated;

revoke all on
  public.staff,
  public.activity_days,
  public.activity_units,
  public.grounds,
  public.coach_assignments,
  public.games,
  public.umpire_slots,
  public.umpire_people
from anon;

grant execute on function public.delete_game(uuid) to authenticated;
