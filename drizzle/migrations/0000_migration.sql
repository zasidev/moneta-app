CREATE TABLE public.bank_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  requisition_id text NOT NULL UNIQUE,
  reference text NOT NULL UNIQUE,
  institution_id text NOT NULL,
  institution_name text,
  status text NOT NULL DEFAULT 'CR',
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  requisition_id uuid NOT NULL REFERENCES public.bank_requisitions(id) ON DELETE CASCADE,
  gc_account_id text NOT NULL UNIQUE,
  iban text,
  name text,
  currency text,
  balance numeric,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  gc_transaction_id text NOT NULL,
  booking_date date,
  amount numeric NOT NULL,
  currency text,
  description text,
  counterparty text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, gc_transaction_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_requisitions, public.bank_accounts, public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_requisitions, public.bank_accounts, public.bank_transactions TO service_role;
ALTER TABLE public.bank_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own requisitions" ON public.bank_requisitions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own accounts" ON public.bank_accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own transactions" ON public.bank_transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.bank_transactions (user_id, booking_date DESC);