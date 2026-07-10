-- ============================================================
-- Migration: restrict curriculum editing to the owner only.
-- Instructors keep the ability to VIEW curriculum and track
-- progress (student_skills), but can no longer add/rename/
-- reorder/delete levels or skills.
--
-- Safe to run any time — does not touch your existing data.
-- ============================================================

drop policy if exists "write student curriculum levels" on curriculum_levels;
create policy "write student curriculum levels" on curriculum_levels for all using (
  exists (select 1 from students s where s.id = student_id and s.org_id = my_org_id() and my_role() = 'owner')
) with check (
  exists (select 1 from students s where s.id = student_id and s.org_id = my_org_id() and my_role() = 'owner')
);

drop policy if exists "write student curriculum skills" on curriculum_skills;
create policy "write student curriculum skills" on curriculum_skills for all using (
  exists (select 1 from curriculum_levels l join students s on s.id = l.student_id where l.id = level_id and s.org_id = my_org_id() and my_role() = 'owner')
) with check (
  exists (select 1 from curriculum_levels l join students s on s.id = l.student_id where l.id = level_id and s.org_id = my_org_id() and my_role() = 'owner')
);
