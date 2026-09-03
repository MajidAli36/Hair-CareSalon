-- Appointments
create type public.appointment_status as enum (
  'SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'
);
create type public.appointment_source as enum ('WALK_IN', 'PHONE', 'ONLINE', 'STAFF');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  staff_id uuid references public.staff (id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30 check (duration_minutes > 0),
  status public.appointment_status not null default 'SCHEDULED',
  source public.appointment_source not null default 'STAFF',
  notes text,
  manual_payment_amount numeric(10, 2) check (manual_payment_amount is null or manual_payment_amount >= 0),
  manual_payment_method public.payment_method,
  manual_payment_notes text,
  manual_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_org_idx on public.appointments (organization_id, scheduled_at);
create index appointments_status_idx on public.appointments (organization_id, status);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

create table public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  service_name text not null,
  price numeric(10, 2) not null default 0,
  duration_minutes int not null default 30,
  created_at timestamptz not null default now()
);

create index appointment_services_appt_idx on public.appointment_services (appointment_id);

alter table public.appointment_services enable row level security;

-- RLS appointments
create policy "members_select_appointments"
  on public.appointments for select to authenticated
  using (public.is_org_member(organization_id));

create policy "receptionist_insert_appointments"
  on public.appointments for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER')
  );

create policy "receptionist_update_appointments"
  on public.appointments for update to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER', 'STAFF')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER', 'STAFF')
  );

create policy "managers_delete_appointments"
  on public.appointments for delete to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "members_select_appointment_services"
  on public.appointment_services for select to authenticated
  using (public.is_org_member(organization_id));

create policy "receptionist_insert_appointment_services"
  on public.appointment_services for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER')
  );

-- Public online booking: allow anon insert when org slug matches (via service role in API)
