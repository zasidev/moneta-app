-- Aggiunge unique constraint su gc_account_id per permettere l'upsert idempotente
-- dei conti bancari sincronizzati da GoCardless.
ALTER TABLE public.bank_accounts
  ADD CONSTRAINT bank_accounts_gc_account_id_key UNIQUE (gc_account_id);
