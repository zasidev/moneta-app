import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Conto Chiaro — Le tue spese, in chiaro" },
      { name: "description", content: "Collega i tuoi conti bancari via open banking e tieni traccia delle spese personali." },
      { property: "og:title", content: "Conto Chiaro — Le tue spese, in chiaro" },
      { property: "og:description", content: "Collega i tuoi conti bancari via open banking e tieni traccia delle spese personali." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6">
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Open banking · PSD2</p>
        <h1 className="mt-4 font-display text-5xl leading-tight text-foreground md:text-7xl">
          Le tue spese,<br />finalmente in chiaro.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Collega i tuoi conti in sola lettura, sincronizza movimenti e saldi, e guarda dove vanno i tuoi soldi.
        </p>
        <div className="mt-10">
          <Button asChild size="lg"><Link to="/dashboard" search={{}}>Inizia</Link></Button>
        </div>
      </div>
    </main>
  );
}
