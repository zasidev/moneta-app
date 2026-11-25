"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";

interface MonthDropdownProps {
  value: string;
  onChange: (month: string) => void;
}

function monthOptions() {
  const now = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("it-IT", { month: "long", year: "numeric" }),
    });
  }
  return opts;
}

export function MonthDropdown({ value, onChange }: MonthDropdownProps) {
  const opts = monthOptions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="glass"
          className="h-11 min-w-30 rounded-full px-3 gap-2 inline-flex items-center justify-center text-sm font-medium"
          aria-label="Mese"
          title="Mese"
        >
          <span className="whitespace-nowrap">
            {new Date(`${value}-01T12:00:00`).toLocaleDateString("it-IT", {
              month: "short",
              year: "numeric",
            })}
          </span>

          <ChevronDown className="size-4 shrink-0 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-xl p-2">
        <DropdownMenuLabel className="px-3 py-2 text-xs font-medium text-muted-foreground">
          Mese
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {opts.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => onChange(o.value)}
            className={cn(
              "justify-between",
              value === o.value ? "bg-primary text-primary-foreground" : "",
            )}
          >
            {o.label}
            {value === o.value && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
