-- Enable extensions
create extension if not exists pgcrypto;

-- 1. bank_requisitions (no FK dependencies)
create table if not exists bank_requisitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  requisition_id text not null,
  institution_id text not null,
  institution_name text,
  reference text not null,
  status text not null,
  link text,
  created_at timestamptz default now()
);

-- 2. bank_accounts (references bank_requisitions)
create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  requisition_id uuid references bank_requisitions(id) not null,
  gc_account_id text not null,
  iban text,
  name text,
  currency text,
  balance numeric,
  last_synced_at timestamptz,
  created_at timestamptz default now()
);

-- 3. bank_transactions (references bank_accounts)
create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  account_id uuid references bank_accounts(id) not null,
  gc_transaction_id text not null,
  booking_date timestamptz,
  amount numeric not null,
  currency text,
  description text,
  counterparty text,
  created_at timestamptz default now()
);

-- 4. investment_holdings
create table if not exists investment_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  ticker text not null,
  name text,
  currency text not null default 'EUR',
  quantity numeric not null check (quantity > 0),
  purchase_price numeric check (purchase_price >= 0),
  purchase_date date,
  platform text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. investment_prices
create table if not exists investment_prices (
  ticker text primary key,
  price numeric not null,
  currency text not null default 'EUR',
  fetched_at timestamptz default now()
);

-- Indexes
create index if not exists idx_bank_requisitions_user_id on bank_requisitions(user_id);
create index if not exists idx_bank_accounts_user_id on bank_accounts(user_id);
create index if not exists idx_bank_accounts_requisition_id on bank_accounts(requisition_id);
create index if not exists idx_bank_transactions_user_id on bank_transactions(user_id);
create index if not exists idx_bank_transactions_account_id on bank_transactions(account_id);
create index if not exists idx_bank_transactions_booking_date on bank_transactions(booking_date);
create index if not exists idx_investment_holdings_user_id on investment_holdings(user_id);

-- RLS
alter table bank_requisitions enable row level security;
alter table bank_accounts enable row level security;
alter table bank_transactions enable row level security;
alter table investment_holdings enable row level security;
alter table investment_prices enable row level security;

-- Policies (idempotent)
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'bank_requisitions' and policyname = 'users own requisitions') then
    create policy "users own requisitions" on bank_requisitions for all using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'bank_accounts' and policyname = 'users own accounts') then
    create policy "users own accounts" on bank_accounts for all using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'bank_transactions' and policyname = 'users own transactions') then
    create policy "users own transactions" on bank_transactions for all using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'investment_holdings' and policyname = 'users own holdings') then
    create policy "users own holdings" on investment_holdings for all using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'investment_prices' and policyname = 'prices readable by all') then
    create policy "prices readable by all" on investment_prices for select using (true);
  end if;
end $$;
