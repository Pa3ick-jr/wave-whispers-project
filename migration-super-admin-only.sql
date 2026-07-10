-- ============================================================
-- Migration: only the designated super-admin email may register
-- a new school. Safe to run any time — does not touch your
-- existing data (this just replaces one function).
--
-- IMPORTANT: before running, replace 'you@example.com' below
-- with your real login email (the one you sign in with).
-- ============================================================

create or replace function create_org_and_owner(org_name text, name_in text)
returns uuid
language plpgsql security definer
as $$
declare
  new_org_id uuid;
  my_email text;
  tmpl_id uuid;
  lvl_id uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'You already belong to a school.';
  end if;

  select email into my_email from auth.users where id = auth.uid();

  if lower(my_email) is distinct from lower('you@example.com') then
    raise exception 'Registering a new school is restricted. Ask the school owner for an instructor invite code instead.';
  end if;

  insert into organizations (name) values (org_name) returning id into new_org_id;
  insert into profiles (id, org_id, role, display_name, email)
    values (auth.uid(), new_org_id, 'owner', nullif(name_in, ''), my_email);

  insert into curriculum_templates (org_id, name) values (new_org_id, 'American Red Cross Learn-to-Swim') returning id into tmpl_id;

  insert into template_levels (template_id, org_id, name, position) values (tmpl_id, new_org_id, 'Water Acclimation', 0) returning id into lvl_id;
  insert into template_skills (template_level_id, org_id, name, position) values
    (lvl_id, new_org_id, 'Enter and exit the water safely', 0),
    (lvl_id, new_org_id, 'Comfortably submerge face and blow bubbles', 1),
    (lvl_id, new_org_id, 'Open eyes underwater and retrieve an object', 2),
    (lvl_id, new_org_id, 'Front float with support, then unassisted', 3),
    (lvl_id, new_org_id, 'Back float with support, then unassisted', 4),
    (lvl_id, new_org_id, 'Roll from front to back to breathe', 5);

  insert into template_levels (template_id, org_id, name, position) values (tmpl_id, new_org_id, 'Water Movement', 1) returning id into lvl_id;
  insert into template_skills (template_level_id, org_id, name, position) values
    (lvl_id, new_org_id, 'Front glide and recover to standing', 0),
    (lvl_id, new_org_id, 'Back glide and recover to standing', 1),
    (lvl_id, new_org_id, 'Change direction while moving through water', 2),
    (lvl_id, new_org_id, 'Tread water using arm and leg movements', 3),
    (lvl_id, new_org_id, 'Push off the wall and glide', 4),
    (lvl_id, new_org_id, 'Jump into deep water and return to the surface', 5);

  insert into template_levels (template_id, org_id, name, position) values (tmpl_id, new_org_id, 'Water Stamina', 2) returning id into lvl_id;
  insert into template_skills (template_level_id, org_id, name, position) values
    (lvl_id, new_org_id, 'Front crawl-style kick on front', 0),
    (lvl_id, new_org_id, 'Back crawl-style kick on back', 1),
    (lvl_id, new_org_id, 'Rotary breathing to the side', 2),
    (lvl_id, new_org_id, 'Combine arm and leg action on front', 3),
    (lvl_id, new_org_id, 'Combine arm and leg action on back', 4),
    (lvl_id, new_org_id, 'Swim 15 yards continuously, front or back', 5);

  insert into template_levels (template_id, org_id, name, position) values (tmpl_id, new_org_id, 'Stroke Introduction', 3) returning id into lvl_id;
  insert into template_skills (template_level_id, org_id, name, position) values
    (lvl_id, new_org_id, 'Front crawl with rhythmic breathing', 0),
    (lvl_id, new_org_id, 'Elementary backstroke arm and leg action', 1),
    (lvl_id, new_org_id, 'Introduction to breaststroke kick', 2),
    (lvl_id, new_org_id, 'Introduction to butterfly-style dolphin kick', 3),
    (lvl_id, new_org_id, 'Scissor kick introduction', 4),
    (lvl_id, new_org_id, 'Swim 25 yards using a learned stroke', 5);

  insert into template_levels (template_id, org_id, name, position) values (tmpl_id, new_org_id, 'Stroke Development', 4) returning id into lvl_id;
  insert into template_skills (template_level_id, org_id, name, position) values
    (lvl_id, new_org_id, 'Front crawl with bilateral breathing option', 0),
    (lvl_id, new_org_id, 'Backstroke refinement over distance', 1),
    (lvl_id, new_org_id, 'Breaststroke arm/leg/breathing coordination', 2),
    (lvl_id, new_org_id, 'Butterfly arm/leg/breathing coordination', 3),
    (lvl_id, new_org_id, 'Open turns at the wall', 4),
    (lvl_id, new_org_id, 'Swim 50 yards using two different strokes', 5);

  insert into template_levels (template_id, org_id, name, position) values (tmpl_id, new_org_id, 'Stroke Mechanics', 5) returning id into lvl_id;
  insert into template_skills (template_level_id, org_id, name, position) values
    (lvl_id, new_org_id, 'Refine front crawl technique and pace', 0),
    (lvl_id, new_org_id, 'Refine backstroke technique and pace', 1),
    (lvl_id, new_org_id, 'Refine breaststroke technique and pace', 2),
    (lvl_id, new_org_id, 'Refine butterfly technique and pace', 3),
    (lvl_id, new_org_id, 'Sport (racing) starts and turns', 4),
    (lvl_id, new_org_id, 'Swim continuously for 100+ yards', 5);

  return new_org_id;
end;
$$;
grant execute on function create_org_and_owner(text, text) to authenticated;
