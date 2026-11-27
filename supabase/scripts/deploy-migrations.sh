#!/usr/bin/env bash
set -euo pipefail

# Applica le migration SQL in supabase/migrations/ (stile Flyway/Liquibase:
# i file numerati vengono applicati in ordine, una sola volta ciascuno).
# Richiede: supabase CLI installato e loggato.
# Uso: ./supabase/deploy-migrations.sh

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

echo "Applicazione migration in supabase/migrations/..."
supabase db push

echo "Migration applicate."
