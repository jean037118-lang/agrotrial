/**
 * _admin/ranking.tsx
 * Ranking completo de todos os vendedores com filtro por período.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { fetchVendorSummaries, type VendorSummary } from "@/lib/admin";
import { brl, tons } from "@/lib/agro";
import { Trophy, Medal, TrendingUp, Wheat, Wallet, Target } from "lucide-react";

const summariesOpts = queryOptions({
  queryKey: ["admin", "vendor-summaries"],
  queryFn: fetchVendorSummaries,
});

export const Route = createFileRoute("/admin/ranking")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return qc.ensureQueryData(summariesOpts);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <AdminRanking />
    </Suspense>
  ),
});

type SortKey = "month_tons" | "year_tons" | "month_commission" | "total_commission" | "total_clients";

function AdminRanking() {
  const { data: summaries = [] } = useQuery(summariesOpts);
  const [sortBy, setSortBy] = useState<SortKey>("month_tons");
  const [showInactive, setShowInactive] = useState(false);

  const filtered = summaries
    .filter((v) => showInactive || v.active)
    .sort((a, b) => Number(b[sortBy]) - Number(a[sortBy]));

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "month_tons",        label: "Tons mês" },
    { key: "year_tons",         label: "Tons ano" },
    { key: "month_commission",  label: "Comissão mês" },
    { key: "total_commission",  label: "Comissão total" },
    { key: "total_clients",     label: "Clientes" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Ranking de Vendedores
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} vendedor{filtered.length !== 1 ? "es" : ""} —
            ordenado por{" "}
            <span className="font-semibold text-foreground">
              {sortOptions.find((o) => o.key === sortBy)?.label}
            </span>
          </p>
        </div>

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inativos
          </label>

          <div className="flex rounded-lg border border-border bg-card">
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  sortBy === opt.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pódio top 3 */}
      {filtered.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {[filtered[1], filtered[0], filtered[2]].map((v, podiumIdx) => {
            const pos = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
            return (
              <PodiumCard key={v.vendor_id} vendor={v} position={pos} sortBy={sortBy} />
            );
          })}
        </div>
      )}

      {/* Lista completa */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h4 className="text-sm font-bold text-foreground">Lista completa</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-12 px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">#</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Vendedor</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Tons mês</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Meta</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Comissão mês</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Tons ano</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Clientes</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                    Nenhum vendedor encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((v, i) => {
                  const goal = Number(v.monthly_goal_tons);
                  const monthTons = Number(v.month_tons);
                  const pct = goal > 0 ? Math.min(100, (monthTons / goal) * 100) : 0;

                  return (
                    <tr key={v.vendor_id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-4 text-center">
                        <RankBadge position={i + 1} />
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground">{v.vendor_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{v.vendor_email ?? ""}</p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="font-mono font-semibold text-foreground">{tons(monthTons)}</p>
                        {/* Barra de meta */}
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-xs text-muted-foreground">
                        <span className={`font-semibold ${pct >= 100 ? "text-emerald-600" : "text-foreground"}`}>
                          {pct.toFixed(0)}%
                        </span>
                        <br />{tons(goal)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-amber-700 dark:text-amber-400">
                        {brl(Number(v.month_commission))}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-foreground">
                        {tons(Number(v.year_tons))}
                      </td>
                      <td className="px-4 py-4 text-right text-foreground">
                        {v.total_clients}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <StatusBadge active={v.active} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function PodiumCard({
  vendor, position, sortBy,
}: {
  vendor: VendorSummary;
  position: 1 | 2 | 3;
  sortBy: SortKey;
}) {
  const podiumStyles = {
    1: { border: "border-amber-300", bg: "bg-amber-50 dark:bg-amber-950/30", badge: "bg-amber-400 text-white", icon: Trophy },
    2: { border: "border-slate-300", bg: "bg-slate-50 dark:bg-slate-900/30", badge: "bg-slate-400 text-white", icon: Medal },
    3: { border: "border-orange-300", bg: "bg-orange-50 dark:bg-orange-950/30", badge: "bg-orange-400 text-white", icon: Medal },
  };
  const s = podiumStyles[position];
  const Icon = s.icon;

  const mainValue =
    sortBy === "month_commission" || sortBy === "total_commission"
      ? brl(Number(vendor[sortBy]))
      : sortBy === "total_clients"
      ? `${vendor.total_clients} clientes`
      : tons(Number(vendor[sortBy]));

  return (
    <div className={`rounded-xl border-2 ${s.border} ${s.bg} p-5 text-center ${position === 1 ? "scale-105 shadow-md" : ""}`}>
      <div className={`mx-auto mb-3 grid h-9 w-9 place-items-center rounded-full ${s.badge}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="truncate text-sm font-bold text-foreground">
        {vendor.vendor_name ?? "—"}
      </p>
      <p className="mt-1 text-lg font-black tabular-nums text-foreground">{mainValue}</p>
      <StatusBadge active={vendor.active} />
    </div>
  );
}

function RankBadge({ position }: { position: number }) {
  const styles: Record<number, string> = {
    1: "bg-amber-100 text-amber-700 font-black",
    2: "bg-slate-100 text-slate-600 font-black",
    3: "bg-orange-100 text-orange-700 font-black",
  };
  return (
    <span
      className={`inline-grid h-7 w-7 place-items-center rounded-full text-xs ${
        styles[position] ?? "text-muted-foreground font-semibold"
      }`}
    >
      {position}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
      active
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
        : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
    }`}>
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}
