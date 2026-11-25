import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Moneta — Le tue spese, in chiaro" },
      {
        name: "description",
        content:
          "Collega i tuoi conti bancari via open banking e tieni traccia delle spese personali.",
      },
      { property: "og:title", content: "Moneta — Le tue spese, in chiaro" },
      {
        property: "og:description",
        content:
          "Collega i tuoi conti bancari via open banking e tieni traccia delle spese personali.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", search: {} });
      else navigate({ to: "/auth", search: {} });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/dashboard", search: {} });
      else navigate({ to: "/auth", search: {} });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  return null;
}
