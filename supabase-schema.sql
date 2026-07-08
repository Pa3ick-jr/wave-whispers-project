-- ============================================================
-- Wave Whispers / Lanebook — Supabase schema
-- Run this ONCE in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste all of this -> Run)
-- ============================================================

-- Levels in your curriculum (e.g. "Water Comfort")
create table if not exists curriculum_levels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

-- Skills inside each level (e.g. "Front float")
create table if not exists curriculum_skills (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references curriculum_levels(id) on delete cascade,
  owner_id uuid not null default auth.uid(),
  name text not null,
  position int not null default 0
);

-- Students / swimmers
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  access_code text unique not null,
  created_at date default current_date
);

-- Per-student status of each skill
create table if not exists student_skills (
  student_id uuid references students(id) on delete cascade,
  skill_id uuid references curriculum_skills(id) on delete cascade,
  status text not null default 'not_started',
  primary key (student_id, skill_id)
);

-- Session log entries
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  date date not null,
  note text,
  goal text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Row Level Security: only the signed-in instructor (you) can
-- read/write their own data via the admin dashboard.
-- ------------------------------------------------------------
alter table curriculum_levels enable row level security;
alter table curriculum_skills enable row level security;
alter table students enable row level security;
alter table student_skills enable row level security;
alter table sessions enable row level security;

create policy "owner manages levels" on curriculum_levels
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owner manages skills" on curriculum_skills
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owner manages students" on students
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owner manages student_skills" on student_skills
  for all using (exists (select 1 from students s where s.id = student_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from students s where s.id = student_id and s.owner_id = auth.uid()));

create policy "owner manages sessions" on sessions
  for all using (exists (select 1 from students s where s.id = student_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from students s where s.id = student_id and s.owner_id = auth.uid()));

-- ------------------------------------------------------------
-- Student/parent access: no login account needed. This function
-- looks up ONE student by their access code and returns only
-- that student's progress + curriculum + sessions as JSON.
-- It runs with elevated privileges (security definer) so it can
-- bypass the owner-only RLS above, but it never exposes anything
-- beyond the single matching student.
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
  oid uuid;
begin
  select id, owner_id into sid, oid from students where access_code = code;
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
      where l.owner_id = oid
    ),
    'sessions', (
      select coalesce(json_agg(json_build_object('date', date, 'note', note, 'goal', goal) order by date desc), '[]'::json)
      from sessions where student_id = sid
    )
  ) into result;

  return result;
end;
$$;

-- Allow anyone (no login) to call this function — it only ever
-- returns data for the one student whose code they typed in.
grant execute on function get_student_progress(text) to anon;
