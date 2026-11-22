-- Grant privileges on transaction_exclusions to authenticated role
-- (the drizzle migration that created this table may not have been applied
--  to production with its GRANTs, causing permission denied errors)
grant select, insert, delete on public.transaction_exclusions to authenticated;
grant all on public.transaction_exclusions to service_role;

alter table public.transaction_exclusions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'transaction_exclusions' and policyname = 'read own exclusions') then
    create policy "read own exclusions" on public.transaction_exclusions
      for select to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'transaction_exclusions' and policyname = 'insert own exclusions') then
    create policy "insert own exclusions" on public.transaction_exclusions
      for insert to authenticated
      with check (auth.uid() = user_id and exists (select 1 from public.bank_transactions t where t.id = transaction_id and t.user_id = auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'transaction_exclusions' and policyname = 'delete own exclusions') then
    create policy "delete own exclusions" on public.transaction_exclusions
      for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
