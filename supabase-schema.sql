-- ============================================================
-- Rove and Ripple / Lanebook — Supabase schema v3
-- Adds: per-student curricula (no longer org-wide), reusable
-- curriculum templates with an American Red Cross starter,
-- and lesson-plan tracking (monthly / 10-lesson package).
--
-- This REPLACES v2. Run this whole file. It drops your existing
-- tables — re-add swimmers/curriculum after.
-- ============================================================

drop table if exists sessions;
drop table if exists student_skills;
drop table if exists curriculum_skills;
drop table if exists curriculum_levels;
drop table if exists students;
drop table if exists template_skills;
drop table if exists template_levels;
drop table if exists curriculum_templates;
drop table if exists invites;
drop table if exists profiles;
drop table if exists organizations;

drop function if exists get_student_progress(text);
drop function if exists create_invite();
drop function if exists join_org_with_invite(text, text);
drop function if exists create_org_and_owner(text, text, text);
drop function if exists create_org_and_owner(text, text);
drop function if exists my_org_id();
drop function if exists my_role();

-- ------------------------------------------------------------
-- Core tables
-- ------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('owner','instructor')),
  display_name text,
  email text,
  created_at timestamptz default now()
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  code text unique not null,
  created_by uuid references auth.users(id),
  used_by uuid references auth.users(id),
  used_at timestamptz,
  created_at timestamptz default now()
);

-- Students now also carry their lesson-plan settings. Only the
-- owner can ever UPDATE this table (see RLS below), which is what
-- locks plan editing down to the owner automatically.
create table students (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  instructor_id uuid references auth.users(id) on delete set null,
  name text not null,
  access_code text unique not null,
  plan_type text not null default 'monthly' check (plan_type in ('monthly','package')),
  plan_started_at date not null default current_date,
  package_size int not null default 10,
  created_at date default current_date
);

