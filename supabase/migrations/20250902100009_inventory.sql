-- Inventory transactions
create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  type public.inventory_transaction_type not null,
  quantity int not null check (quantity > 0),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_transactions_product_idx on public.inventory_transactions (product_id);
create index inventory_transactions_org_idx on public.inventory_transactions (organization_id);

alter table public.inventory_transactions enable row level security;

-- Auto-update product stock when inventory transaction is inserted
create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'IN' then
    update public.products
    set stock_quantity = stock_quantity + new.quantity
    where id = new.product_id;
  elsif new.type = 'OUT' then
    update public.products
    set stock_quantity = greatest(0, stock_quantity - new.quantity)
    where id = new.product_id;
  elsif new.type = 'ADJUSTMENT' then
    update public.products
    set stock_quantity = new.quantity
    where id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger inventory_transactions_apply_stock
  after insert on public.inventory_transactions
  for each row execute function public.apply_inventory_transaction();

-- RLS: inventory
create policy "members_select_inventory_transactions"
  on public.inventory_transactions for select to authenticated
  using (public.is_org_member(organization_id));

-- CASHIER+ can record stock OUT (sales); MANAGER+ can do all types
create policy "cashiers_insert_inventory_out"
  on public.inventory_transactions for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
    and type = 'OUT'
  );

create policy "managers_insert_inventory_in_adjust"
  on public.inventory_transactions for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
    and type in ('IN', 'ADJUSTMENT')
  );
