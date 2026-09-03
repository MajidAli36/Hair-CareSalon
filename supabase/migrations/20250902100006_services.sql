-- Service categories
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index service_categories_org_idx on public.service_categories (organization_id);

create trigger service_categories_set_updated_at
  before update on public.service_categories
  for each row execute function public.set_updated_at();

alter table public.service_categories enable row level security;

-- Services
create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category_id uuid references public.service_categories (id) on delete set null,
  name text not null,
  description text,
  price numeric(10, 2) not null default 0 check (price >= 0),
  duration_minutes int not null default 30 check (duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_organization_id_idx on public.services (organization_id);
create index services_category_id_idx on public.services (category_id);
create index services_active_idx on public.services (organization_id, is_active);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

alter table public.services enable row level security;

-- All members can read categories and services
create policy "members_select_service_categories"
  on public.service_categories
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "members_select_services"
  on public.services
  for select
  to authenticated
  using (public.is_org_member(organization_id));

-- MANAGER+ can manage categories
create policy "managers_insert_service_categories"
  on public.service_categories
  for insert
  to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_update_service_categories"
  on public.service_categories
  for update
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_delete_service_categories"
  on public.service_categories
  for delete
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

-- MANAGER+ can manage services (price changes)
create policy "managers_insert_services"
  on public.services
  for insert
  to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_update_services"
  on public.services
  for update
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_delete_services"
  on public.services
  for delete
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );
