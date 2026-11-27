-- Rinomina colonne provider-specifiche da GoCardless a Enable Banking
-- gc_account_id -> eb_account_id (bank_accounts)
-- gc_transaction_id -> eb_transaction_id (bank_transactions)
-- Aggiunge session_id a bank_requisitions per tracciare la sessione Enable Banking

ALTER TABLE public.bank_accounts
  DROP CONSTRAINT IF EXISTS bank_accounts_gc_account_id_key;

ALTER TABLE public.bank_accounts
  RENAME COLUMN gc_account_id TO eb_account_id;

ALTER TABLE public.bank_accounts
  ADD CONSTRAINT bank_accounts_eb_account_id_key UNIQUE (eb_account_id);

ALTER TABLE public.bank_transactions
  DROP CONSTRAINT IF EXISTS bank_transactions_account_id_gc_transaction_id_key;

ALTER TABLE public.bank_transactions
  RENAME COLUMN gc_transaction_id TO eb_transaction_id;

ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_account_id_eb_transaction_id_key UNIQUE (account_id, eb_transaction_id);

ALTER TABLE public.bank_requisitions
  ADD COLUMN IF NOT EXISTS session_id text;
