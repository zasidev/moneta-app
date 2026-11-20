import { useRef, useState } from "react";
import { ArrowDownLeft, ChartNoAxesCombined, CreditCard, MinusCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Transaction = { id: string; amount: number; currency: string | null; counterparty: string | null; description: string | null; booking_date: string | null };

export function TransactionRow({ transaction: t, excluded, pending, money, onToggle }: {
  transaction: Transaction; excluded: boolean; pending: boolean;
  money: (value: number, currency: string) => string; onToggle: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const action = excluded ? "Includi nelle statistiche" : "Escludi dalle statistiche";
  return (
    <li className="transaction-swipe relative overflow-hidden" data-excluded={excluded}>
      <div aria-hidden="true" className="absolute inset-0 flex items-center justify-between rounded-xl bg-accent px-4 text-primary">
        {excluded ? <ChartNoAxesCombined size={22} /> : <MinusCircle size={22} />}
        {excluded ? <ChartNoAxesCombined size={22} /> : <MinusCircle size={22} />}
      </div>
      <div className={`financial-row transaction-surface relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 bg-card py-3 ${direction ? `swipe-${direction}` : ""}`}
        onTouchStart={(e) => { const touch = e.touches[0]; if (touch) start.current = { x: touch.clientX, y: touch.clientY }; }}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          if (!start.current || !touch) return;
          const dx = touch.clientX - start.current.x;
          const dy = touch.clientY - start.current.y;
          if (Math.abs(dy) > 35 && Math.abs(dy) > Math.abs(dx)) { start.current = null; setDirection(null); return; }
          setDirection(Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5 ? dx > 0 ? "right" : "left" : null);
        }}
        onTouchEnd={() => { if (direction && !pending) onToggle(); start.current = null; setDirection(null); }}
        onTouchCancel={() => { start.current = null; setDirection(null); }}>
        <span className={`transaction-icon ${t.amount > 0 ? "income-icon" : ""}`}>
          {t.amount > 0 ? <ArrowDownLeft size={19} /> : <CreditCard size={19} />}
        </span>
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${excluded ? "text-muted-foreground" : ""}`}>{t.counterparty ?? t.description ?? "Movimento"}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.booking_date ? new Date(t.booking_date).toLocaleDateString("it-IT") : "Data non disponibile"} · {t.description ?? "Movimento bancario"}</p>
          {excluded && <span className="text-xs font-medium text-primary">Esclusa dalle statistiche</span>}
        </div>
        <span className={`transaction-amount text-right text-sm font-semibold ${excluded ? "text-muted-foreground line-through" : t.amount < 0 ? "text-destructive" : "text-success"}`}>{money(Number(t.amount), t.currency ?? "EUR")}</span>
        <Button size="icon" variant="ghost" className="size-8 rounded-full" aria-label={action} title={action} aria-pressed={excluded} disabled={pending} onClick={onToggle}>
          {excluded ? <RotateCcw size={16} /> : <MinusCircle size={16} />}
        </Button>
      </div>
    </li>
  );
}