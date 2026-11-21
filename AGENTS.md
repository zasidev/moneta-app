<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Authenticated views share AppTopbar with theme state passed from each view; why: a single preference owner avoids competing theme writes while providing consistent account controls.
- Transaction exclusions use a separate owner-scoped table and shared statistics filtering; why: provider sync must not overwrite exclusions or remove the original movement.
- Deposit CRUD uses authenticated server functions and a browser-safe date-based calculator; why: ownership is enforced and daily accrued value needs no scheduled writes.
- Authenticated pages share AppNavigation with a mobile-only fixed bottom layout below 768px; why: consistent destinations and safe-area clearance across financial views.
- Custom investment table types extend the generated schema in a separate typed client adapter without replacing the session; why: externally managed tables must compile while preserving per-user RLS.
- GoCardless Bank Account Data calls live only in `src/lib/gocardless.server.ts` and are invoked from authenticated server functions in `src/lib/banking.functions.ts`; why: the secret id/key must never reach the browser and each user's data stays under RLS.
- Bank sync is user-triggered (button + automatic run on return from the bank with `?ref=`), upserting by provider ids; why: idempotent re-syncs without duplicate transactions.
- Dashboard display preferences live in a browser-only hook and financial formatting is centralized; why: persistent theme/privacy settings must not expose amounts through charts or secondary views.
- Dashboard charts use synchronized transactions, grouped by month and account, without invented categories; why: the bank schema does not provide category assignments.
- Database custom (investimenti): per tabelle non gestite da Lovable (es. `investment_holdings`, `investment_prices`) Kilo può creare migration SQL in `supabase/migrations/` su richiesta dell'utente; per le tabelle bancarie esistenti (`bank_accounts`, `bank_transactions`, `bank_requisitions`) resta valida la regola di interagire tramite Lovable.
