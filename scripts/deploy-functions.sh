#!/usr/bin/env bash
set -euo pipefail

# Deploy Supabase Edge Functions
# Usage: ./deploy-functions.sh [--project-ref <ref>] [--region <region>]

PROJECT_REF=""
REGION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-ref) PROJECT_REF="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

FUNCTIONS=(balances accounts transactions)

for fn in "${FUNCTIONS[@]}"; do
  echo "Deploying function: $fn"
  if [[ -n "$PROJECT_REF" ]]; then
    npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF" ${REGION:+--region "$REGION"}
  else
    npx supabase functions deploy "$fn" ${REGION:+--region "$REGION"}
  fi
done

echo "All functions deployed."
