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

interface CurrencyDropdownProps {
  value: string;
  onChange: (currency: string) => void;
  currencies: string[];
}

export function CurrencyDropdown({ value, onChange, currencies }: CurrencyDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="glass"
          className="
            h-11
            min-w-22
            rounded-full
            px-3
            gap-2
            inline-flex
            items-center
            justify-center
            text-sm
            font-medium
          "
          aria-label="Valuta"
          title="Valuta"
        >
          <span>{value}</span>
          <ChevronDown className="size-4 shrink-0 opacity-80" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="w-48 rounded-xl p-2">
        <DropdownMenuLabel className="px-3 py-2 text-xs font-medium text-muted-foreground">
          Valuta
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {currencies.map((c) => (
          <DropdownMenuItem
            key={c}
            onSelect={() => onChange(c)}
            className={cn(
              "flex items-center justify-between rounded-lg",
              value === c && "bg-primary text-primary-foreground",
            )}
          >
            {c}
            {value === c && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