-- Reusable curriculum templates (owner-managed, visible org-wide)
create table curriculum_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table template_levels (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references curriculum_templates(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  position int not null default 0
);

create table template_skills (
  id uuid primary key default gen_random_uuid(),
  template_level_id uuid not null references template_levels(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  position int not null default 0
);

-- Per-STUDENT curriculum — each swimmer has their own independent
-- copy, usually created by applying a template then customized.
create table curriculum_levels (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create table curriculum_skills (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references curriculum_levels(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  position int not null default 0
);

create table student_skills (
  student_id uuid references students(id) on delete cascade,
  skill_id uuid references curriculum_skills(id) on delete cascade,
  status text not null default 'not_started',
  primary key (student_id, skill_id)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  date date not null,
  note text,
  goal text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Helper functions
-- ------------------------------------------------------------
create or replace function my_org_id() returns uuid
language sql security definer stable
as $$ select org_id from profiles where id = auth.uid() $$;

create or replace function my_role() returns text
language sql security definer stable
as $$ select role from profiles where id = auth.uid() $$;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table invites enable row level security;
alter table students enable row level security;
alter table curriculum_templates enable row level security;
alter table template_levels enable row level security;
alter table template_skills enable row level security;
alter table curriculum_levels enable row level security;
alter table curriculum_skills enable row level security;
alter table student_skills enable row level security;
alter table sessions enable row level security;

create policy "view own org" on organizations for select using (id = my_org_id());

create policy "view org profiles" on profiles for select using (org_id = my_org_id());
create policy "owner removes instructor profiles" on profiles for delete using (org_id = my_org_id() and my_role() = 'owner' and role = 'instructor');

create policy "owner manages invites" on invites for all
  using (org_id = my_org_id() and my_role() = 'owner')
  with check (org_id = my_org_id() and my_role() = 'owner');

-- Students: instructors can SELECT their assigned students (read
-- profile + plan info) but only the owner can INSERT/UPDATE/DELETE
-- — this is what locks plan-type/renewal editing to the owner.
create policy "view assigned or all students" on students for select using (
  org_id = my_org_id() and (my_role() = 'owner' or instructor_id = auth.uid())
);
create policy "owner inserts students" on students for insert with check (org_id = my_org_id() and my_role() = 'owner');
create policy "owner updates students" on students for update using (org_id = my_org_id() and my_role() = 'owner') with check (org_id = my_org_id() and my_role() = 'owner');
create policy "owner deletes students" on students for delete using (org_id = my_org_id() and my_role() = 'owner');

-- Templates: any org member can view (to apply them); only the owner edits
create policy "org views templates" on curriculum_templates for select using (org_id = my_org_id());
create policy "owner writes templates" on curriculum_templates for all using (org_id = my_org_id() and my_role() = 'owner') with check (org_id = my_org_id() and my_role() = 'owner');
create policy "org views template levels" on template_levels for select using (org_id = my_org_id());
create policy "owner writes template levels" on template_levels for all using (org_id = my_org_id() and my_role() = 'owner') with check (org_id = my_org_id() and my_role() = 'owner');
create policy "org views template skills" on template_skills for select using (org_id = my_org_id());
create policy "owner writes template skills" on template_skills for all using (org_id = my_org_id() and my_role() = 'owner') with check (org_id = my_org_id() and my_role() = 'owner');

-- Per-student curriculum: owner sees/edits all; instructor sees/edits only their assigned students'
create policy "view student curriculum levels" on curriculum_levels for select using (
  exists (select 1 from students s where s.id = student_id and s.org_id = my_org_id() and (my_role() = 'owner' or s.instructor_id = auth.uid()))
);
create policy "write student curriculum levels" on curriculum_levels for all using (
  exists (select 1 from students s where s.id = student_id and s.org_id = my_org_id() and my_role() = 'owner')
) with check (
  exists (select 1 from students s where s.id = student_id and s.org_id = my_org_id() and my_role() = 'owner')
);

create policy "view student curriculum skills" on curriculum_skills for select using (
  exists (select 1 from curriculum_levels l join students s on s.id = l.student_id where l.id = level_id and s.org_id = my_org_id() and (my_role() = 'owner' or s.instructor_id = auth.uid()))
);
create policy "write student curriculum skills" on curriculum_skills for all using (
  exists (select 1 from curriculum_levels l join students s on s.id = l.student_id where l.id = level_id and s.org_id = my_org_id() and my_role() = 'owner')
) with check (
  exists (select 1 from curriculum_levels l join students s on s.id = l.student_id where l.id = level_id and s.org_id = my_org_id() and my_role() = 'owner')
);

create policy "view student skills" on student_skills for select using (
  exists (select 1 from students s where s.id = student_id and s.org_id = my_org_id() and (my_role() = 'owner' or s.instructor_id = auth.uid()))
);
create policy "write student skills" on student_skills for all using (
  exists (select 1 from students s where s.id = student_id and s.org_id = my_org_id() and (my_role() = 'owner' or s.instructor_id = auth.uid()))
) with check (
  exists (select 1 from students s where s.id = student_id and s.org_id = my_org_id() and (my_role() = 'owner' or s.instructor_id = auth.uid()))
);

create policy "view sessions" on sessions for select using (
  exists (select 1 from students s where s.id = student_id and s.org_id = my_org_id() and (my_role() = 'owner' or s.instructor_id = auth.uid()))
);
create policy "write sessions" on sessions for all using (
  exists (select 1 from students s where s.id = student_id and s.org_id = my_org_id() and (my_role() = 'owner' or s.instructor_id = auth.uid()))
) with check (
  exists (select 1 from students s where s.id = student_id and s.org_id = my_org_id() and (my_role() = 'owner' or s.instructor_id = auth.uid()))
);

-- ------------------------------------------------------------
-- Onboarding functions
-- ------------------------------------------------------------
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

  -- Only the designated super-admin email may register a new school.
  -- IMPORTANT: replace 'you@example.com' below with your real login email.
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

create or replace function join_org_with_invite(invite_code text, name_in text)
returns uuid
language plpgsql security definer
as $$
declare
  inv record;
  my_email text;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'You already belong to a school.';
  end if;
  select * into inv from invites where code = invite_code and used_by is null;
  if inv is null then
    raise exception 'That invite code is invalid or already used.';
  end if;
  select email into my_email from auth.users where id = auth.uid();
  insert into profiles (id, org_id, role, display_name, email)
    values (auth.uid(), inv.org_id, 'instructor', nullif(name_in, ''), my_email);
  update invites set used_by = auth.uid(), used_at = now() where id = inv.id;
  return inv.org_id;
end;
$$;
grant execute on function join_org_with_invite(text, text) to authenticated;

create or replace function create_invite()
returns text
language plpgsql security definer
as $$
declare
  new_code text;
  own_org uuid;
  own_role text;
begin
  select org_id, role into own_org, own_role from profiles where id = auth.uid();
  if own_role is distinct from 'owner' then
    raise exception 'Only the school owner can invite instructors.';
  end if;
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into invites (org_id, code, created_by) values (own_org, new_code, auth.uid());
  return new_code;
end;
$$;
grant execute on function create_invite() to authenticated;

-- ------------------------------------------------------------
-- Student/parent access by code
-- ------------------------------------------------------------
create or replace function get_student_progress(code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
  sid uuid;
begin
  select id into sid from students where access_code = code;
  if sid is null then
    return null;
  end if;

  select json_build_object(
    'student', (select json_build_object('id', id, 'name', name, 'created_at', created_at) from students where id = sid),
    'levels', (
      select coalesce(json_agg(json_build_object(
        'id', l.id, 'name', l.name, 'position', l.position,
        'skills', (
          select coalesce(json_agg(json_build_object(
            'id', sk.id, 'name', sk.name, 'position', sk.position,
            'status', coalesce((select status from student_skills ss where ss.student_id = sid and ss.skill_id = sk.id), 'not_started')
          ) order by sk.position), '[]'::json)
          from curriculum_skills sk where sk.level_id = l.id
        )
      ) order by l.position), '[]'::json)
      from curriculum_levels l
      where l.student_id = sid
    ),
    'sessions', (
      select coalesce(json_agg(json_build_object('date', date, 'note', note, 'goal', goal) order by date desc), '[]'::json)
      from sessions where student_id = sid
    )
  ) into result;

  return result;
end;
$$;
grant execute on function get_student_progress(text) to anon;
