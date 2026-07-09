-- ============================================================
-- Wave Whispers / Lanebook — Supabase schema v2
-- Adds: organizations, instructor accounts, invite codes,
-- and per-student instructor assignment.
--
-- This REPLACES your v1 schema. Run this entire file in the
-- SQL Editor. It drops your existing tables first, so your
-- current swimmers/curriculum will be cleared out — re-add
-- them after (fine for a project still in setup).
-- ============================================================

drop function if exists get_student_progress(text);
drop function if exists create_invite();
drop function if exists join_org_with_invite(text, text);
drop function if exists create_org_and_owner(text, text);
drop function if exists my_org_id();
drop function if exists my_role();

drop table if exists sessions;
drop table if exists student_skills;
drop table if exists students;
drop table if exists curriculum_skills;
drop table if exists curriculum_levels;
drop table if exists invites;
drop table if exists profiles;
drop table if exists organizations;

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

create table curriculum_levels (
  id uuid primary key default gen_random_uuid(),
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

create table students (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  instructor_id uuid references auth.users(id) on delete set null,
  name text not null,
  access_code text unique not null,
  created_at date default current_date
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

create or replace function my_org_id() returns uuid
language sql security definer stable
as $$ select org_id from profiles where id = auth.uid() $$;

create or replace function my_role() returns text
language sql security definer stable
as $$ select role from profiles where id = auth.uid() $$;

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table invites enable row level security;
alter table curriculum_levels enable row level security;
alter table curriculum_skills enable row level security;
alter table students enable row level security;
alter table student_skills enable row level security;
alter table sessions enable row level security;

create policy "view own org" on organizations for select using (id = my_org_id());

create policy "view org profiles" on profiles for select using (org_id = my_org_id());
create policy "owner removes instructor profiles" on profiles for delete using (org_id = my_org_id() and my_role() = 'owner' and role = 'instructor');

create policy "owner manages invites" on invites for all
  using (org_id = my_org_id() and my_role() = 'owner')
  with check (org_id = my_org_id() and my_role() = 'owner');

create policy "org views curriculum levels" on curriculum_levels for select using (org_id = my_org_id());
create policy "owner inserts curriculum levels" on curriculum_levels for insert with check (org_id = my_org_id() and my_role() = 'owner');
create policy "owner updates curriculum levels" on curriculum_levels for update using (org_id = my_org_id() and my_role() = 'owner') with check (org_id = my_org_id() and my_role() = 'owner');
create policy "owner deletes curriculum levels" on curriculum_levels for delete using (org_id = my_org_id() and my_role() = 'owner');

create policy "org views curriculum skills" on curriculum_skills for select using (org_id = my_org_id());
create policy "owner inserts curriculum skills" on curriculum_skills for insert with check (org_id = my_org_id() and my_role() = 'owner');
create policy "owner updates curriculum skills" on curriculum_skills for update using (org_id = my_org_id() and my_role() = 'owner') with check (org_id = my_org_id() and my_role() = 'owner');
create policy "owner deletes curriculum skills" on curriculum_skills for delete using (org_id = my_org_id() and my_role() = 'owner');

create policy "view assigned or all students" on students for select using (
  org_id = my_org_id() and (my_role() = 'owner' or instructor_id = auth.uid())
);
create policy "owner inserts students" on students for insert with check (org_id = my_org_id() and my_role() = 'owner');
create policy "owner updates students" on students for update using (org_id = my_org_id() and my_role() = 'owner') with check (org_id = my_org_id() and my_role() = 'owner');
create policy "owner deletes students" on students for delete using (org_id = my_org_id() and my_role() = 'owner');

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

create or replace function create_org_and_owner(org_name text, name_in text)
returns uuid
language plpgsql security definer
as $$
declare
  new_org_id uuid;
  my_email text;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'You already belong to a school.';
  end if;
  select email into my_email from auth.users where id = auth.uid();
  insert into organizations (name) values (org_name) returning id into new_org_id;
  insert into profiles (id, org_id, role, display_name, email)
    values (auth.uid(), new_org_id, 'owner', nullif(name_in, ''), my_email);
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

create or replace function get_student_progress(code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
  sid uuid;
  oid uuid;
begin
  select id, org_id into sid, oid from students where access_code = code;
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
      where l.org_id = oid
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
