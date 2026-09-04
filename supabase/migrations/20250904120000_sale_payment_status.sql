-- Customer due / partial payment: separate payment status from sale status

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sale_payment_status') then
    create type public.sale_payment_status as enum (
      'UNPAID',
      'PARTIALLY_PAID',
      'PAID',
      'PARTIALLY_REFUNDED',
      'REFUNDED'
    );
  end if;
end $$;

alter table public.sales
  add column if not exists payment_status public.sale_payment_status not null default 'PAID',
  add column if not exists amount_paid numeric(12, 2) not null default 0,
  add column if not exists amount_refunded numeric(12, 2) not null default 0,
  add column if not exists amount_due numeric(12, 2) not null default 0,
  add column if not exists payment_version integer not null default 1;

comment on column public.sales.payment_status is 'Independent of sale status; derived from payments vs total';
comment on column public.sales.amount_due is 'Receivable remaining; never a discount. Void/refunded sales force 0.';

alter table public.payments
  add column if not exists created_by uuid references auth.users (id),
  add column if not exists notes text,
  add column if not exists tendered_amount numeric(12, 2),
  add column if not exists change_given numeric(12, 2);

-- Tighten amount > 0 going forward (drop old >= 0 check if present)
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.payments'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%amount%';
  if cname is not null then
    execute format('alter table public.payments drop constraint %I', cname);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_amount_positive'
  ) then
    alter table public.payments
      add constraint payments_amount_positive check (amount > 0);
  end if;
end $$;

create index if not exists sales_payment_status_org_idx
  on public.sales (organization_id, payment_status);

create index if not exists sales_amount_due_org_idx
  on public.sales (organization_id, amount_due)
  where amount_due > 0;

create index if not exists payments_sale_paid_at_idx
  on public.payments (sale_id, paid_at);

-- Backfill denormalized payment fields from ledger
with pay as (
  select sale_id, coalesce(sum(amount), 0) as paid
  from public.payments
  group by sale_id
),
ref as (
  select sale_id, coalesce(sum(amount), 0) as refunded
  from public.sale_refunds
  group by sale_id
)
update public.sales s
set
  amount_paid = coalesce(p.paid, 0),
  amount_refunded = coalesce(r.refunded, 0),
  amount_due = case
    when s.status in ('VOID', 'REFUNDED') then 0
    else greatest(0, round((s.total - coalesce(p.paid, 0) + coalesce(r.refunded, 0))::numeric, 2))
  end,
  payment_status = case
    when s.status = 'VOID' then
      case
        when coalesce(r.refunded, 0) > 0 and coalesce(r.refunded, 0) >= coalesce(p.paid, 0) then 'REFUNDED'::public.sale_payment_status
        when coalesce(r.refunded, 0) > 0 then 'PARTIALLY_REFUNDED'::public.sale_payment_status
        when coalesce(p.paid, 0) <= 0 then 'UNPAID'::public.sale_payment_status
        else 'PAID'::public.sale_payment_status
      end
    when s.status = 'REFUNDED' then 'REFUNDED'::public.sale_payment_status
    when coalesce(r.refunded, 0) > 0 and coalesce(r.refunded, 0) >= coalesce(p.paid, 0) and coalesce(p.paid, 0) > 0
      then 'REFUNDED'::public.sale_payment_status
    when coalesce(r.refunded, 0) > 0
      then 'PARTIALLY_REFUNDED'::public.sale_payment_status
    when coalesce(p.paid, 0) <= 0 then 'UNPAID'::public.sale_payment_status
    when round((s.total - coalesce(p.paid, 0) + coalesce(r.refunded, 0))::numeric, 2) > 0
      then 'PARTIALLY_PAID'::public.sale_payment_status
    else 'PAID'::public.sale_payment_status
  end
from pay p
full outer join ref r on r.sale_id = p.sale_id
where s.id = coalesce(p.sale_id, r.sale_id);

-- Sales with no payment/refund rows yet
update public.sales s
set
  amount_paid = 0,
  amount_refunded = 0,
  amount_due = case when s.status in ('VOID', 'REFUNDED') then 0 else greatest(0, s.total) end,
  payment_status = case
    when s.status = 'REFUNDED' then 'REFUNDED'::public.sale_payment_status
    when s.status = 'VOID' then 'UNPAID'::public.sale_payment_status
    when s.total <= 0 then 'PAID'::public.sale_payment_status
    else 'UNPAID'::public.sale_payment_status
  end
where not exists (select 1 from public.payments p where p.sale_id = s.id)
  and not exists (select 1 from public.sale_refunds r where r.sale_id = s.id);
