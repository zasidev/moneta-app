import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Building2, CalendarDays, ChartNoAxesCombined, CreditCard, Eye, EyeOff, House, LogOut, Moon, Percent, Plus, RefreshCw, Sun, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { listInstitutions, startBankConnection, syncBankData } from "@/lib/banking.functions";
import { financialValue } from "@/lib/dashboard-preferences";
import { useDashboardPreferences } from "@/hooks/use-dashboard-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (s: Record<string, unknown>): { ref?: string } => typeof s["ref"] === "string" ? { ref: s["ref"] } : {},
  head: () => ({ meta: [
    { title: "Panoramica — Conto Chiaro" },
    { name: "description", content: "Saldi, entrate, uscite e movimenti dei tuoi conti collegati." },
    { property: "og:title", content: "Panoramica — Conto Chiaro" },
    { property: "og:description", content: "Saldi, entrate, uscite e movimenti dei tuoi conti collegati." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const navItems = [{ name: "Panoramica", icon: House }, { name: "Transazioni", icon: CreditCard }, { name: "Conti", icon: Building2 }, { name: "Analisi", icon: ChartNoAxesCombined }] as const;

function Dashboard() {
  const { ref } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const handledRef = useRef(false);
  const [view, setView] = useState<string>("Panoramica");
  const [month, setMonth] = useState(monthKey(new Date()));
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const { hidden, setHidden, theme, setTheme, ready } = useDashboardPreferences();
  const money = (n: number, c = "EUR") => financialValue(n, c, hidden || !ready);

  const accounts = useQuery({ queryKey: ["accounts"], queryFn: async () => {
    const { data, error } = await supabase.from("bank_accounts").select("*").order("created_at");
    if (error) throw error;
    return data;
  } });
  const txs = useQuery({ queryKey: ["transactions"], queryFn: async () => {
    const { data, error } = await supabase.from("bank_transactions").select("*").order("booking_date", { ascending: false }).limit(200);
    if (error) throw error;
    return data;
  } });
  const reqs = useQuery({ queryKey: ["requisitions"], queryFn: async () => {
    const { data, error } = await supabase.from("bank_requisitions").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  } });
  async function sync() {
    setSyncing(true);
    try {
      const r = await syncBankData();
      r.errors.forEach((e) => toast.error(e));
      toast.success(`Sincronizzati ${r.accountsSynced} conti e ${r.txSynced} movimenti`);
      await qc.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Sincronizzazione non riuscita"); }
    finally { setSyncing(false); }
  }
  useEffect(() => {
    if (ref && !handledRef.current) {
      handledRef.current = true;
      toast.message("Autorizzazione ricevuta, sincronizzo…");
      sync().finally(() => navigate({ to: "/dashboard", search: {}, replace: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  const monthRows = useMemo(() => (txs.data ?? []).filter(t => t.booking_date?.startsWith(month)), [txs.data, month]);
  const rows = monthRows.filter(t => (t.currency ?? "EUR") === currency);
  const income = rows.reduce((sum, t) => sum + Math.max(0, Number(t.amount)), 0);
  const spending = rows.reduce((sum, t) => sum + Math.max(0, -Number(t.amount)), 0);
  const balances = useMemo(() => Object.entries((accounts.data ?? []).reduce<Record<string, number>>((totals, a) => {
    const currency = a.currency ?? "EUR";
    totals[currency] = (totals[currency] ?? 0) + Number(a.balance ?? 0);
    return totals;
  }, {})), [accounts.data]);
  const mixedCurrency = false;
  const trend = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const [y = new Date().getFullYear(), m = 1] = month.split("-").map(Number);
    const date = new Date(y, m - 6 + i, 1);
    const list = (txs.data ?? []).filter(t => t.booking_date?.startsWith(monthKey(date)) && (t.currency ?? "EUR") === currency);
    return { month: date.toLocaleDateString("it-IT", { month: "short" }), Entrate: list.reduce((s, t) => s + Math.max(0, Number(t.amount)), 0), Uscite: list.reduce((s, t) => s + Math.max(0, -Number(t.amount)), 0) };
  }), [month, txs.data, currency]);
  const breakdown = (accounts.data ?? []).map(a => ({ name: a.name ?? "Conto", value: rows.filter(t => t.account_id === a.id && t.amount < 0).reduce((s, t) => s - Number(t.amount), 0) })).filter(a => a.value > 0);
  const loading = accounts.isLoading || txs.isLoading;
  const error = accounts.error || txs.error || reqs.error;
  const shownRows = monthRows.filter(t => `${t.counterparty ?? ""} ${t.description ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return <main className="dashboard-shell min-h-screen bg-background text-foreground">
    <aside className="dashboard-sidebar bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-8"><span className="brand-symbol"><Wallet size={23} /></span><span className="text-xl font-semibold">Conto Chiaro</span></div>
      <nav aria-label="Menu principale" className="flex gap-1 px-3 lg:flex-col lg:gap-2">
        {navItems.map(({ name, icon: Icon }) => <Button key={name} variant="ghost" aria-current={view === name ? "page" : undefined} onClick={() => setView(name)} className={`nav-item h-11 justify-start gap-3 px-4 ${view === name ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}><Icon /><span>{name}</span></Button>)}
      </nav>
      <div className="mt-auto hidden border-t border-sidebar-border px-3 py-5 lg:block"><Button variant="ghost" className="w-full justify-start gap-3" onClick={() => supabase.auth.signOut().then(() => { qc.clear(); navigate({ to: "/auth" }); })}><LogOut />Esci</Button></div>
    </aside>
    <div className="dashboard-main min-w-0">
      <header className="flex flex-wrap items-center justify-between gap-4 pb-6">
        <div><h1 className="text-3xl font-semibold">{view}</h1><p className="mt-1 text-sm text-muted-foreground">{new Date(`${month}-01T12:00:00`).toLocaleDateString("it-IT", { month: "long", year: "numeric" })} · Conto Chiaro</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Valuta dei grafici" title="Valuta dei grafici" value={currency} onChange={e => setCurrency(e.target.value)} className="h-10 rounded-md border border-input bg-card px-2 text-sm text-foreground">{Array.from(new Set(["EUR", ...(txs.data ?? []).map(t => t.currency ?? "EUR"), ...(accounts.data ?? []).map(a => a.currency ?? "EUR")])).map(c => <option key={c} value={c}>{c}</option>)}</select>
          <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3"><CalendarDays size={17} className="text-primary" /><input aria-label="Mese" type="month" value={month} onChange={e => { if (e.target.value) setMonth(e.target.value); }} className="w-32 bg-transparent text-sm outline-none" /></label>
          <Button variant="outline" size="icon" title={hidden ? "Mostra saldi" : "Nascondi saldi"} aria-label={hidden ? "Mostra saldi" : "Nascondi saldi"} aria-pressed={hidden} onClick={() => setHidden(!hidden)}>{hidden ? <EyeOff /> : <Eye />}</Button>
          <Button variant="outline" size="icon" title={theme === "dark" ? "Tema chiaro" : "Tema scuro"} aria-label={theme === "dark" ? "Tema chiaro" : "Tema scuro"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun /> : <Moon />}</Button>
          <Button size="icon" aria-label="Sincronizza" title="Sincronizza" onClick={sync} disabled={syncing}><RefreshCw className={syncing ? "animate-spin" : ""} /></Button>
        </div>
      </header>
      {error && <div role="alert" className="mb-5 flex items-center justify-between gap-3 border border-destructive/30 p-3 text-sm text-destructive">Impossibile caricare i dati.<Button variant="outline" onClick={() => qc.invalidateQueries()}>Riprova</Button></div>}
      {(view === "Panoramica" || view === "Analisi") && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="stat-tile"><span className="stat-icon"><Wallet /></span><div className="min-w-0"><p className="text-sm font-medium">Saldo totale</p><div className="stat-value">{loading ? "…" : balances.length ? balances.map(([c, n]) => <p key={c}>{money(n, c)}</p>) : money(0)}</div><p className="mt-2 text-xs text-muted-foreground">{accounts.data?.length ?? 0} conti collegati</p></div></div>
          <div className="stat-tile"><span className="stat-icon"><ArrowDownLeft /></span><div><p className="text-sm font-medium">Entrate</p><p className="stat-value">{loading ? "…" : mixedCurrency ? "Valute diverse" : money(income, currency)}</p><p className="mt-2 text-xs text-muted-foreground">Nel mese selezionato</p></div></div>
          <div className="stat-tile spending-tile"><span className="stat-icon expense-icon"><ArrowUpRight /></span><div><p className="text-sm font-medium">Uscite</p><p className="stat-value">{loading ? "…" : mixedCurrency ? "Valute diverse" : money(spending, currency)}</p><p className="mt-2 text-xs text-muted-foreground">Nel mese selezionato</p></div></div>
          <div className="stat-tile"><span className="stat-icon"><Percent /></span><div><p className="text-sm font-medium">Tasso di risparmio</p><p className="stat-value">{hidden || !ready ? "••••" : income > 0 && !mixedCurrency ? `${((income - spending) / income * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%` : "—"}</p><p className="mt-2 text-xs text-muted-foreground">Entrate meno uscite</p></div></div>
        </div>
        <div className="dashboard-grid mt-5">
          <section className="dashboard-panel"><div className="flex flex-wrap items-center justify-between gap-3"><h2>Andamento entrate e uscite</h2><div className="flex gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-chart-1" />Entrate</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-chart-2" />Uscite</span></div></div>
            <div className="mt-5 h-60">{hidden || !ready ? <div className="chart-empty"><EyeOff /><span>Importi nascosti</span></div> : loading ? <div className="chart-empty">Caricamento…</div> : !(txs.data?.length) || mixedCurrency ? <div className="chart-empty">{mixedCurrency ? "Movimenti in valute diverse" : "Nessun movimento sincronizzato"}</div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} axisLine={false} tickLine={false} /><YAxis stroke="var(--muted-foreground)" fontSize={11} axisLine={false} tickLine={false} width={60} /><Tooltip formatter={(value: number) => money(value, currency)} contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", color: "var(--popover-foreground)", borderRadius: 6 }} /><Area isAnimationActive={false} type="monotone" dataKey="Entrate" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.12} strokeWidth={2.5} /><Area isAnimationActive={false} type="monotone" dataKey="Uscite" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.1} strokeWidth={2.5} /></AreaChart></ResponsiveContainer>}</div>
            <p className="mt-2 text-xs text-muted-foreground">Ultimi 6 mesi · fino a 200 movimenti sincronizzati</p>
          </section>
          <section className="dashboard-panel"><h2>Spese per conto</h2><div className="mt-5 flex min-h-60 flex-wrap items-center justify-center gap-4">
            {hidden || !ready ? <div className="chart-empty w-full"><EyeOff /><span>Importi nascosti</span></div> : !breakdown.length || mixedCurrency ? <p className="text-sm text-muted-foreground">{mixedCurrency ? "Movimenti in valute diverse" : "Nessuna uscita nel mese selezionato"}</p> : <><div className="relative h-52 w-52 shrink-0"><ResponsiveContainer><PieChart><Pie isAnimationActive={false} data={breakdown} dataKey="value" innerRadius={70} outerRadius={98} stroke="none" startAngle={90} endAngle={-270}>{breakdown.map((a, i) => <Cell key={a.name + i} fill={chartColors[i % chartColors.length]} />)}</Pie></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-lg">{money(spending, currency)}</strong><span className="mt-1 text-xs text-muted-foreground">Totale spese</span></div></div><ul className="min-w-32 flex-1 space-y-3">{breakdown.map((a, i) => <li key={a.name + i} className="flex items-center gap-2 text-xs"><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="5" fill={chartColors[i % chartColors.length]} /></svg><span className="min-w-0 flex-1 truncate">{a.name}</span><strong>{Math.round(a.value / spending * 100)}%</strong></li>)}</ul></>}
          </div></section>
        </div>
      </>}
      <div className={`${view === "Panoramica" ? "dashboard-grid" : "grid"} mt-5 gap-5`}>
        {(view === "Panoramica" || view === "Transazioni") && <section className="dashboard-panel"><div className="flex items-center justify-between gap-2"><h2>{view === "Transazioni" ? "Transazioni" : "Ultime transazioni"}</h2>{view === "Panoramica" && <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setView("Transazioni")}>Vedi tutte <ArrowRight /></Button>}</div>
          {view === "Transazioni" && <Input className="mt-4" placeholder="Cerca un movimento…" aria-label="Cerca transazioni" value={search} onChange={e => setSearch(e.target.value)} />}
          <ul className="mt-4 divide-y divide-border">{(view === "Panoramica" ? shownRows.slice(0, 5) : shownRows).map(t => <li key={t.id} className="flex items-center gap-3 py-3"><span className={`transaction-icon ${t.amount > 0 ? "income-icon" : ""}`}>{t.amount > 0 ? <ArrowDownLeft size={19} /> : <CreditCard size={19} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t.counterparty ?? t.description ?? "Movimento"}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{t.booking_date ? new Date(t.booking_date).toLocaleDateString("it-IT") : "Data non disponibile"} · {t.description ?? "Movimento bancario"}</p></div><span className={`shrink-0 text-sm font-semibold ${t.amount < 0 ? "text-destructive" : "text-success"}`}>{money(Number(t.amount), t.currency ?? "EUR")}</span></li>)}{!shownRows.length && <li className="py-10 text-center text-sm text-muted-foreground">{loading ? "Caricamento…" : "Nessun movimento nel mese selezionato."}</li>}</ul>
        </section>}
        {(view === "Panoramica" || view === "Conti") && <section className="dashboard-panel"><div className="flex flex-wrap items-center justify-between gap-2"><h2>I tuoi conti</h2>{view === "Panoramica" ? <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setView("Conti")}>Vedi conti <ArrowRight /></Button> : <ConnectBankDialog />}</div><ul className="mt-4 divide-y divide-border">{(accounts.data ?? []).map(a => <li key={a.id} className="flex items-center gap-3 py-4"><span className="transaction-icon"><Building2 size={21} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{a.name ?? "Conto bancario"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{hidden || !ready ? "IBAN nascosto" : a.iban ?? "Conto collegato"}</p>{view === "Conti" && <p className="mt-1 text-xs text-muted-foreground">Aggiornato {a.last_synced_at ? new Date(a.last_synced_at).toLocaleString("it-IT") : "mai"}</p>}</div><span className="shrink-0 text-sm font-semibold">{money(Number(a.balance ?? 0), a.currency ?? "EUR")}</span></li>)}{!accounts.data?.length && <li className="flex flex-col items-center gap-4 py-7 text-sm text-muted-foreground"><Building2 size={28} /><span>{loading ? "Caricamento…" : "Nessun conto collegato"}</span>{!loading && <ConnectBankDialog />}</li>}</ul>
          {reqs.data?.some(r => r.status !== "LN") && <p className="mt-4 text-xs text-muted-foreground">Collegamenti in attesa: {reqs.data.filter(r => r.status !== "LN").map(r => r.institution_name ?? "Banca").join(", ")}</p>}
          {!!accounts.data?.length && view === "Panoramica" && <div className="mt-4 border-t border-border pt-4"><ConnectBankDialog /></div>}
        </section>}
      </div>
      <footer className="mt-6 flex items-center justify-between text-xs text-muted-foreground"><span>Open banking · Accesso in sola lettura</span><Button variant="ghost" size="sm" className="lg:hidden" onClick={() => supabase.auth.signOut().then(() => { qc.clear(); navigate({ to: "/auth" }); })}><LogOut />Esci</Button></footer>
    </div>
  </main>;
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
      <DialogTrigger asChild><Button><Plus />Collega banca</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Scegli la tua banca</DialogTitle></DialogHeader>
        <Input aria-label="Cerca banca" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-80 overflow-y-auto">
          {inst.isLoading && <p className="p-3 text-sm text-muted-foreground">Caricamento…</p>}
          {inst.error && <p className="p-3 text-sm text-destructive">{(inst.error as Error).message}</p>}
          {filtered.map((i) => (
            <Button variant="ghost"
              key={i.id}
              disabled={!!busy}
              onClick={() => connect(i.id, i.name)}
              className="flex h-auto w-full justify-start gap-3 whitespace-normal px-3 py-2 text-left"
            >
              <img src={i.logo} alt="" className="h-6 w-6 object-contain" />
              <span className="text-foreground">{i.name}</span>
              {busy === i.id && <span className="ml-auto text-xs text-muted-foreground">Apro…</span>}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
