/**
 * _admin/reports.tsx
 * Relatórios consolidados — visão detalhada por vendedor com filtro de período.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Suspense, useState, useMemo } from "react";
import { fetchAllSales, fetchAllProfiles, type AdminProfile } from "@/lib/admin";
import type { Sale } from "@/lib/agro";
import { brl, tons } from "@/lib/agro";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const salesOpts = queryOptions({
  queryKey: ["admin", "all-sales"],
  queryFn: fetchAllSales,
});

const profilesOpts = queryOptions({
  queryKey: ["admin", "all-profiles"],
  queryFn: fetchAllProfiles,
});

export const Route = createFileRoute("/_admin/reports")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return Promise.all([
      qc.ensureQueryData(salesOpts),
      qc.ensureQueryData(profilesOpts),
    ]);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <AdminReports />
    </Suspense>
  ),
});

// ─── Página ───────────────────────────────────────────────────────────────────

function AdminReports() {
  const { data: allSales    = [] } = useQuery(salesOpts);
  const { data: allProfiles = [] } = useQuery(profilesOpts);

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState<number | "all">("all");

  // Vendedores apenas (sem admins)
  const vendors = useMemo(
    () => allProfiles.filter((p) => p.role === "vendedor"),
    [allProfiles]
  );

  const profileMap = useMemo(() => {
    const m = new Map<string, AdminProfile>();
    allProfiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [allProfiles]);

  // Filtrar vendas pelo período selecionado
  const filteredSales = useMemo(() => {
    return allSales.filter((s) => {
      const d = new Date(s.sale_date);
      if (d.getFullYear() !== year) return false;
      if (month !== "all" && d.getMonth() + 1 !== month) return false;
      return true;
    });
  }, [allSales, year, month]);

  // Agrupar por vendedor
  const byVendor = useMemo(() => {
    const map = new Map<string, Sale[]>();
    vendors.forEach((v) => map.set(v.id, []));
    filteredSales.forEach((s) => {
      if (!map.has(s.vendor_id)) map.set(s.vendor_id, []);
      map.get(s.vendor_id)!.push(s);
    });
    return map;
  }, [filteredSales, vendors]);

  // Totais globais do período
  const totals = useMemo(() => ({
    tons:       filteredSales.reduce((a, s) => a + Number(s.tons), 0),
    commission: filteredSales.reduce((a, s) => a + Number(s.total_commission), 0),
    sales:      filteredSales.length,
  }), [filteredSales]);

  const MONTHS = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
  ];

  const years = Array.from(
    new Set(allSales.map((s) => new Date(s.sale_date).getFullYear()))
  ).sort((a, b) => b - a);

  // Export CSV simples
  function exportCSV() {
    const rows = [
      ["Vendedor", "E-mail", "Vendas", "Toneladas", "Comissão"],
      ...vendors.map((v) => {
        const sales = byVendor.get(v.id) ?? [];
        const t = sales.reduce((a, s) => a + Number(s.tons), 0);
        const c = sales.reduce((a, s) => a + Number(s.total_commission), 0);
        return [v.full_name ?? "", v.email ?? "", String(sales.length), t.toFixed(1), c.toFixed(2)];
      }),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agrotrial_relatorio_${year}_${month === "all" ? "anual" : String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comissões e toneladas por vendedor no período selecionado.
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Ano</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {(years.length > 0 ? years : [now.getFullYear()]).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Mês</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="all">Todos os meses</option>
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs do período */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total toneladas</p>
          <p className="mt-1 text-xl font-bold text-foreground">{tons(totals.tons)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total comissões</p>
          <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400">{brl(totals.commission)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vendas registradas</p>
          <p className="mt-1 text-xl font-bold text-foreground">{totals.sales}</p>
        </div>
      </div>

      {/* Tabela por vendedor */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-bold text-foreground">
              Detalhamento por vendedor —{" "}
              {month === "all" ? year : `${MONTHS[Number(month) - 1]} ${year}`}
            </h4>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Vendedor</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Vendas</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Toneladas</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Comissão/t</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Total comissão</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    Nenhum vendedor cadastrado.
                  </td>
                </tr>
              ) : (
                vendors.map((v) => {
                  const sales      = byVendor.get(v.id) ?? [];
                  const totalTons  = sales.reduce((a, s) => a + Number(s.tons), 0);
                  const totalComm  = sales.reduce((a, s) => a + Number(s.total_commission), 0);
                  const profile    = profileMap.get(v.id);

                  return (
                    <tr key={v.id} className={`transition-colors hover:bg-muted/30 ${!v.active ? "opacity-60" : ""}`}>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">{v.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{v.email ?? ""}</p>
                      </td>
                      <td className="px-4 py-4 text-right text-foreground">{sales.length}</td>
                      <td className="px-4 py-4 text-right font-mono font-semibold text-foreground">
                        {tons(totalTons)}
                      </td>
                      <td className="px-4 py-4 text-right text-muted-foreground">
                        {brl(profile?.commission_per_ton ?? 0)}/t
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                        {brl(totalComm)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          v.active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                            : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
                        }`}>
                          {v.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Totais */}
            {vendors.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/60 font-bold">
                  <td className="px-6 py-3 text-sm text-foreground">Total geral</td>
                  <td className="px-4 py-3 text-right text-sm text-foreground">{totals.sales}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-foreground">{tons(totals.tons)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-mono text-sm text-amber-700 dark:text-amber-400">{brl(totals.commission)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
