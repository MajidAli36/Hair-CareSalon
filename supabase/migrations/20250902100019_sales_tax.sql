-- Optional tax on sales (PKR amount, 0 when not applied)
alter table public.sales
  add column if not exists tax numeric(10, 2) not null default 0 check (tax >= 0);
