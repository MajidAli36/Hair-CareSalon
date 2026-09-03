-- Run AFTER combined-migration.sql
-- Creates salon login accounts + organization roles + demo data.
-- All demo passwords: Salon123!

create or replace function public.seed_auth_user(p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = auth, public, extensions
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = p_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', p_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    );
  else
    update auth.users
    set
      encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change = coalesce(email_change, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      phone_change = coalesce(phone_change, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      reauthentication_token = coalesce(reauthentication_token, '')
    where id = v_user_id;
  end if;

  return v_user_id;
end;
$$;

do $$
declare
  v_org_id uuid;
  v_hair_cat uuid;
  v_nail_cat uuid;
  v_owner uuid;
begin
  v_owner := public.seed_auth_user('owner@salon.com', 'Salon123!');

  perform public.seed_auth_user('admin@salon.com', 'Salon123!');
  perform public.seed_auth_user('manager@salon.com', 'Salon123!');
  perform public.seed_auth_user('cashier@salon.com', 'Salon123!');
  perform public.seed_auth_user('reception@salon.com', 'Salon123!');
  perform public.seed_auth_user('staff@salon.com', 'Salon123!');

  insert into public.organizations (name, slug)
  values ('Hair & Care Salon', 'hair-salon')
  on conflict (slug) do update set name = excluded.name
  returning id into v_org_id;

  if v_org_id is null then
    select id into v_org_id from public.organizations where slug = 'hair-salon';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  select v_org_id, u.id, m.role
  from (
    values
      ('owner@salon.com', 'OWNER'::public.member_role),
      ('admin@salon.com', 'ADMIN'::public.member_role),
      ('manager@salon.com', 'MANAGER'::public.member_role),
      ('cashier@salon.com', 'CASHIER'::public.member_role),
      ('reception@salon.com', 'RECEPTIONIST'::public.member_role),
      ('staff@salon.com', 'STAFF'::public.member_role)
  ) as m(email, role)
  join auth.users u on u.email = m.email
  on conflict (organization_id, user_id) do update set role = excluded.role;

  if not exists (select 1 from public.services where organization_id = v_org_id limit 1) then
    insert into public.service_categories (organization_id, name, sort_order)
    values
      (v_org_id, 'Hair', 1),
      (v_org_id, 'Nails', 2);

    select id into v_hair_cat from public.service_categories
    where organization_id = v_org_id and name = 'Hair';

    select id into v_nail_cat from public.service_categories
    where organization_id = v_org_id and name = 'Nails';

    insert into public.services (organization_id, category_id, name, price, duration_minutes)
    values
      (v_org_id, v_hair_cat, 'Haircut', 1500, 45),
      (v_org_id, v_hair_cat, 'Hair Color', 4500, 120),
      (v_org_id, v_nail_cat, 'Manicure', 1200, 40);

    insert into public.staff (organization_id, full_name, job_title, pin_code, phone, online_booking_enabled)
    values (v_org_id, 'Ayesha Khan', 'Senior Stylist', '1234', '+923001234567', true);

    insert into public.staff_schedules (organization_id, staff_id, day_of_week, start_time, end_time)
    select v_org_id, s.id, d.day_of_week, '09:00', '18:00'
    from public.staff s
    cross join (select generate_series(1, 6) as day_of_week) d
    where s.organization_id = v_org_id and s.full_name = 'Ayesha Khan';

    insert into public.customers (organization_id, first_name, last_name, phone, email, tags)
    values (v_org_id, 'Sara', 'Ahmed', '+923009876543', 'sara@example.com', array['VIP']);
  end if;

  raise notice 'Seed complete — owner %, org %', v_owner, v_org_id;
end $$;

drop function if exists public.seed_auth_user(text, text);
