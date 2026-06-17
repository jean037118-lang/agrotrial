import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import { fetchClients, fetchSales, tons } from "@/lib/agro";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Medal, Award } from "lucide-react";

const clientsOpts = queryOptions({ queryKey: ["clients"], queryFn: fetchClients });
const salesOpts = queryOptions({ queryKey: ["sales"], queryFn: fetchSales });

export const Route = createFileRoute("/_authenticated/ranking")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return Promise.all([qc.ensureQueryData(clientsOpts), qc.ensureQueryData(salesOpts)]);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <RankingPage />
    </Suspense>
  ),
});

function RankingPage() {
  const { data: clients } = useSuspenseQuery(clientsOpts);
  const { data: sales } = useSuspenseQuery(salesOpts);

  const ranked = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sales) m.set(s.client_id, (m.get(s.client_id) ?? 0) + Number(s.tons));
    return clients
      .map((c) => ({ c, t: m.get(c.id) ?? 0 }))
      .sort((a, b) => b.t - a.t)
      .filter((x) => x.t > 0);
  }, [clients, sales]);

  const medals = [
    { icon: Trophy, cls: "bg-gold text-gold-foreground" },
    { icon: Medal, cls: "bg-muted text-foreground" },
    { icon: Award, cls: "bg-earth text-earth-foreground" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">Ranking de clientes</h1>
        <p className="text-muted-foreground">Maiores compradores por tonelada acumulada.</p>
      </div>
      {ranked.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-10 text-center text-muted-foreground">Nenhuma venda ainda.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {ranked.map((r, i) => {
            const m = medals[i];
            return (
              <Card key={r.c.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${m?.cls ?? "bg-muted text-muted-foreground"} font-display text-lg font-semibold`}>
                    {m ? <m.icon className="h-5 w-5" /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-lg font-semibold text-primary">{r.c.name}</div>
                    <div className="truncate text-sm text-muted-foreground">{r.c.farm ?? "—"}</div>
                  </div>
                  <div className="font-display text-xl font-semibold text-foreground">{tons(r.t)}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
