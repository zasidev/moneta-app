import { useNavigate } from "@tanstack/react-router";
import { Building2, ChartNoAxesCombined, CreditCard, House, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const items = [
  { name: "Panoramica", label: "Home", icon: House },
  { name: "Transazioni", label: "Movimenti", icon: CreditCard },
  { name: "Conti", label: "Conti", icon: Building2 },
  { name: "Analisi", label: "Analisi", icon: ChartNoAxesCombined },
  { name: "Investimenti", label: "Investimenti", icon: TrendingUp },
] as const;

export function AppNavigation({ current, onViewChange }: { current: string; onViewChange?: (view: string) => void }) {
  const navigate = useNavigate();
  return (
    <aside className="dashboard-sidebar glass">
      <nav aria-label="Menu principale" className="app-navigation">
        {items.map(({ name, label, icon: Icon }) => (
          <Button
            key={name}
            variant="ghost"
            aria-label={name}
            aria-current={current === name ? "page" : undefined}
            title={name}
            className={`nav-item ${current === name ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}
            onClick={() => {
              if (name === "Investimenti") navigate({ to: "/investments" });
              else if (onViewChange) onViewChange(name);
              else navigate({ to: "/dashboard", search: { view: name } });
            }}
          >
            <Icon className="shrink-0" />
            <span className="nav-label-desktop">{name}</span>
            <span className="nav-label-mobile">{label}</span>
          </Button>
        ))}
      </nav>
    </aside>
  );
}