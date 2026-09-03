-- Staff attendance
create type public.attendance_method as enum ('MANUAL', 'DEVICE', 'APP');

create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  device_id uuid,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  method public.attendance_method not null default 'MANUAL',
  notes text,
  created_at timestamptz not null default now()
);

create index staff_attendance_staff_idx on public.staff_attendance (staff_id, check_in_at desc);
create index staff_attendance_org_idx on public.staff_attendance (organization_id, check_in_at desc);

alter table public.staff_attendance enable row level security;

create policy "members_select_staff_attendance"
  on public.staff_attendance for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_staff_attendance"
  on public.staff_attendance for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
    or public.user_org_role(organization_id) in ('RECEPTIONIST', 'CASHIER', 'STAFF')
  );

create policy "managers_update_staff_attendance"
  on public.staff_attendance for update to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST'));

-- Devices (attendance terminal, cash drawer, receipt printer)
create type public.device_type as enum ('ATTENDANCE', 'DRAWER', 'PRINTER', 'TOKEN_KIOSK');
create type public.device_command_type as enum ('OPEN_DRAWER', 'CLOSE_DRAWER', 'PRINT_RECEIPT', 'PRINT_TOKEN');
create type public.device_command_status as enum ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  type public.device_type not null,
  api_key text not null unique default encode(gen_random_bytes(32), 'hex'),
  location text,
  is_active boolean not null default true,
  auto_registered boolean not null default false,
  last_seen_at timestamptz,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index devices_org_idx on public.devices (organization_id);
create index devices_api_key_idx on public.devices (api_key);

create trigger devices_set_updated_at
  before update on public.devices
  for each row execute function public.set_updated_at();

alter table public.devices enable row level security;

create table public.device_commands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  device_id uuid not null references public.devices (id) on delete cascade,
  command public.device_command_type not null,
  payload jsonb not null default '{}',
  status public.device_command_status not null default 'PENDING',
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index device_commands_device_pending_idx
  on public.device_commands (device_id, status)
  where status = 'PENDING';

alter table public.device_commands enable row level security;

-- FK for device_id on queue_tokens and staff_attendance
alter table public.queue_tokens
  add constraint queue_tokens_device_id_fkey
  foreign key (device_id) references public.devices (id) on delete set null;

alter table public.staff_attendance
  add constraint staff_attendance_device_id_fkey
  foreign key (device_id) references public.devices (id) on delete set null;

-- RLS devices
create policy "managers_select_devices"
  on public.devices for select to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_insert_devices"
  on public.devices for insert to authenticated
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_update_devices"
  on public.devices for update to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_delete_devices"
  on public.devices for delete to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_select_device_commands"
  on public.device_commands for select to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER'));

create policy "staff_insert_device_commands"
  on public.device_commands for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'RECEPTIONIST')
  );

create policy "staff_update_device_commands"
  on public.device_commands for update to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'RECEPTIONIST')
  );
