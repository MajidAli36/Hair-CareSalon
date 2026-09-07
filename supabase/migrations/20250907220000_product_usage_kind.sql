-- Separate customer (retail) products from in-house (salon) products.
-- Same stock ledger; usage_kind controls where each product appears.

do $$ begin
  create type public.product_usage_kind as enum ('RETAIL', 'SALON', 'BOTH');
exception
  when duplicate_object then null;
end $$;

alter table public.products
  add column if not exists usage_kind public.product_usage_kind not null default 'BOTH';

comment on column public.products.usage_kind is
  'RETAIL = POS customer sale only; SALON = service consumable only; BOTH = either';

create index if not exists products_org_usage_kind_idx
  on public.products (organization_id, usage_kind)
  where deleted_at is null;
