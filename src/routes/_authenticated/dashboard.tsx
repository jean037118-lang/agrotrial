import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  fetchClients, fetchSales, fetchProfile, fetchAgenda,
  brl, tons, daysSince, type Client, type Sale,
} from "@/lib/agro";
import {
  Wallet, Truck, Phone, Wheat, Target, RefreshCw,
  Plus, CheckCircle2, ArrowRight,
} from "lucide-react";

const opts = {
  profile: queryOptions({ queryKey: ["profile"], queryFn: fetchProfile }),
  clients: queryOptions({ queryKey: ["clients"], queryFn: fetchClients }),
  sales: queryOptions({ queryKey: ["sales"], queryFn: fetchSales }),
  agenda: queryOptions({ queryKey: ["agenda"], queryFn: fetchAgenda }),
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return Promise.all([
      qc.ensureQueryData(opts.profile),
      qc.ensureQueryData(opts.clients),
      qc.ensureQueryData(opts.sales),
      qc.ensureQueryData(opts.agenda),
    ]);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <Dashboard />
    </Suspense>
  ),
});

function Dashboard() {
  const { data: profile } = useSuspenseQuery(opts.profile);
  const { data: clients } = useSuspenseQuery(opts.clients);
  const { data: sales } = useSuspenseQuery(opts.sales);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthSales = sales.filter((s) => new Date(s.sale_date) >= monthStart);
  const monthTons = monthSales.reduce((a, s) => a + Number(s.tons), 0);
  const monthCommission = monthSales.reduce((a, s) => a + Number(s.total_commission), 0);
  const goal = profile?.monthly_goal_tons ?? 1000;
  const goalPct = Math.min(100, (monthTons / goal) * 100);
  const recallDays = profile?.recall_days ?? 60;

  const lastByClient = new Map<string, Sale>();
  for (const s of sales) {
    const prev = lastByClient.get(s.client_id);
    if (!prev || new Date(s.sale_date) > new Date(prev.sale_date)) lastByClient.set(s.client_id, s);
  }
  const needsCall: Client[] = clients.filter((c) => {
    const last = lastByClient.get(c.id);
    const d = daysSince(last?.sale_date ?? null);
    return d === null || d >= recallDays;
  });

  const upcomingDeliveries = sales
    .filter((s) => s.delivery_date && new Date(s.delivery_date) >= new Date(now.toDateString()))
    .sort((a, b) => +new Date(a.delivery_date!) - +new Date(b.delivery_date!))
    .slice(0, 5);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Olá{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Visão geral da sua operação hoje.</p>
        </div>
        <Link
          to="/sales"
          className="inline-flex items-center gap-2 rounded-lg bg-earth px-4 py-2.5 text-sm font-semibold text-earth-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Registrar venda
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Phone}
          iconBg="bg-orange-100 text-orange-600"
          label="Clientes p/ ligar"
          value={String(needsCall.length)}
          hint={`+${recallDays}d sem compra`}
          badge={needsCall.length > 0 ? { text: "Atrasado", tone: "danger" } : undefined}
        />
        <KpiCard
          icon={Truck}
          iconBg="bg-teal-100 text-teal-700"
          label="Entregas previstas"
          value={String(upcomingDeliveries.length)}
          hint="Próximos 7 dias"
        />
        <KpiCard
          icon={Wallet}
          iconBg="bg-amber-100 text-amber-700"
          label="Comissão do mês"
          value={brl(monthCommission)}
          hint={`${monthSales.length} venda${monthSales.length === 1 ? "" : "s"}`}
          hintTone="success"
        />
        <KpiCard
          icon={Wheat}
          iconBg="bg-emerald-100 text-emerald-700"
          label="Toneladas no mês"
          value={tons(monthTons)}
          hint={`Meta: ${tons(goal)}`}
        />
      </div>

      {/* Meta + Recompra */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card shadow-sm lg:col-span-2">
          <div className="p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Target className="h-4 w-4 text-primary" strokeWidth={2.5} />
                  Meta mensal de vendas
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">Progresso acumulado de tonelagem</p>
              </div>
              <span className="text-3xl font-black tabular-nums text-primary">{goalPct.toFixed(0)}%</span>
            </div>

            <div className="mb-8 h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${goalPct}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Mini label="Vendas" value={String(monthSales.length)} />
              <Mini label="Comissão/T" value={brl(profile?.commission_per_ton ?? 0)} />
              <Mini label="Ticket médio" value={monthSales.length ? tons(monthTons / monthSales.length) : "—"} />
            </div>
          </div>
        </section>

        <section className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded bg-orange-50 p-1.5">
              <RefreshCw className="h-4 w-4 text-orange-600" strokeWidth={2.5} />
            </div>
            <h4 className="text-sm font-bold text-foreground">Recompra inteligente</h4>
          </div>

          {needsCall.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" strokeWidth={2.5} />
              </div>
              <p className="mb-1 text-sm font-medium text-foreground">Tudo em dia</p>
              <p className="text-xs text-muted-foreground">Nenhum cliente em janela de recompra para hoje.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-2">
              {needsCall.slice(0, 4).map((c) => {
                const last = lastByClient.get(c.id);
                const d = daysSince(last?.sale_date ?? null);
                return (
                  <Link
                    key={c.id}
                    to="/clients"
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{c.farm ?? "—"}</div>
                    </div>
                    <span className="shrink-0 rounded-full border border-earth/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-earth">
                      {d === null ? "Nunca" : `${d}d`}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          <Link
            to="/clients"
            className="mt-6 flex w-full items-center justify-center gap-1 rounded-lg border border-emerald-100 bg-card py-2 text-xs font-bold text-primary transition-colors hover:bg-emerald-50"
          >
            Ver todos os clientes
            <ArrowRight className="h-3 w-3" />
          </Link>
        </section>
      </div>

      {/* Próximas entregas */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h4 className="text-sm font-bold text-foreground">Próximas entregas</h4>
        </div>
        {upcomingDeliveries.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-muted-foreground">
            <Truck className="mb-3 h-10 w-10 opacity-20" strokeWidth={1.5} />
            <p className="text-sm font-medium">Nenhuma entrega agendada no momento</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {upcomingDeliveries.map((s) => {
              const c = clients.find((x) => x.id === s.client_id);
              return (
                <li key={s.id} className="flex items-center justify-between px-6 py-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{c?.name ?? "Cliente"}</div>
                    <div className="truncate text-xs text-muted-foreground">{c?.farm ?? "—"} • {s.product}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums text-foreground">{tons(Number(s.tons))}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.delivery_date!).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {clients.length === 0 && <EmptyHint />}
    </div>
  );
}

function KpiCard({
  icon: Icon, iconBg, label, value, hint, hintTone, badge,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconBg: string;
  label: string;
  value: string;
  hint?: string;
  hintTone?: "success" | "muted";
  badge?: { text: string; tone: "danger" | "success" };
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${iconBg}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              badge.tone === "danger"
                ? "bg-red-50 text-red-600"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
        {hint && (
          <span
            className={`text-xs font-medium ${
              hintTone === "success" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6">
      <h3 className="text-lg font-bold text-foreground">Comece pelo básico</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Cadastre seus primeiros clientes e registre vendas para ver os indicadores ganharem vida.
      </p>
      <div className="mt-4 flex gap-2">
        <Link to="/clients" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Cadastrar cliente
        </Link>
        <Link to="/sales" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">
          Registrar venda
        </Link>
      </div>
    </div>
  );
}
