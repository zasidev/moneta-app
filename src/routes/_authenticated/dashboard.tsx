import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CreditCard,
  Eye,
  EyeOff,
  House,
  LogOut,
  Percent,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { listInstitutions, startBankConnection, syncBankData } from "@/lib/banking.functions";
import { financialValue } from "@/lib/dashboard-preferences";
import { useDashboardPreferences } from "@/hooks/use-dashboard-preferences";
import { AppNavigation } from "@/components/app-navigation";
import { AppTopbar } from "@/components/app-topbar";
import { TransactionRow } from "@/components/transaction-row";
import { includedTransactions, transactionTotals } from "@/lib/financial-statistics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (s: Record<string, unknown>): { ref?: string | undefined; view?: string | undefined } => ({
    ref: typeof s["ref"] === "string" ? s["ref"] : undefined,
    view: typeof s["view"] === "string" && ["Panoramica", "Transazioni", "Conti", "Analisi"].includes(s["view"]) ? s["view"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Panoramica — Conto Chiaro" },
      {
        name: "description",
        content: "Saldi, entrate, uscite e movimenti dei tuoi conti collegati.",
      },
      { property: "og:title", content: "Panoramica — Conto Chiaro" },
      {
        property: "og:description",
        content: "Saldi, entrate, uscite e movimenti dei tuoi conti collegati.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
function Dashboard() {
  const { ref, view: requestedView } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const handledRef = useRef(false);
  const [view, setView] = useState<string>(requestedView ?? "Panoramica");
  useEffect(() => { setView(requestedView ?? "Panoramica"); }, [requestedView]);
  const [month, setMonth] = useState(monthKey(new Date()));
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const { hidden, setHidden, theme, setTheme, ready } = useDashboardPreferences();
  const money = (n: number, c = "EUR") => financialValue(n, c, hidden || !ready);
  const [pendingExclusion, setPendingExclusion] = useState<string | null>(null);
  const exclusions = useQuery({
    queryKey: ["transaction-exclusions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transaction_exclusions").select("transaction_id");
      if (error) throw error;
      return data ?? [];
    },
  });
  const excludedIds = useMemo(() => new Set((exclusions.data ?? []).map((row) => row.transaction_id)), [exclusions.data]);
  async function toggleExclusion(id: string) {
    if (pendingExclusion) return;
    setPendingExclusion(id);
    const excluded = excludedIds.has(id);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Accedi di nuovo per modificare il movimento");
      const { error } = excluded
        ? await supabase.from("transaction_exclusions").delete().eq("transaction_id", id)
        : await supabase.from("transaction_exclusions").insert({ transaction_id: id, user_id: auth.user.id });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["transaction-exclusions"] });
      toast.success(excluded ? "Movimento incluso nelle statistiche" : "Movimento escluso dalle statistiche");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Modifica non riuscita");
    } finally { setPendingExclusion(null); }
  }

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
      const { data, error } = await supabase
        .from("bank_requisitions")
        .select("*")
        .order("created_at", { ascending: false });
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
  useEffect(() => {
    if (ref && !handledRef.current) {
      handledRef.current = true;
      toast.message("Autorizzazione ricevuta, sincronizzo…");
      sync().finally(() => navigate({ to: "/dashboard", search: {}, replace: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  const monthRows = useMemo(
    () => (txs.data ?? []).filter((t) => t.booking_date?.startsWith(month)),
    [txs.data, month],
  );
  const rows = includedTransactions(monthRows, excludedIds).filter((t) => (t.currency ?? "EUR") === currency);
  const { income, spending } = transactionTotals(rows);
  const balances = useMemo(
    () =>
      Object.entries(
        (accounts.data ?? []).reduce<Record<string, number>>((totals, a) => {
          const currency = a.currency ?? "EUR";
          totals[currency] = (totals[currency] ?? 0) + Number(a.balance ?? 0);
          return totals;
        }, {}),
      ),
    [accounts.data],
  );
  const mixedCurrency = false;
  const trend = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const [y = new Date().getFullYear(), m = 1] = month.split("-").map(Number);
        const date = new Date(y, m - 6 + i, 1);
        const list = includedTransactions(txs.data ?? [], excludedIds).filter(
          (t) => t.booking_date?.startsWith(monthKey(date)) && (t.currency ?? "EUR") === currency,
        );
        return {
          month: date.toLocaleDateString("it-IT", { month: "short" }),
          Entrate: list.reduce((s, t) => s + Math.max(0, Number(t.amount)), 0),
          Uscite: list.reduce((s, t) => s + Math.max(0, -Number(t.amount)), 0),
        };
      }),
    [month, txs.data, currency, excludedIds],
  );
  const breakdown = (accounts.data ?? [])
    .map((a) => ({
      name: a.name ?? "Conto",
      value: rows
        .filter((t) => t.account_id === a.id && t.amount < 0)
        .reduce((s, t) => s - Number(t.amount), 0),
    }))
    .filter((a) => a.value > 0);
  const loading = accounts.isLoading || txs.isLoading || exclusions.isLoading;
  const error = accounts.error || txs.error || reqs.error || exclusions.error;
  const shownRows = monthRows.filter((t) =>
    `${t.counterparty ?? ""} ${t.description ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <main className="dashboard-shell min-h-screen bg-background text-foreground">
      <AppNavigation current={view} onViewChange={(name) => {
        setView(name);
        navigate({ to: "/dashboard", search: { view: name }, replace: true });
        window.scrollTo({ top: 0, behavior: "instant" });
      }} />
      <div className="dashboard-main min-w-0">
        <AppTopbar theme={theme} setTheme={setTheme} ready={ready} />
        <header className="dashboard-header grid min-w-0 gap-4 pb-6 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h1 className="truncate text-2xl font-semibold sm:text-3xl">{view}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(`${month}-01T12:00:00`).toLocaleDateString("it-IT", {
                month: "long",
                year: "numeric",
              })}{" "}
              · Conto Chiaro
            </p>
          </div>
          <div className="dashboard-toolbar">
            <select
              aria-label="Valuta dei grafici"
              title="Valuta dei grafici"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="currency-control h-11 min-w-0 rounded-md border border-input bg-card px-2 text-sm text-foreground"
            >
              {Array.from(
                new Set([
                  "EUR",
                  ...(txs.data ?? []).map((t) => t.currency ?? "EUR"),
                  ...(accounts.data ?? []).map((a) => a.currency ?? "EUR"),
                ]),
              ).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label className="month-control flex h-11 min-w-0 items-center gap-2 rounded-md border border-input bg-card px-3">
              <CalendarDays size={17} className="text-primary" />
              <input
                aria-label="Mese"
                type="month"
                value={month}
                onChange={(e) => {
                  if (e.target.value) setMonth(e.target.value);
                }}
                className="w-full min-w-0 bg-transparent text-sm outline-none sm:w-32"
              />
            </label>
            <Button
              variant="outline"
              size="icon"
              title={hidden ? "Mostra saldi" : "Nascondi saldi"}
              aria-label={hidden ? "Mostra saldi" : "Nascondi saldi"}
              aria-pressed={hidden}
              onClick={() => setHidden(!hidden)}
            >
              {hidden ? <EyeOff /> : <Eye />}
            </Button>
            <Button
              size="icon"
              aria-label="Sincronizza"
              title="Sincronizza"
              onClick={sync}
              disabled={syncing}
            >
              <RefreshCw className={syncing ? "animate-spin" : ""} />
            </Button>
          </div>
        </header>
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-center justify-between gap-3 border border-destructive/30 p-3 text-sm text-destructive"
          >
            Impossibile caricare i dati.
            <Button variant="outline" onClick={() => qc.invalidateQueries()}>
              Riprova
            </Button>
          </div>
        )}
        {(view === "Panoramica" || view === "Analisi") && (
          <>
            <div className="stats-grid grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <div className="stat-tile">
                <span className="stat-icon">
                  <Wallet />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Saldo totale</p>
                  <div className="stat-value">
                    {loading
                      ? "…"
                      : balances.length
                        ? balances.map(([c, n]) => <p key={c}>{money(n, c)}</p>)
                        : money(0)}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {accounts.data?.length ?? 0} conti collegati
                  </p>
                </div>
              </div>
              <div className="stat-tile">
                <span className="stat-icon">
                  <ArrowDownLeft />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Entrate</p>
                  <p className="stat-value">
                    {loading ? "…" : mixedCurrency ? "Valute diverse" : money(income, currency)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Nel mese selezionato</p>
                </div>
              </div>
              <div className="stat-tile spending-tile">
                <span className="stat-icon expense-icon">
                  <ArrowUpRight />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Uscite</p>
                  <p className="stat-value">
                    {loading ? "…" : mixedCurrency ? "Valute diverse" : money(spending, currency)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Nel mese selezionato</p>
                </div>
              </div>
              <div className="stat-tile">
                <span className="stat-icon">
                  <Percent />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Tasso di risparmio</p>
                  <p className="stat-value">
                    {hidden || !ready
                      ? "••••"
                      : income > 0 && !mixedCurrency
                        ? `${(((income - spending) / income) * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`
                        : "—"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Entrate meno uscite</p>
                </div>
              </div>
            </div>
            <div className="dashboard-grid mt-5">
              <section className="dashboard-panel">
                <div className="grid min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                  <h2>Andamento entrate e uscite</h2>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <i className="h-2 w-2 rounded-full bg-chart-1" />
                      Entrate
                    </span>
                    <span className="flex items-center gap-2">
                      <i className="h-2 w-2 rounded-full bg-chart-2" />
                      Uscite
                    </span>
                  </div>
                </div>
                <div className="mt-5 h-60">
                  {hidden || !ready ? (
                    <div className="chart-empty">
                      <EyeOff />
                      <span>Importi nascosti</span>
                    </div>
                  ) : loading ? (
                    <div className="chart-empty">Caricamento…</div>
                  ) : !txs.data?.length || mixedCurrency ? (
                    <div className="chart-empty">
                      {mixedCurrency
                        ? "Movimenti in valute diverse"
                        : "Nessun movimento sincronizzato"}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="month"
                          stroke="var(--muted-foreground)"
                          fontSize={12}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          axisLine={false}
                          tickLine={false}
                          width={60}
                        />
                        <Tooltip
                          formatter={(value: number) => money(value, currency)}
                          contentStyle={{
                            background: "var(--popover)",
                            borderColor: "var(--border)",
                            color: "var(--popover-foreground)",
                            borderRadius: 6,
                          }}
                        />
                        <Area
                          isAnimationActive={false}
                          type="monotone"
                          dataKey="Entrate"
                          stroke="var(--chart-1)"
                          fill="var(--chart-1)"
                          fillOpacity={0.12}
                          strokeWidth={2.5}
                        />
                        <Area
                          isAnimationActive={false}
                          type="monotone"
                          dataKey="Uscite"
                          stroke="var(--chart-2)"
                          fill="var(--chart-2)"
                          fillOpacity={0.1}
                          strokeWidth={2.5}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ultimi 6 mesi · fino a 200 movimenti sincronizzati
                </p>
              </section>
              <section className="dashboard-panel">
                <h2>Spese per conto</h2>
                <div className="mt-5 flex min-h-60 flex-wrap items-center justify-center gap-4">
                  {hidden || !ready ? (
                    <div className="chart-empty w-full">
                      <EyeOff />
                      <span>Importi nascosti</span>
                    </div>
                  ) : !breakdown.length || mixedCurrency ? (
                    <p className="text-sm text-muted-foreground">
                      {mixedCurrency
                        ? "Movimenti in valute diverse"
                        : "Nessuna uscita nel mese selezionato"}
                    </p>
                  ) : (
                    <>
                      <div className="relative h-52 w-52 shrink-0">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              isAnimationActive={false}
                              data={breakdown}
                              dataKey="value"
                              innerRadius={70}
                              outerRadius={98}
                              stroke="none"
                              startAngle={90}
                              endAngle={-270}
                            >
                              {breakdown.map((a, i) => (
                                <Cell key={a.name + i} fill={chartColors[i % chartColors.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                          <strong className="text-lg">{money(spending, currency)}</strong>
                          <span className="mt-1 text-xs text-muted-foreground">Totale spese</span>
                        </div>
                      </div>
                      <ul className="min-w-32 flex-1 space-y-3">
                        {breakdown.map((a, i) => (
                          <li key={a.name + i} className="flex items-center gap-2 text-xs">
                            <svg width="10" height="10" aria-hidden="true">
                              <circle
                                cx="5"
                                cy="5"
                                r="5"
                                fill={chartColors[i % chartColors.length]}
                              />
                            </svg>
                            <span className="min-w-0 flex-1 truncate">{a.name}</span>
                            <strong>{Math.round((a.value / spending) * 100)}%</strong>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
        <div className={`${view === "Panoramica" ? "dashboard-grid" : "grid"} mt-5 gap-5`}>
          {(view === "Panoramica" || view === "Transazioni") && (
            <section className="dashboard-panel">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <h2>{view === "Transazioni" ? "Transazioni" : "Ultime transazioni"}</h2>
                {view === "Panoramica" && (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => setView("Transazioni")}
                  >
                    Vedi tutte <ArrowRight />
                  </Button>
                )}
              </div>
              {view === "Transazioni" && (
                <Input
                  className="mt-4"
                  placeholder="Cerca un movimento…"
                  aria-label="Cerca transazioni"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
              <ul className="mt-4 divide-y divide-border">
                {(view === "Panoramica" ? shownRows.slice(0, 5) : shownRows).map((t) => (
                  <TransactionRow key={t.id} transaction={t} excluded={excludedIds.has(t.id)} pending={pendingExclusion !== null || exclusions.isLoading || !!exclusions.error} money={money} onToggle={() => toggleExclusion(t.id)} />
                ))}
                {!shownRows.length && (
                  <li className="py-10 text-center text-sm text-muted-foreground">
                    {loading ? "Caricamento…" : "Nessun movimento nel mese selezionato."}
                  </li>
                )}
              </ul>
            </section>
          )}
          {(view === "Panoramica" || view === "Conti") && (
            <section className="dashboard-panel">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <h2>I tuoi conti</h2>
                {view === "Panoramica" ? (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => setView("Conti")}
                  >
                    Vedi conti <ArrowRight />
                  </Button>
                ) : (
                  <ConnectBankDialog />
                )}
              </div>
              <ul className="mt-4 divide-y divide-border">
                {(accounts.data ?? []).map((a) => (
                  <li key={a.id} className="financial-row grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4">
                    <span className="transaction-icon">
                      <Building2 size={21} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{a.name ?? "Conto bancario"}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {hidden || !ready ? "IBAN nascosto" : (a.iban ?? "Conto collegato")}
                      </p>
                      {view === "Conti" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Aggiornato{" "}
                          {a.last_synced_at
                            ? new Date(a.last_synced_at).toLocaleString("it-IT")
                            : "mai"}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {money(Number(a.balance ?? 0), a.currency ?? "EUR")}
                    </span>
                  </li>
                ))}
                {!accounts.data?.length && (
                  <li className="flex flex-col items-center gap-4 py-7 text-sm text-muted-foreground">
                    <Building2 size={28} />
                    <span>{loading ? "Caricamento…" : "Nessun conto collegato"}</span>
                    {!loading && <ConnectBankDialog />}
                  </li>
                )}
              </ul>
              {reqs.data?.some((r) => r.status !== "LN") && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Collegamenti in attesa:{" "}
                  {reqs.data
                    .filter((r) => r.status !== "LN")
                    .map((r) => r.institution_name ?? "Banca")
                    .join(", ")}
                </p>
              )}
              {!!accounts.data?.length && view === "Panoramica" && (
                <div className="mt-4 border-t border-border pt-4">
                  <ConnectBankDialog />
                </div>
              )}
            </section>
          )}
        </div>
        <footer className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>Open banking · Accesso in sola lettura</span>
          <Button
            variant="ghost"
            size="sm"
            className=""
            onClick={() =>
              supabase.auth.signOut().then(() => {
                qc.clear();
                navigate({ to: "/auth" });
              })
            }
          >
            <LogOut />
            Esci
          </Button>
        </footer>
      </div>
    </main>
  );
}

function ConnectBankDialog() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("it");
  const [busy, setBusy] = useState<string | null>(null);
  const inst = useQuery({
    queryKey: ["institutions", country],
    queryFn: () => listInstitutions({ data: { country } }),
    enabled: open,
    staleTime: 3600_000,
  });
  const filtered = (inst.data ?? [])
    .filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 50);

  async function connect(id: string, name: string) {
    setBusy(id);
    try {
      const { link } = await startBankConnection({
        data: {
          institutionId: id,
          institutionName: name,
          redirectUrl: `${window.location.origin}/dashboard`,
        },
      });
      window.location.href = link;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Collega banca
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scegli la tua banca</DialogTitle>
        </DialogHeader>
        <Input
          aria-label="Cerca banca"
          placeholder="Cerca…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Paese"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="mt-3 h-10 rounded-md border border-input bg-input px-2 text-sm text-foreground outline-none"
        >
          <option value="it">Italia</option>
          <option value="es">Spagna</option>
          <option value="fr">Francia</option>
          <option value="de">Germania</option>
          <option value="pt">Portogallo</option>
          <option value="nl">Paesi Bassi</option>
          <option value="be">Belgio</option>
          <option value="at">Austria</option>
          <option value="ie">Irlanda</option>
          <option value="gr">Grecia</option>
        </select>
        <div className="max-h-80 overflow-y-auto">
          {inst.isLoading && <p className="p-3 text-sm text-muted-foreground">Caricamento…</p>}
          {inst.error && (
            <p className="p-3 text-sm text-destructive">{(inst.error as Error).message}</p>
          )}
          {filtered.map((i) => (
            <Button
              variant="ghost"
              key={i.id}
              disabled={!!busy}
              onClick={() => connect(i.id, i.name)}
              className="flex h-auto w-full justify-start gap-3 whitespace-normal px-3 py-2 text-left"
            >
              <img src={i.logo} alt="" className="h-6 w-6 object-contain" />
              <span className="text-foreground">{i.name}</span>
              {busy === i.id && (
                <span className="ml-auto text-xs text-muted-foreground">Apro…</span>
              )}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
