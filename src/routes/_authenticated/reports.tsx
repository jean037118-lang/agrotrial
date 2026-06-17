import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Suspense, useMemo, useState, useRef } from "react";
import { fetchSales, fetchClients, fetchProfile, brl, tons, daysSince } from "@/lib/agro";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Printer, TrendingUp, TrendingDown, Minus } from "lucide-react";

const salesOpts = queryOptions({ queryKey: ["sales"], queryFn: fetchSales });
const clientsOpts = queryOptions({ queryKey: ["clients"], queryFn: fetchClients });
const profileOpts = queryOptions({ queryKey: ["profile"], queryFn: fetchProfile });

export const Route = createFileRoute("/_authenticated/reports")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return Promise.all([
      qc.ensureQueryData(salesOpts),
      qc.ensureQueryData(clientsOpts),
      qc.ensureQueryData(profileOpts),
    ]);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <ReportsPage />
    </Suspense>
  ),
});

type Period = "today" | "week" | "month" | "year";

function startOf(p: Period): Date {
  const d = new Date();
  if (p === "today") return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (p === "week") { const w = new Date(d); w.setDate(d.getDate() - 7); return w; }
  if (p === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
  return new Date(d.getFullYear(), 0, 1);
}

function startOfPrev(p: Period): { start: Date; end: Date } {
  const d = new Date();
  if (p === "today") {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    return { start: s, end: new Date(d.getFullYear(), d.getMonth(), d.getDate()) };
  }
  if (p === "week") {
    const end = new Date(d); end.setDate(d.getDate() - 7);
    const start = new Date(d); start.setDate(d.getDate() - 14);
    return { start, end };
  }
  if (p === "month") {
    return { start: new Date(d.getFullYear(), d.getMonth() - 1, 1), end: new Date(d.getFullYear(), d.getMonth(), 1) };
  }
  return { start: new Date(d.getFullYear() - 1, 0, 1), end: new Date(d.getFullYear(), 0, 1) };
}

const PERIOD_LABEL: Record<Period, string> = {
  today: "Hoje",
  week: "Últimos 7 dias",
  month: "Este mês",
  year: "Este ano",
};

function ReportsPage() {
  const { data: sales } = useSuspenseQuery(salesOpts);
  const { data: clients } = useSuspenseQuery(clientsOpts);
  const { data: profile } = useSuspenseQuery(profileOpts);
  const [period, setPeriod] = useState<Period>("month");
  const printRef = useRef<HTMLDivElement>(null);

  const since = startOf(period);
  const { start: prevStart, end: prevEnd } = startOfPrev(period);

  const filtered = sales.filter((s) => new Date(s.sale_date) >= since);
  const prevFiltered = sales.filter((s) => {
    const d = new Date(s.sale_date);
    return d >= prevStart && d < prevEnd;
  });

  const totalTons = filtered.reduce((a, s) => a + Number(s.tons), 0);
  const totalCommission = filtered.reduce((a, s) => a + Number(s.total_commission), 0);
  const totalRevenue = filtered.reduce((a, s) => a + (Number(s.price_per_ton ?? 0) * Number(s.tons)), 0);

  const prevTons = prevFiltered.reduce((a, s) => a + Number(s.tons), 0);
  const prevCommission = prevFiltered.reduce((a, s) => a + Number(s.total_commission), 0);

  const tonsVar = prevTons > 0 ? ((totalTons - prevTons) / prevTons) * 100 : null;
  const commVar = prevCommission > 0 ? ((totalCommission - prevCommission) / prevCommission) * 100 : null;

  // Ranking de produtos no período
  const productRanking = useMemo(() => {
    const m = new globalThis.Map<string, { tons: number; commission: number; count: number }>();
    for (const s of filtered) {
      const prev = m.get(s.product) ?? { tons: 0, commission: 0, count: 0 };
      prev.tons += Number(s.tons);
      prev.commission += Number(s.total_commission);
      prev.count += 1;
      m.set(s.product, prev);
    }
    return [...m.entries()].sort((a, b) => b[1].tons - a[1].tons);
  }, [filtered]);

  // Histórico cronológico
  const salesOrdenadas = useMemo(() =>
    [...sales].sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()),
    [sales]
  );

  // Clientes inativos
  const lastByClient = useMemo(() => {
    const m = new globalThis.Map<string, string>();
    for (const s of sales) {
      const prev = m.get(s.client_id);
      if (!prev || s.sale_date > prev) m.set(s.client_id, s.sale_date);
    }
    return m;
  }, [sales]);

  function bucket(min: number, max?: number) {
    return clients.filter((c) => {
      const d = daysSince(lastByClient.get(c.id) ?? null);
      if (d === null) return min === 999;
      if (max == null) return d >= min;
      return d >= min && d < max;
    });
  }

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Relatório AgroTrial — ${PERIOD_LABEL[period]}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 32px; }
          h1 { font-size: 22px; font-weight: 700; color: #15803d; margin-bottom: 4px; }
          .subtitle { color: #6b7280; font-size: 11px; margin-bottom: 24px; }
          .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
          .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 4px; }
          .kpi-value { font-size: 20px; font-weight: 700; color: #15803d; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; }
          td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
          tr:hover td { background: #fafafa; }
          h2 { font-size: 14px; font-weight: 600; color: #15803d; margin: 20px 0 10px; }
          .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #9ca3af; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <h1>AgroTrial CRM — Relatório de Vendas</h1>
        <div class="subtitle">
          Período: ${PERIOD_LABEL[period]} &nbsp;|&nbsp; 
          Vendedor: ${profile?.full_name ?? "—"} &nbsp;|&nbsp;
          Gerado em: ${new Date().toLocaleString("pt-BR")}
        </div>

        <div class="kpis">
          <div class="kpi"><div class="kpi-label">Vendas</div><div class="kpi-value">${filtered.length}</div></div>
          <div class="kpi"><div class="kpi-label">Volume total</div><div class="kpi-value">${tons(totalTons)}</div></div>
          <div class="kpi"><div class="kpi-label">Comissão</div><div class="kpi-value">${brl(totalCommission)}</div></div>
          <div class="kpi"><div class="kpi-label">Faturamento</div><div class="kpi-value">${brl(totalRevenue)}</div></div>
        </div>

        <h2>Ranking por Produto</h2>
        <table>
          <thead><tr><th>Produto</th><th>Qtd. Vendas</th><th>Volume</th><th>Comissão</th></tr></thead>
          <tbody>
            ${productRanking.map(([prod, d]) => `
              <tr>
                <td>${prod}</td>
                <td>${d.count}</td>
                <td>${tons(d.tons)}</td>
                <td>${brl(d.commission)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <h2>Histórico de Transações</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente / Produtor</th>
              <th>Produto</th>
              <th style="text-align:right">Volume</th>
              <th style="text-align:right">Preço/un</th>
              <th style="text-align:right">Comissão</th>
            </tr>
          </thead>
          <tbody>
            ${salesOrdenadas.filter(s => new Date(s.sale_date) >= since).map((s) => {
              const c = clients.find((x) => x.id === s.client_id);
              return `
                <tr>
                  <td>${new Date(s.sale_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                  <td>${c?.name ?? "—"}</td>
                  <td>${s.product}</td>
                  <td style="text-align:right">${tons(Number(s.tons))}</td>
                  <td style="text-align:right">${s.price_per_ton ? brl(Number(s.price_per_ton)) : "—"}</td>
                  <td style="text-align:right">${brl(Number(s.total_commission))}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <div class="footer">AgroTrial CRM — Documento gerado automaticamente em ${new Date().toLocaleString("pt-BR")}</div>
      </body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6" ref={printRef}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Relatórios</h1>
          <p className="text-muted-foreground">Análise de vendas, comissões e carteira de clientes.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handlePrint}>
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>

      {/* Período */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList>
          <TabsTrigger value="today">Hoje</TabsTrigger>
          <TabsTrigger value="week">7 dias</TabsTrigger>
          <TabsTrigger value="month">Mês</TabsTrigger>
          <TabsTrigger value="year">Ano</TabsTrigger>
        </TabsList>

        <TabsContent value={period}>
          {/* KPIs */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Vendas" value={String(filtered.length)} sub={`${prevFiltered.length} no período anterior`} />
            <StatCard label="Volume total" value={tons(totalTons)} variation={tonsVar} accent />
            <StatCard label="Comissão" value={brl(totalCommission)} variation={commVar} earth />
            <StatCard label="Faturamento" value={brl(totalRevenue)} sub="preço × quantidade" />
          </div>
        </TabsContent>
      </Tabs>

      {/* Ranking de produtos */}
      {productRanking.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-display text-base font-semibold text-primary">Ranking por produto</h3>
              <p className="text-xs text-muted-foreground">Volume e comissão gerada por produto no período</p>
            </div>
            <div className="divide-y divide-border">
              {productRanking.map(([prod, d], i) => (
                <div key={prod} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-lg font-bold text-muted-foreground/40 w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">{prod}</div>
                    <div className="text-xs text-muted-foreground">{d.count} venda{d.count !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-primary">{tons(d.tons)}</div>
                    <div className="text-xs text-earth">{brl(d.commission)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico cronológico */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-primary">Histórico de transações</h3>
              <p className="text-xs text-muted-foreground">Todas as vendas ordenadas por data</p>
            </div>
            <Badge variant="outline">{salesOrdenadas.length} total</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="py-3 px-5">Data</th>
                  <th className="py-3 px-5">Cliente</th>
                  <th className="py-3 px-5">Produto</th>
                  <th className="py-3 px-5 text-right">Volume</th>
                  <th className="py-3 px-5 text-right">Preço/un</th>
                  <th className="py-3 px-5 text-right">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {salesOrdenadas.map((s) => {
                  const c = clients.find((x) => x.id === s.client_id);
                  return (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-5 whitespace-nowrap text-muted-foreground text-xs">
                        {new Date(s.sale_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                      </td>
                      <td className="py-3 px-5 font-medium text-foreground">{c?.name ?? "—"}</td>
                      <td className="py-3 px-5">
                        <Badge variant="outline" className="text-xs font-normal">{s.product}</Badge>
                      </td>
                      <td className="py-3 px-5 text-right font-semibold text-primary">{tons(Number(s.tons))}</td>
                      <td className="py-3 px-5 text-right text-muted-foreground text-xs">
                        {s.price_per_ton ? brl(Number(s.price_per_ton)) : "—"}
                      </td>
                      <td className="py-3 px-5 text-right font-semibold text-earth">{brl(Number(s.total_commission))}</td>
                    </tr>
                  );
                })}
                {salesOrdenadas.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Nenhuma transação registrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Clientes inativos */}
      <div>
        <h2 className="mb-3 font-display text-xl font-semibold text-primary">Saúde da carteira</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InactiveCard label="Sem compra 30–60d" clients={bucket(30, 60)} color="text-yellow-600" bg="bg-yellow-50" />
          <InactiveCard label="Sem compra 60–90d" clients={bucket(60, 90)} color="text-orange-600" bg="bg-orange-50" />
          <InactiveCard label="Sem compra 90+d" clients={bucket(90)} color="text-red-600" bg="bg-red-50" />
          <InactiveCard label="Nunca compraram" clients={bucket(999)} color="text-muted-foreground" bg="bg-muted/50" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, variation, accent, earth }: {
  label: string; value: string; sub?: string;
  variation?: number | null; accent?: boolean; earth?: boolean;
}) {
  const valCls = earth ? "text-earth" : accent ? "text-primary" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
        <div className={`font-display text-2xl font-bold ${valCls}`}>{value}</div>
        {variation !== undefined && variation !== null ? (
          <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${variation >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {variation > 0 ? <TrendingUp className="h-3 w-3" /> : variation < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(variation).toFixed(1)}% vs período anterior
          </div>
        ) : sub ? (
          <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InactiveCard({ label, clients, color, bg }: {
  label: string; clients: { id: string; name: string }[]; color: string; bg: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className={`${bg} px-4 py-3`}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={`font-display text-3xl font-bold ${color}`}>{clients.length}</div>
        </div>
        {clients.length > 0 && (
          <div className="px-4 py-2 space-y-1">
            {clients.slice(0, 3).map((c) => (
              <div key={c.id} className="text-xs text-muted-foreground truncate">{c.name}</div>
            ))}
            {clients.length > 3 && (
              <div className="text-xs text-muted-foreground">+{clients.length - 3} outros</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
