import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listInstitutions, startBankConnection, syncBankData } from "@/lib/banking.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (s: Record<string, unknown>): { ref?: string } =>
    typeof s["ref"] === "string" ? { ref: s["ref"] } : {},
  head: () => ({
    meta: [
      { title: "I miei conti — Conto Chiaro" },
      { name: "description", content: "Conti collegati, saldi e movimenti sincronizzati." },
      { property: "og:title", content: "I miei conti — Conto Chiaro" },
      { property: "og:description", content: "Conti collegati, saldi e movimenti sincronizzati." },
    ],
  }),
  component: Dashboard,
});

const eur = (n: number, c = "EUR") => new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);

function Dashboard() {
  const { ref } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const handledRef = useRef(false);

  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const txs = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .order("booking_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
  const reqs = useQuery({
    queryKey: ["requisitions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_requisitions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function sync() {
    setSyncing(true);
    try {
      const r = await syncBankData();
      r.errors.forEach((e) => toast.error(e));
      toast.success(`Sincronizzati ${r.accountsSynced} conti e ${r.txSynced} movimenti`);
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sincronizzazione non riuscita");
    } finally {
      setSyncing(false);
    }
  }

  // Ritorno dalla banca dopo l'autorizzazione: sincronizza subito.
  useEffect(() => {
    if (ref && !handledRef.current) {
      handledRef.current = true;
      toast.message("Autorizzazione ricevuta, sincronizzo…");
      sync().finally(() => navigate({ to: "/dashboard", search: {}, replace: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  const stats = useMemo(() => {
    const list = txs.data ?? [];
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const recent = list.filter((t) => t.booking_date && new Date(t.booking_date) >= since);
    return {
      out: recent.filter((t) => t.amount < 0).reduce((s, t) => s + Number(t.amount), 0),
      inc: recent.filter((t) => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0),
      total: (accounts.data ?? []).reduce((s, a) => s + Number(a.balance ?? 0), 0),
    };
  }, [txs.data, accounts.data]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-display text-2xl text-foreground">Conto Chiaro</span>
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/auth" }))}>
            Esci
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Saldo totale</p>
            <p className="font-display text-5xl text-foreground">{eur(stats.total)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={sync} disabled={syncing}>
              {syncing ? "Sincronizzo…" : "Sincronizza"}
            </Button>
            <ConnectBankDialog />
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Stat label="Uscite ultimi 30 giorni" value={eur(stats.out)} tone="text-destructive" />
          <Stat label="Entrate ultimi 30 giorni" value={eur(stats.inc)} tone="text-primary" />
        </div>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-foreground">Conti</h2>
          {accounts.data?.length ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {accounts.data.map((a) => (
                <li key={a.id} className="rounded-lg border border-border bg-card p-4">
                  <p className="font-medium text-card-foreground">{a.name ?? "Conto"}</p>
                  <p className="text-xs text-muted-foreground">{a.iban}</p>
                  <p className="mt-2 text-xl text-card-foreground">{eur(Number(a.balance ?? 0), a.currency ?? "EUR")}</p>
                  <p className="text-xs text-muted-foreground">
                    Aggiornato {a.last_synced_at ? new Date(a.last_synced_at).toLocaleString("it-IT") : "mai"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-muted-foreground">
              Nessun conto ancora. Premi “Collega banca” e scegli “Sandbox Finance (test)” per provare.
            </p>
          )}
          {reqs.data?.some((r) => r.status !== "LN") && (
            <p className="mt-3 text-xs text-muted-foreground">
              Collegamenti in attesa: {reqs.data.filter((r) => r.status !== "LN").map((r) => `${r.institution_name} (${r.status})`).join(", ")}
            </p>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-foreground">Movimenti</h2>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
            {(txs.data ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-card-foreground">{t.counterparty ?? t.description ?? "Movimento"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.booking_date ? new Date(t.booking_date).toLocaleDateString("it-IT") : ""} · {t.description}
                  </p>
                </div>
                <span className={Number(t.amount) < 0 ? "text-destructive" : "text-primary"}>
                  {eur(Number(t.amount), t.currency ?? "EUR")}
                </span>
              </li>
            ))}
            {!txs.data?.length && <li className="px-4 py-6 text-sm text-muted-foreground">Nessun movimento.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl ${tone}`}>{value}</p>
    </div>
  );
}

function ConnectBankDialog() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const inst = useQuery({ queryKey: ["institutions"], queryFn: () => listInstitutions(), enabled: open, staleTime: 3600_000 });
  const filtered = (inst.data ?? []).filter((i) => i.name.toLowerCase().includes(q.toLowerCase())).slice(0, 50);

  async function connect(id: string, name: string) {
    setBusy(id);
    try {
      const { link } = await startBankConnection({
        data: { institutionId: id, institutionName: name, redirectUrl: `${window.location.origin}/dashboard` },
      });
      window.location.href = link;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Collega banca</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Scegli la tua banca</DialogTitle></DialogHeader>
        <Input placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-80 overflow-y-auto">
          {inst.isLoading && <p className="p-3 text-sm text-muted-foreground">Caricamento…</p>}
          {inst.error && <p className="p-3 text-sm text-destructive">{(inst.error as Error).message}</p>}
          {filtered.map((i) => (
            <button
              key={i.id}
              disabled={!!busy}
              onClick={() => connect(i.id, i.name)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent disabled:opacity-50"
            >
              <img src={i.logo} alt="" className="h-6 w-6 object-contain" />
              <span className="text-foreground">{i.name}</span>
              {busy === i.id && <span className="ml-auto text-xs text-muted-foreground">Apro…</span>}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
