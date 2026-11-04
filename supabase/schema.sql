-- Billionaire Swipe schema (applied to Supabase project "billionaire" as migration init_schema)

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Anonymous',
  is_patron boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 3 and 80),
  story text not null default '' check (char_length(story) <= 600),
  category text not null default 'other' check (category in ('rent','medical','utilities','education','food','debt','other')),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  currency text not null default 'USD' check (char_length(currency) = 3),
  payment_link text check (payment_link is null or payment_link ~* '^https://'),
  image_path text,
  status text not null default 'open' check (status in ('open','pledged','paid','removed')),
  pledged_by uuid references auth.users(id) on delete set null,
  pledged_at timestamptz,
  paid_at timestamptz,
  report_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index bills_status_idx on public.bills(status, created_at desc);
create index bills_user_idx on public.bills(user_id);
create index bills_pledged_by_idx on public.bills(pledged_by);

create table public.swipes (
  patron_id uuid not null references auth.users(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  direction text not null check (direction in ('left','right')),
  created_at timestamptz not null default now(),
  primary key (patron_id, bill_id)
);
create index swipes_bill_idx on public.swipes(bill_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  reason text not null check (char_length(reason) between 3 and 300),
  created_at timestamptz not null default now(),
  unique (bill_id, reporter_id)
);
create index reports_reporter_idx on public.reports(reporter_id);

alter table public.profiles enable row level security;
alter table public.bills enable row level security;
alter table public.swipes enable row level security;
alter table public.reports enable row level security;

create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "bills visible" on public.bills for select to authenticated
  using (status = 'open' or user_id = (select auth.uid()) or pledged_by = (select auth.uid()));
create policy "insert own bills" on public.bills for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and pledged_by is null);
create policy "owner updates own bills" on public.bills for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner deletes own bills" on public.bills for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "read own swipes" on public.swipes for select to authenticated using (patron_id = (select auth.uid()));
create policy "insert own report" on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "read own report" on public.reports for select to authenticated using (reporter_id = (select auth.uid()));

create or replace function public.bills_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('app.rpc', true) = 'on' then
    return new;
  end if;
  if new.pledged_by is distinct from old.pledged_by
     or new.pledged_at is distinct from old.pledged_at
     or new.report_count is distinct from old.report_count then
    raise exception 'not allowed';
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'pledged' and new.status = 'paid')
            or new.status = 'removed') then
      raise exception 'invalid status change';
    end if;
    if new.status = 'paid' then new.paid_at := now(); end if;
  end if;
  return new;
end $$;
create trigger bills_guard before update on public.bills for each row execute function public.bills_guard();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1), 'Anonymous'))
  on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.next_bills(lim integer default 10)
returns setof public.bills language sql stable security invoker set search_path = '' as $$
  select b.* from public.bills b
  where b.status = 'open'
    and b.user_id <> (select auth.uid())
    and b.report_count < 3
    and not exists (select 1 from public.swipes s where s.bill_id = b.id and s.patron_id = (select auth.uid()))
  order by b.created_at desc
  limit least(greatest(lim,1),50);
$$;

create or replace function public.swipe(p_bill uuid, p_direction text)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); b public.bills;
begin
  if uid is null then raise exception 'sign in required'; end if;
  if p_direction not in ('left','right') then raise exception 'bad direction'; end if;
  select * into b from public.bills where id = p_bill for update;
  if not found then raise exception 'bill not found'; end if;
  if b.user_id = uid then raise exception 'cannot swipe your own bill'; end if;
  insert into public.swipes(patron_id, bill_id, direction) values (uid, p_bill, p_direction)
    on conflict (patron_id, bill_id) do update set direction = excluded.direction, created_at = now();
  if p_direction = 'right' then
    if b.status <> 'open' then return 'taken'; end if;
    perform set_config('app.rpc','on',true);
    update public.bills set status = 'pledged', pledged_by = uid, pledged_at = now() where id = p_bill;
    perform set_config('app.rpc','off',true);
    return 'pledged';
  end if;
  return 'skipped';
end $$;

create or replace function public.release_pledge(p_bill uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.rpc','on',true);
  update public.bills set status = 'open', pledged_by = null, pledged_at = null
   where id = p_bill and pledged_by = auth.uid() and status = 'pledged';
  perform set_config('app.rpc','off',true);
  if not found then raise exception 'not your pledge'; end if;
end $$;

create or replace function public.report_bill(p_bill uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  insert into public.reports(bill_id, reporter_id, reason) values (p_bill, auth.uid(), p_reason);
  perform set_config('app.rpc','on',true);
  update public.bills set report_count = report_count + 1 where id = p_bill;
  perform set_config('app.rpc','off',true);
end $$;

create or replace function public.stats()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'open', (select count(*) from public.bills where status='open'),
    'pledged', (select count(*) from public.bills where status='pledged'),
    'paid', (select count(*) from public.bills where status='paid'),
    'paid_cents', (select coalesce(sum(amount_cents),0) from public.bills where status='paid')
  );
$$;

revoke execute on function public.swipe(uuid,text) from public, anon;
revoke execute on function public.release_pledge(uuid) from public, anon;
revoke execute on function public.report_bill(uuid,text) from public, anon;
revoke execute on function public.next_bills(integer) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.swipe(uuid,text) to authenticated;
grant execute on function public.release_pledge(uuid) to authenticated;
grant execute on function public.report_bill(uuid,text) to authenticated;
grant execute on function public.next_bills(integer) to authenticated;
grant execute on function public.stats() to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bills','bills', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "upload own bill images" on storage.objects for insert to authenticated
  with check (bucket_id = 'bills' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own bill images" on storage.objects for delete to authenticated
  using (bucket_id = 'bills' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "signed-in users view bill images" on storage.objects for select to authenticated
  using (bucket_id = 'bills');
