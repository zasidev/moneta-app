import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Moon, Sun, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function AppTopbar({ theme, setTheme, ready }: {
  theme: "light" | "dark"; setTheme: (theme: "light" | "dark") => void; ready: boolean;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    staleTime: 60_000,
  });
  const metadata = user.data?.user_metadata;
  const name = typeof metadata?.["full_name"] === "string" ? metadata["full_name"]
    : typeof metadata?.["name"] === "string" ? metadata["name"] : user.data?.email?.split("@")[0] ?? "";
  const picture = typeof metadata?.["avatar_url"] === "string" ? metadata["avatar_url"]
    : typeof metadata?.["picture"] === "string" ? metadata["picture"] : undefined;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0] ?? "").join("").toUpperCase();
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error("Uscita non riuscita, riprova."); return; }
    qc.clear();
    navigate({ to: "/auth" });
  }
  return (
    <nav aria-label="Barra superiore" className="app-topbar glass">
      <div className="flex min-w-0 items-center gap-2 text-primary">
        <Wallet className="size-5 shrink-0" aria-hidden="true" />
        <span className="truncate text-base font-semibold text-foreground">Conto Chiaro</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Button variant="glass" size="icon" className="size-10 rounded-full" disabled={!ready}
          aria-label={theme === "dark" ? "Tema chiaro" : "Tema scuro"}
          title={theme === "dark" ? "Tema chiaro" : "Tema scuro"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="glass" size="icon" className="size-10 rounded-full p-0" aria-label="Menu utente" title="Menu utente">
              <Avatar className="size-10 border border-border">
                {picture && <AvatarImage src={picture} alt={name ? `Foto di ${name}` : "Foto utente"} referrerPolicy="no-referrer" />}
                <AvatarFallback className="bg-accent text-sm font-semibold text-primary">{initials || <UserRound className="size-5" />}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={10} className="w-64 max-w-[calc(100vw-32px)] rounded-xl">
            <DropdownMenuLabel className="break-words">{name || "Il tuo account"}
              {user.data?.email && <span className="mt-1 block break-all text-xs font-normal text-muted-foreground">{user.data.email}</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut} className="cursor-pointer gap-2"><LogOut /> Esci</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}