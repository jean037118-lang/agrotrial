/**
 * admin/dashboard.tsx
 * Dashboard do administrador.
 *
 * Exibe:
 *   - KPIs globais: toneladas e comissão do mês/ano, total de vendas e clientes
 *   - Gráfico de barras: toneladas vendidas nos últimos 12 meses (todos os vendedores)
 *   - Cards de ranking com progresso de cada vendedor em relação à meta
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Wallet, Wheat, Users, Receipt,
  TrendingUp, ShieldCheck, UserCheck,
} from "lucide-react";
import {
  fetchVendorSummaries, fetchAllSales,
  calcGlobalTotals, calcMonthlySales,
  type VendorSummary,
} from "@/lib/admin";
import { brl, tons } from "@/lib/agro";

// ─── Query options ────────────────────────────────────────────────────────────

const summariesOpts = queryOptions({
  queryKey: ["admin-vendor-summaries"],
  queryFn: fetchVendorSummaries,
});

const allSalesOpts = queryOptions({
  queryKey: ["admin-all-sales"],
  queryFn: fetchAllSales,
});

// ─── Rota ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/dashboard")({
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

// ─── Dashboard ────────────────────────────────────────────────────────────────

function AdminDashboard() {
  const { data: summaries } = useSuspenseQuery(summariesOpts);
  const { data: allSales }  = useSuspenseQuery(allSalesOpts);

  const totals   = calcGlobalTotals(summaries);
  const monthly  = calcMonthlySales(allSales);
  const maxTons  = Math.max(...monthly.map((m) => m.tons), 1);

  // Formata mês abreviado para o eixo X
  const chartData = monthly.map((m) => ({
    ...m,
    label: new Date(m.month + "-02").toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    }),
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Painel administrativo
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão consolidada de todos os vendedores.
          </p>
        </div>
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-muted"
        >
          <Users className="h-4 w-4" />
          Gerenciar usuários
        </Link>
      </div>

      {/* KPIs globais */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={Wheat}
          bg="bg-emerald-100 text-emerald-700"
          label="Toneladas no mês"
          value={tons(totals.monthTons)}
          span={2}
        />
        <KpiCard
          icon={Wallet}
          bg="bg-amber-100 text-amber-700"
          label="Comissão no mês"
          value={brl(totals.monthCommission)}
          span={2}
        />
        <KpiCard
          icon={TrendingUp}
          bg="bg-blue-100 text-blue-700"
          label="Toneladas no ano"
          value={tons(totals.yearTons)}
          span={2}
        />
        <KpiCard
          icon={Receipt}
          bg="bg-violet-100 text-violet-700"
          label="Total de vendas"
          value={String(totals.totalSales)}
          span={2}
        />
        <KpiCard
          icon={Users}
          bg="bg-teal-100 text-teal-700"
          label="Total de clientes"
          value={String(totals.totalClients)}
          span={2}
        />
        <KpiCard
          icon={UserCheck}
          bg="bg-orange-100 text-orange-700"
          label="Vendedores ativos"
          value={String(totals.activeVendors)}
          span={2}
        />
      </div>

      {/* Gráfico de barras — toneladas por mês */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-sm font-bold text-foreground">
            Toneladas vendidas — últimos 12 meses
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Consolidado de todos os vendedores
          </p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}t`}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card)",
              }}
              formatter={(v: number) => [`${v.toLocaleString("pt-BR")} t`, "Toneladas"]}
              labelStyle={{ fontWeight: 600 }}
            />
            <Bar dataKey="tons" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.tons === maxTons ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.3)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Ranking de vendedores */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h4 className="text-sm font-bold text-foreground">Ranking de vendedores — mês atual</h4>
          <Link
            to="/admin/ranking"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Ver ranking completo →
          </Link>
        </div>

        {summaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-muted-foreground">
            <Users className="mb-3 h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">Nenhum vendedor cadastrado ainda.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {summaries.slice(0, 5).map((s, i) => (
              <VendorRankRow key={s.vendor_id} summary={s} position={i + 1} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, bg, label, value, span = 1,
}: {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  label: string;
  value: string;
  span?: number;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
      style={{ gridColumn: `span ${span}` }}
    >
      <div className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${bg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function VendorRankRow({
  summary, position,
}: {
  summary: VendorSummary;
  position: number;
}) {
  const pct = summary.monthly_goal_tons > 0
    ? Math.min(100, (Number(summary.month_tons) / Number(summary.monthly_goal_tons)) * 100)
    : 0;

  const medalColor =
    position === 1 ? "text-amber-500" :
    position === 2 ? "text-slate-400" :
    position === 3 ? "text-amber-700" : "text-muted-foreground/40";

  return (
    <li className="flex items-center gap-4 px-6 py-4">
      {/* Posição */}
      <span className={`w-6 shrink-0 text-center text-sm font-black ${medalColor}`}>
        {position <= 3 ? ["🥇", "🥈", "🥉"][position - 1] : `#${position}`}
      </span>

      {/* Nome + barra de progresso */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {summary.vendor_name ?? "—"}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {pct.toFixed(0)}% da meta
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Toneladas e comissão */}
      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-sm font-bold tabular-nums text-foreground">
          {tons(Number(summary.month_tons))}
        </div>
        <div className="text-xs text-muted-foreground">
          {brl(Number(summary.month_commission))}
        </div>
      </div>

      {/* Status */}
      {!summary.active && (
        <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
          Inativo
        </span>
      )}
    </li>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
