import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { listDeposits, saveDeposit, removeDeposit } from "@/lib/deposits.functions";
import { depositValue, italianDay } from "@/lib/deposit-calculation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type Deposit = Database["public"]["Tables"]["deposit_accounts"]["Row"];
const blank = () => ({ name: "", principal: "", currency: "EUR", annual_rate: "", start_date: italianDay(), end_date: "" });

export function DepositAccounts({ money, hidden }: { money: (value: number, currency: string) => string; hidden: boolean }) {
  const qc = useQueryClient();
  const deposits = useQuery({ queryKey: ["deposits"], queryFn: listDeposits });
  const save = useServerFn(saveDeposit);
  const remove = useServerFn(removeDeposit);
  const [today, setToday] = useState(italianDay());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | undefined>();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<Deposit | null>(null);
  useEffect(() => {
    const update = () => setToday(italianDay());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  function edit(deposit?: Deposit) {
    setEditing(deposit?.id);
    setForm(deposit ? { name: deposit.name, principal: String(deposit.principal), currency: deposit.currency, annual_rate: String(deposit.annual_rate), start_date: deposit.start_date, end_date: deposit.end_date ?? "" } : blank());
    setError(""); setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await save({ data: { ...(editing ? { id: editing } : {}), name: form.name, principal: Number(form.principal), currency: form.currency, annual_rate: Number(form.annual_rate), start_date: form.start_date, end_date: form.end_date || null } });
      await qc.invalidateQueries({ queryKey: ["deposits"] });
      setOpen(false); toast.success("Conto deposito salvato");
    } catch { setError("Salvataggio non riuscito. Controlla importi, tasso e date e riprova."); }
    finally { setBusy(false); }
  }
  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await remove({ data: { id: deleting.id } });
      await qc.invalidateQueries({ queryKey: ["deposits"] });
      setDeleting(null); toast.success("Conto deposito rimosso");
    } catch { toast.error("Rimozione non riuscita"); }
    finally { setBusy(false); }
  }
  return (
    <section className="dashboard-panel mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>Conti deposito</h2>
        <Button variant="outline" onClick={() => edit()}><Plus /> Aggiungi deposito</Button>
      </div>
      {deposits.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Caricamento…</p>}
      {deposits.error && <div role="alert" className="py-6 text-sm text-destructive">Impossibile caricare i depositi. <Button variant="link" onClick={() => deposits.refetch()}>Riprova</Button></div>}
      {!deposits.isLoading && !deposits.error && !deposits.data?.length && <p className="py-8 text-center text-sm text-muted-foreground">Nessun conto deposito.</p>}
      <ul className="mt-4 divide-y divide-border">
        {(deposits.data ?? []).map((deposit) => {
          const value = depositValue(deposit, today);
          return <li key={deposit.id} className="py-5">
            <div className="flex items-start gap-3">
              <span className="transaction-icon"><Landmark size={20} /></span>
              <div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{deposit.name}</h3><p className="text-xs text-muted-foreground">{deposit.annual_rate.toLocaleString("it-IT")}% annuo lordo · {deposit.end_date && deposit.end_date <= today ? "Scaduto" : deposit.start_date > today ? "Da attivare" : "Attivo"}</p></div>
              <Button variant="ghost" size="icon" aria-label={`Modifica ${deposit.name}`} title="Modifica deposito" onClick={() => edit(deposit)}><Pencil /></Button>
              <Button variant="ghost" size="icon" aria-label={`Rimuovi ${deposit.name}`} title="Rimuovi deposito" onClick={() => setDeleting(deposit)}><Trash2 /></Button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Valore maturato</dt><dd className="mt-1 break-words text-lg font-semibold">{money(value.value, deposit.currency)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Capitale iniziale</dt><dd className="mt-1 break-words font-medium">{money(deposit.principal, deposit.currency)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Interessi lordi</dt><dd className={`mt-1 break-words font-medium ${hidden ? "text-muted-foreground" : "text-success"}`}>{money(value.interest, deposit.currency)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Interesse giornaliero</dt><dd className="mt-1 break-words font-medium">{money(value.dailyInterest, deposit.currency)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Dal {new Date(deposit.start_date).toLocaleDateString("it-IT")}{deposit.end_date ? ` al ${new Date(deposit.end_date).toLocaleDateString("it-IT")}` : ""} · {value.days} giorni maturati</p>
          </li>;
        })}
      </ul>
      <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
        <DialogContent className="max-h-[85dvh] w-[calc(100%-32px)] overflow-y-auto rounded-[var(--radius-panel)]">
          <DialogHeader><DialogTitle>{editing ? "Modifica conto deposito" : "Nuovo conto deposito"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="deposit-name">Nome del conto</Label><Input id="deposit-name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="deposit-principal">Capitale iniziale</Label><Input id="deposit-principal" type="number" required min="0.01" step="0.01" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="deposit-currency">Valuta</Label><select id="deposit-currency" className="h-9 w-full rounded-md border border-input bg-card px-2" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>{["EUR", "USD", "GBP", "CHF"].map((currency) => <option key={currency}>{currency}</option>)}</select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="deposit-rate">Tasso annuo lordo (%)</Label><Input id="deposit-rate" type="number" required min="0" max="100" step="0.001" value={form.annual_rate} onChange={(e) => setForm({ ...form, annual_rate: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="deposit-start">Data iniziale</Label><Input id="deposit-start" type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="deposit-end">Scadenza (facoltativa)</Label><Input id="deposit-end" type="date" min={form.start_date} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Salvataggio…" : "Salva deposito"}</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}>
        <DialogContent className="w-[calc(100%-32px)] rounded-[var(--radius-panel)]"><DialogHeader><DialogTitle>Rimuovere {deleting?.name}?</DialogTitle></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Annulla</Button><Button variant="destructive" disabled={busy} onClick={confirmDelete}><Trash2 /> Rimuovi</Button></div></DialogContent>
      </Dialog>
    </section>
  );
}