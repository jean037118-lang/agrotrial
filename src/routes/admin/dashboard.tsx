/**
 * _admin/dashboard.tsx
 * Dashboard do administrador — visão geral de toda a operação.
 *
 * Exibe:
 *   - KPIs globais: total toneladas no mês/ano, comissão, clientes, vendedores ativos
 *   - Gráfico de barras: vendas mensais dos últimos 12 meses
 *   - Tabela de ranking de vendedores por toneladas no mês
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  fetchVendorSummaries, fetchAllSales,
  calcGlobalTotals, calcMonthlySales,
  type VendorSummary,
} from "@/lib/admin";
import { brl, tons } from "@/lib/agro";
import {
  Wheat, Wallet, Users, TrendingUp,
  Trophy, UserCheck, ArrowRight,
} from "lucide-react";

// ─── Query options ─────────────────────────────────────────────────────────────

const summariesOpts = queryOptions({
  queryKey: ["admin", "vendor-summaries"],
  queryFn: fetchVendorSummaries,
});

const allSalesOpts = queryOptions({
  queryKey: ["admin", "all-sales"],
  queryFn: fetchAllSales,
});

// ─── Rota ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_admin/dashboard")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return Promise.all([
      qc.ensureQueryData(summariesOpts),
      qc.ensureQueryData(allSalesOpts),
    ]);
  },
  component: () => (
    <Suspense fallback={<LoadingState />}>
      <AdminDashboard />
    </Suspense>
  ),
});

// ─── Componente principal ──────────────────────────────────────────────────────

function AdminDashboard() {
  const { data: summaries = [] } = useQuery(summariesOpts);
  const { data: allSales = []  } = useQuery(allSalesOpts);

  const totals    = calcGlobalTotals(summaries);
  const monthly   = calcMonthlySales(allSales);

  // Top 5 para o mini-ranking do dashboard
  const top5 = summaries.slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl space-y-8">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Visão geral
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consolidado de todos os vendedores em tempo real.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={Wheat}
          iconBg="bg-emerald-100 text-emerald-700"
          label="Toneladas no mês"
          value={tons(totals.monthTons)}
        />
        <KpiCard
          icon={TrendingUp}
          iconBg="bg-blue-100 text-blue-700"
          label="Toneladas no ano"
          value={tons(totals.yearTons)}
        />
        <KpiCard
          icon={Wallet}
          iconBg="bg-amber-100 text-amber-700"
          label="Comissão no mês"
          value={brl(totals.monthCommission)}
        />
        <KpiCard
          icon={Trophy}
          iconBg="bg-orange-100 text-orange-600"
          label="Vendas registradas"
          value={String(totals.totalSales)}
        />
        <KpiCard
          icon={Users}
          iconBg="bg-violet-100 text-violet-700"
          label="Total de clientes"
          value={String(totals.totalClients)}
        />
        <KpiCard
          icon={UserCheck}
          iconBg="bg-teal-100 text-teal-700"
          label="Vendedores ativos"
          value={String(totals.activeVendors)}
        />
      </div>

      {/* Gráfico + Ranking lado a lado */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Gráfico de barras — últimos 12 meses */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <h3 className="mb-6 text-sm font-bold text-foreground">
            Toneladas vendidas — últimos 12 meses
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(v) => {
                  const [y, m] = v.split("-");
                  return `${m}/${String(y).slice(2)}`;
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}t`}
              />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === "tons"
                    ? [tons(value), "Toneladas"]
                    : [brl(value), "Comissão"]
                }
                labelFormatter={(label) => {
                  const [y, m] = label.split("-");
                  return `${m}/${y}`;
                }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  fontSize: 12,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                formatter={(v) => (v === "tons" ? "Toneladas" : "Comissão")}
              />
              <Bar dataKey="tons"       fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="commission" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* Mini-ranking */}
        <section className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h4 className="text-sm font-bold text-foreground">Top vendedores — mês</h4>
          </div>
          {top5.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
              Nenhuma venda registrada.
            </div>
          ) : (
            <ol className="flex-1 divide-y divide-border">
              {top5.map((v, i) => (
                <li key={v.vendor_id} className="flex items-center gap-3 px-6 py-3">
                  <RankBadge position={i + 1} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {v.vendor_name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tons(Number(v.month_tons))} · {brl(Number(v.month_commission))}
                    </p>
                  </div>
                  {!v.active && (
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                      Inativo
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
          <div className="border-t border-border p-4">
            <Link
              to="/admin/ranking"
              className="flex w-full items-center justify-center gap-1 rounded-lg border border-border bg-card py-2 text-xs font-bold text-primary transition-colors hover:bg-accent"
            >
              Ver ranking completo
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>
      </div>

      {/* Tabela completa de vendedores */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h4 className="text-sm font-bold text-foreground">Todos os vendedores</h4>
          <Link
            to="/admin/users"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Gerenciar <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Vendedor</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Tons mês</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Comissão mês</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Tons ano</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Clientes</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    Nenhum vendedor cadastrado.
                  </td>
                </tr>
              ) : (
                summaries.map((v) => (
                  <tr key={v.vendor_id} className="transition-colors hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-foreground">{v.vendor_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{v.vendor_email ?? ""}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-foreground">
                      {tons(Number(v.month_tons))}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, iconBg, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function RankBadge({ position }: { position: number }) {
  const styles: Record<number, string> = {
    1: "bg-amber-100 text-amber-700",
    2: "bg-slate-100 text-slate-600",
    3: "bg-orange-100 text-orange-700",
  };
  return (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
        styles[position] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {position}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
        active
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
          : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
      }`}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
