-- Staff profiles (salon employees, may or may not have app login)
create type public.staff_status as enum ('ACTIVE', 'INACTIVE');

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid references public.organization_members (id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  job_title text,
  pin_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_org_idx on public.staff (organization_id);

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

alter table public.staff enable row level security;

create policy "members_select_staff"
  on public.staff for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_staff"
  on public.staff for insert to authenticated
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_update_staff"
  on public.staff for update to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'))
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_delete_staff"
  on public.staff for delete to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

-- Staff schedules (weekly availability)
create table public.staff_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  unique (staff_id, day_of_week)
);

alter table public.staff_schedules enable row level security;

create policy "members_select_staff_schedules"
  on public.staff_schedules for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_manage_staff_schedules"
  on public.staff_schedules for all to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'))
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));
