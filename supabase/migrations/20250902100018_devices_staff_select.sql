-- Allow POS staff to look up registered devices (drawer, printer, etc.)
create policy "staff_select_devices"
  on public.devices for select to authenticated
  using (
    public.user_org_role(organization_id) in ('CASHIER', 'RECEPTIONIST')
  );
