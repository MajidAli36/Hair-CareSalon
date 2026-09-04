-- Wipe all business data. KEEP: organizations, organization_members (roles),
-- schema_migrations, enums, auth.users.

do $$
declare
  t text;
  wipe text[] := array[
    'sale_version_items',
    'sale_versions',
    'sale_refunds',
    'sale_items',
    'payments',
    'invoices',
    'sales',
    'inventory_transactions',
    'appointment_services',
    'appointment_deposits',
    'appointments',
    'queue_tokens',
    'staff_attendance',
    'staff_payments',
    'staff_schedules',
    'staff',
    'device_commands',
    'devices',
    'expenses',
    'whatsapp_messages',
    'audit_logs',
    'package_items',
    'packages',
    'products',
    'product_categories',
    'services',
    'service_categories',
    'customers',
    'chairs'
  ];
begin
  foreach t in array wipe loop
    if to_regclass('public.' || t) is not null then
      execute format('truncate table public.%I restart identity cascade', t);
      raise notice 'truncated %', t;
    end if;
  end loop;
end $$;
