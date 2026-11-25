import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Building2, ChartNoAxesCombined, CreditCard, House, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const items = [
  { name: "Panoramica", label: "Home", icon: House },
  { name: "Transazioni", label: "Movimenti", icon: CreditCard },
  { name: "Conti", label: "Conti", icon: Building2 },
  { name: "Analisi", label: "Analisi", icon: ChartNoAxesCombined },
  { name: "Investimenti", label: "Investimenti", icon: TrendingUp },
] as const;

export function AppNavigation({
  current,
  onViewChange,
}: {
  current: string;
  onViewChange?: (view: string) => void;
}) {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const onScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;
    window.requestAnimationFrame(() => {
      const scrollY = window.scrollY;
      if (scrollY > lastScrollY.current && scrollY > 40) {
        setHidden(true);
      } else if (scrollY < lastScrollY.current || scrollY === 0) {
        setHidden(false);
      }
      lastScrollY.current = scrollY > 0 ? scrollY : 0;
      ticking.current = false;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  return (
    <aside
      className={cn(
        "dashboard-sidebar glass transition-transform duration-300 ease-out will-change-transform",
        hidden ? "translate-y-full" : "",
      )}
    >
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
