#!/usr/bin/env bash
set -euo pipefail

# Deploy delle Supabase Edge Functions.
# Richiede: supabase CLI installato e loggato.
# Uso: ./supabase/deploy-functions.sh

FUNCTIONS=(
  accounts
  balances
  transactions
  enablebanking-institutions
  enablebanking-auth
  enablebanking-callback
  enablebanking-sync
)

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Errore: imposta SUPABASE_ACCESS_TOKEN" >&2
  exit 1
fi
if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "Errore: imposta SUPABASE_PROJECT_REF" >&2
  exit 1
fi

echo "Login Supabase..."
supabase login --token "$SUPABASE_ACCESS_TOKEN"

echo "Link progetto $SUPABASE_PROJECT_REF..."
supabase link --project-ref "$SUPABASE_PROJECT_REF"

echo "Deploy edge functions..."
supabase functions deploy --yes "${FUNCTIONS[@]}"

echo "Deploy completato."
