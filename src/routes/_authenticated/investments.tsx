import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, EyeOff, LogOut, Plus, RefreshCw, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listHoldings,
  upsertHolding,
  deleteHolding,
  fetchPrices,
} from "@/lib/investments.functions";
import { financialValue } from "@/lib/dashboard-preferences";
import { useDashboardPreferences } from "@/hooks/use-dashboard-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

export const Route = createFileRoute("/_authenticated/investments")({
  head: () => ({
    meta: [
      { title: "Investimenti — Conto Chiaro" },
      { name: "description", content: "Il tuo portafoglio titoli e valore attuale." },
    ],
  }),
  component: Investments,
});

const holdingSchema = z.object({
  ticker: z.string().min(1, "Inserisci un ticker").toUpperCase(),
  name: z.string().optional(),
  currency: z.string().min(1, "Valuta").optional(),
  quantity: z.coerce.number().positive("Quantità deve essere positiva"),
  purchase_price: z.coerce.number().nonnegative().optional().nullable(),
  purchase_date: z.string().optional(),
  platform: z.string().optional(),
});

function Investments() {
  const { hidden, setHidden, ready } = useDashboardPreferences();
  const money = (n: number, c = "EUR") => financialValue(n, c, hidden || !ready);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const holdings = useQuery({ queryKey: ["investment_holdings"], queryFn: listHoldings });
  const prices = useQuery({
    queryKey: ["investment_prices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investment_prices").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const form = useForm<z.infer<typeof holdingSchema>>({
    resolver: zodResolver(holdingSchema),
    defaultValues: { ticker: "", currency: "EUR", quantity: 1 },
  });

  async function add() {
    const res = await form.handleSubmit(async (d) => {
      await upsertHolding({ data: d });
      form.reset();
      setOpen(false);
      await qc.invalidateQueries();
    })();
    if (!res) return;
  }

  async function remove(id: string) {
    if (!window.confirm("Rimuovere questo titolo?")) return;
    await deleteHolding({ data: { id } });
    await qc.invalidateQueries();
  }

  async function syncPrices() {
    setSyncing(true);
    try {
      const r = await fetchPrices();
      await qc.invalidateQueries();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Aggiornamento prezzi fallito");
    } finally {
      setSyncing(false);
    }
  }

  const priceByTicker = new Map((prices.data ?? []).map((p) => [p.ticker, p.price]));
  const currencyByTicker = new Map((prices.data ?? []).map((p) => [p.ticker, p.currency]));

  const rows = (holdings.data ?? []).map((h) => {
    const price = priceByTicker.get(h.ticker) ?? h.purchase_price ?? 0;
    const cur = currencyByTicker.get(h.ticker) ?? h.currency ?? "EUR";
    const currentValue = price * h.quantity;
    const invested = (h.purchase_price ?? 0) * h.quantity;
    return { ...h, price, cur, currentValue, invested, gain: currentValue - invested };
  });

  const totalValue = rows.reduce((s, r) => s + r.currentValue, 0);
  const totalInvested = rows.reduce((s, r) => s + r.invested, 0);
  const loading = holdings.isLoading || prices.isLoading;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar bg-sidebar text-sidebar-foreground">
          <div className="flex items-center gap-3 px-5 py-8">
            <span className="brand-symbol">
              <Wallet size={23} />
            </span>
            <span className="text-xl font-semibold">Conto Chiaro</span>
          </div>
          <nav aria-label="Menu principale" className="flex gap-1 px-3 lg:flex-col lg:gap-2">
            <Button
              variant="ghost"
              aria-current="page"
              className="nav-item h-11 justify-start gap-3 px-4 bg-sidebar-accent text-sidebar-accent-foreground"
            >
              <span className="flex items-center gap-3">
                <Plus className="size-4" />
                Investimenti
              </span>
            </Button>
            <Button variant="ghost" className="nav-item h-11 justify-start gap-3 px-4" asChild>
              <Link to="/_authenticated/dashboard">
                <Wallet />
                Conti
              </Link>
            </Button>
          </nav>
          <div className="mt-auto border-t border-sidebar-border px-3 py-5 lg:block">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() =>
                supabase.auth.signOut().then(() => {
                  qc.clear();
                })
              }
            >
              <LogOut size={18} />
              Esci
            </Button>
          </div>
        </aside>
        <div className="dashboard-main min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-4 pb-6">
            <div>
              <h1 className="text-3xl font-semibold">Investimenti</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Portafoglio titoli · Conto Chiaro
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                title="Aggiorna prezzi di mercato"
                onClick={syncPrices}
                disabled={syncing}
              >
                <RefreshCw className={syncing ? "animate-spin" : ""} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                title={hidden ? "Mostra importi" : "Nascondi importi"}
                aria-label={hidden ? "Mostra importi" : "Nascondi importi"}
                aria-pressed={hidden}
                onClick={() => setHidden(!hidden)}
              >
                {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4 mb-5">
            <div className="stat-tile">
              <div className="min-w-0">
                <p className="text-sm font-medium">Valore attuale</p>
                <p className="stat-value">{loading ? "…" : money(totalValue)}</p>
              </div>
            </div>
            <div className="stat-tile">
              <div className="min-w-0">
                <p className="text-sm font-medium">Totale investito</p>
                <p className="stat-value">{loading ? "…" : money(totalInvested)}</p>
              </div>
            </div>
            <div className="stat-tile">
              <div className="min-w-0">
                <p className="text-sm font-medium">Plusvalenza</p>
                <p
                  className={`stat-value ${totalValue >= totalInvested ? "text-success" : "text-destructive"}`}
                >
                  {loading ? "…" : money(totalValue - totalInvested)}
                </p>
              </div>
            </div>
            <div className="stat-tile">
              <div className="min-w-0">
                <p className="text-sm font-medium">Titoli</p>
                <p className="stat-value">{holdings.data?.length ?? 0}</p>
              </div>
            </div>
          </div>

          <section className="dashboard-panel mb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2>I tuoi titoli</h2>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus />
                    Aggiungi titolo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuovo titolo</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={add} className="space-y-4 p-4">
                      <FormField
                        control={form.control}
                        name="ticker"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ticker / ISIN</FormLabel>
                            <FormControl {...field} placeholder="es. AAPL" />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl {...field} placeholder="Apple Inc." />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="currency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Valuta</FormLabel>
                              <FormControl {...field} placeholder="EUR" />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="quantity"
                          type="number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantità</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="purchase_price"
                          type="number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prezzo d'acquisto</FormLabel>
                              <FormControl {...field} placeholder="0" />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="purchase_date"
                          type="date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data acquisto</FormLabel>
                              <FormControl {...field} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="platform"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Piattaforma / conto</FormLabel>
                            <FormControl {...field} placeholder="es. broker" />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit">Salva</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            <ul className="mt-4 divide-y divide-border">
              {rows.map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{h.name ?? h.ticker}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {h.ticker} · {h.platform ?? "—"} · {h.currency}
                    </p>
                    {h.purchase_date && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Acquisto {new Date(h.purchase_date).toLocaleDateString("it-IT")}
                      </p>
                    )}
                  </div>
                  <div className="text-right min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${hidden || !ready ? "text-muted-foreground" : h.gain >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {hidden || !ready ? "••••" : money(h.currentValue, h.cur)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {hidden || !ready ? "" : h.gain >= 0 ? "+" : ""}
                      {money(h.gain, h.cur)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => remove(String(h.id))}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
              {!rows.length && (
                <li className="py-10 text-center text-sm text-muted-foreground">
                  {loading ? "Caricamento…" : "Nessun titolo nel portafoglio."}
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
