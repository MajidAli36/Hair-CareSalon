-- Multiple stylists per sale (equal-share performance credit)

create table if not exists public.sale_staff (
  sale_id uuid not null references public.sales (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sale_id, staff_id)
);

create index if not exists sale_staff_org_staff_idx
  on public.sale_staff (organization_id, staff_id);

create index if not exists sale_staff_sale_idx
  on public.sale_staff (sale_id);

alter table public.sale_staff enable row level security;

create policy "members_select_sale_staff"
  on public.sale_staff for select to authenticated
  using (public.is_org_member(organization_id));

create policy "cashiers_insert_sale_staff"
  on public.sale_staff for insert to authenticated
  with check (
    public.user_org_role(organization_id) in (
      'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'RECEPTIONIST'
    )
  );

create policy "cashiers_delete_sale_staff"
  on public.sale_staff for delete to authenticated
  using (
    public.user_org_role(organization_id) in (
      'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'RECEPTIONIST'
    )
  );

-- Backfill from existing sales.staff_id
insert into public.sale_staff (sale_id, staff_id, organization_id)
select s.id, s.staff_id, s.organization_id
from public.sales s
where s.staff_id is not null
on conflict do nothing;

comment on table public.sale_staff is
  'Stylists who served on a sale; revenue is split equally in staff reports';
