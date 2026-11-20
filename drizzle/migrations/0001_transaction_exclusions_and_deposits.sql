CREATE TABLE public.transaction_exclusions (
 transaction_id uuid PRIMARY KEY REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.transaction_exclusions TO authenticated;
GRANT ALL ON public.transaction_exclusions TO service_role;
ALTER TABLE public.transaction_exclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own exclusions" ON public.transaction_exclusions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own exclusions" ON public.transaction_exclusions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.bank_transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()));
CREATE POLICY "delete own exclusions" ON public.transaction_exclusions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TABLE public.deposit_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 name text NOT NULL,
 principal numeric NOT NULL CHECK (principal > 0),
 currency text NOT NULL DEFAULT 'EUR',
 annual_rate numeric NOT NULL CHECK (annual_rate >= 0 AND annual_rate <= 100),
 start_date date NOT NULL,
 end_date date,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (end_date IS NULL OR end_date >= start_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit_accounts TO authenticated;
GRANT ALL ON public.deposit_accounts TO service_role;
ALTER TABLE public.deposit_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deposits" ON public.deposit_accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);