import { createFileRoute } from "@tanstack/react-router";
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
import { AppNavigation } from "@/components/app-navigation";
import { DepositAccounts } from "@/components/deposit-accounts";
import { investmentClient } from "@/lib/investment-types";
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
      { property: "og:title", content: "Investimenti — Conto Chiaro" },
      { property: "og:description", content: "Il tuo portafoglio titoli e valore attuale." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
      const { data, error } = await investmentClient(supabase).from("investment_prices").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const form = useForm<z.infer<typeof holdingSchema>>({
    resolver: zodResolver(holdingSchema),
    defaultValues: { ticker: "", currency: "EUR", quantity: 1 },
  });

  async function add() {
    await form.handleSubmit(async (d) => {
      await upsertHolding({ data: d });
      form.reset();
      setOpen(false);
      await qc.invalidateQueries();
    })();
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
        <AppNavigation current="Investimenti" />
        <div className="dashboard-main min-w-0">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-6">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold sm:text-3xl">Investimenti</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Portafoglio titoli · Conto Chiaro
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                title="Aggiorna prezzi di mercato"
                aria-label="Aggiorna prezzi di mercato"
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

          <div className="stats-grid mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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

          <DepositAccounts money={money} hidden={hidden || !ready} />
          <section className="dashboard-panel mb-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2>I tuoi titoli</h2>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus />
                    Aggiungi titolo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85dvh] overflow-y-auto">
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
                            <FormControl><Input {...field} placeholder="es. AAPL" /></FormControl>
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
                            <FormControl><Input {...field} placeholder="Apple Inc." /></FormControl>
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
                              <FormControl><Input {...field} placeholder="EUR" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="quantity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantità</FormLabel>
                              <FormControl><Input {...field} type="number" step="any" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="purchase_price"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prezzo d'acquisto</FormLabel>
                              <FormControl><Input {...field} value={field.value ?? ""} type="number" step="any" placeholder="0" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="purchase_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data acquisto</FormLabel>
                              <FormControl><Input {...field} type="date" /></FormControl>
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
                            <FormControl><Input {...field} placeholder="es. broker" /></FormControl>
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
                <li key={h.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 py-4">
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
                  <Button variant="outline" size="sm" aria-label="Rimuovi titolo" onClick={() => { if (h.id) remove(h.id); }}>
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
