-- Snapshot product cost at sale time for stable COGS
alter table public.sale_items
  add column if not exists unit_cost numeric(12, 2) not null default 0;

comment on column public.sale_items.unit_cost is
  'Product cost snapshot at sale (0 for services/packages). Used for COGS.';

-- Backfill historical product lines from current catalog (best available)
update public.sale_items si
set unit_cost = coalesce(p.cost_price, 0)
from public.products p
where si.item_type = 'PRODUCT'
  and si.item_id = p.id
  and si.unit_cost = 0;

-- Prevent oversell: reject OUT when stock is insufficient (was silently clamping to 0).
create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock int;
begin
  if new.type = 'IN' then
    update public.products
    set stock_quantity = stock_quantity + new.quantity
    where id = new.product_id;
  elsif new.type = 'OUT' then
    select stock_quantity into current_stock
    from public.products
    where id = new.product_id
    for update;

    if current_stock is null then
      raise exception 'Product not found for inventory OUT';
    end if;

    if current_stock < new.quantity then
      raise exception 'Insufficient stock (have %, need %)', current_stock, new.quantity;
    end if;

    update public.products
    set stock_quantity = stock_quantity - new.quantity
    where id = new.product_id;
  elsif new.type = 'ADJUSTMENT' then
    update public.products
    set stock_quantity = new.quantity
    where id = new.product_id;
  end if;
  return new;
end;
$$;
