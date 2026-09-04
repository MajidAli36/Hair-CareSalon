-- Attribute POS sales to a stylist (walk-in or override appointment staff)

alter table public.sales
  add column if not exists staff_id uuid references public.staff (id) on delete set null;

create index if not exists sales_staff_id_org_idx
  on public.sales (organization_id, staff_id)
  where staff_id is not null;

comment on column public.sales.staff_id is 'Stylist who performed the sale; used for staff performance when set';
