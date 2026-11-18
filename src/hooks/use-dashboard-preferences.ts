import { useEffect, useState } from "react";
import { privacyKey, storedTheme, themeKey } from "@/lib/dashboard-preferences";

export function useDashboardPreferences() {
  const [hidden, setHidden] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(privacyKey) === "true");
      setTheme(storedTheme(localStorage.getItem(themeKey), window.matchMedia("(prefers-color-scheme: dark)").matches));
    } catch { /* Storage may be unavailable in private browsing. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(privacyKey, String(hidden));
      localStorage.setItem(themeKey, theme);
    } catch { /* Controls still work without persistence. */ }
  }, [hidden, theme, ready]);
  return { hidden, setHidden, theme, setTheme, ready };
}