-- Helper: get the current user's role in an organization
create or replace function public.user_org_role(org_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.organization_members
  where user_id = auth.uid()
    and organization_id = org_id
  limit 1;
$$;

-- Helper: check if user is a member of an organization
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where user_id = auth.uid()
      and organization_id = org_id
  );
$$;

-- Organizations: members can read their own orgs
create policy "members_select_organizations"
  on public.organizations
  for select
  to authenticated
  using (public.is_org_member(id));

create policy "owners_admins_update_organizations"
  on public.organizations
  for update
  to authenticated
  using (
    public.user_org_role(id) in ('OWNER', 'ADMIN')
  )
  with check (
    public.user_org_role(id) in ('OWNER', 'ADMIN')
  );

-- Organization members: members can see co-members in their org
create policy "members_select_organization_members"
  on public.organization_members
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "owners_admins_insert_organization_members"
  on public.organization_members
  for insert
  to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN')
  );

create policy "owners_admins_update_organization_members"
  on public.organization_members
  for update
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN')
  );

create policy "owners_admins_delete_organization_members"
  on public.organization_members
  for delete
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN')
  );

-- Bootstrap: allow authenticated users to create their first organization
create policy "authenticated_insert_organizations"
  on public.organizations
  for insert
  to authenticated
  with check (true);

-- Bootstrap: allow users to add themselves as OWNER of a new org
create policy "self_insert_owner_membership"
  on public.organization_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'OWNER'
    and not exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
    )
  );
