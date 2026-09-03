-- Allow staff to update outbound WhatsApp message status (queue delivery updates).
create policy "staff_update_whatsapp_outbound"
  on public.whatsapp_messages for update to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST')
  );
