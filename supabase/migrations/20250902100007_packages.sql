-- Packages (bundled services)
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null default 0 check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index packages_organization_id_idx on public.packages (organization_id);
create index packages_active_idx on public.packages (organization_id, is_active);

create trigger packages_set_updated_at
  before update on public.packages
  for each row execute function public.set_updated_at();

alter table public.packages enable row level security;

-- Package line items
create table public.package_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  package_id uuid not null references public.packages (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index package_items_package_id_idx on public.package_items (package_id);
create index package_items_organization_id_idx on public.package_items (organization_id);

alter table public.package_items enable row level security;

-- All members can read packages and items
create policy "members_select_packages"
  on public.packages
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "members_select_package_items"
  on public.package_items
  for select
  to authenticated
  using (public.is_org_member(organization_id));

-- MANAGER+ can manage packages
create policy "managers_insert_packages"
  on public.packages
  for insert
  to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_update_packages"
  on public.packages
  for update
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_delete_packages"
  on public.packages
  for delete
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

-- MANAGER+ can manage package items
create policy "managers_insert_package_items"
  on public.package_items
  for insert
  to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_update_package_items"
  on public.package_items
  for update
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_delete_package_items"
  on public.package_items
  for delete
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );
