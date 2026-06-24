
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Suspense, useState, useMemo } from "react";
import { fetchAllSales, fetchAllProfiles, fetchAllClients } from "@/lib/admin";
import type { Sale, Client } from "@/lib/agro";
import type { AdminProfile } from "@/lib/admin";
import { brl, tons } from "@/lib/agro";
import {
  BarChart3, Download, ChevronDown, ChevronUp,
  Search, User, Users, Filter, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const salesOpts    = queryOptions({ queryKey: ["admin", "all-sales"],    queryFn: fetchAllSales });
const profilesOpts = queryOptions({ queryKey: ["admin", "all-profiles"], queryFn: fetchAllProfiles });
const clientsOpts  = queryOptions({ queryKey: ["admin", "all-clients"],  queryFn: fetchAllClients });

export const Route = createFileRoute("/_admin/reports")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return Promise.all([
      qc.ensureQueryData(salesOpts),
      qc.ensureQueryData(profilesOpts),
      qc.ensureQueryData(clientsOpts),
    ]);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <AdminReports />
    </Suspense>
  ),
});

// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const STAGE_LABEL: Record<string, string> = {
  lead:        "Lead",
  contato:     "Contato",
  proposta:    "Proposta",
  negociacao:  "Negociação",
  venda:       "Venda",
  pos_venda:   "Pós-venda",
};

const STAGE_COLOR: Record<string, string> = {
  lead:        "bg-slate-100 text-slate-600",
  contato:     "bg-blue-50 text-blue-600",
  proposta:    "bg-amber-50 text-amber-700",
  negociacao:  "bg-orange-50 text-orange-700",
  venda:       "bg-emerald-50 text-emerald-700",
  pos_venda:   "bg-purple-50 text-purple-700",
};

// ─── Página principal ─────────────────────────────────────────────────────────

function AdminReports() {
  const { data: allSales    = [] } = useQuery(salesOpts);
  const { data: allProfiles = [] } = useQuery(profilesOpts);
  const { data: allClients  = [] } = useQuery(clientsOpts);

  const now = new Date();
  const [year,        setYear]        = useState(now.getFullYear());
  const [month,       setMonth]       = useState<number | "all">("all");
  const [vendorId,    setVendorId]    = useState<string>("all");
  const [clientId,    setClientId]    = useState<string>("all");
  const [searchSale,  setSearchSale]  = useState("");
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [view,        setView]        = useState<"resumo" | "detalhes">("resumo");

  // Maps para lookup rápido
  const profileMap = useMemo(() => {
    const m = new Map<string, AdminProfile>();
    allProfiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [allProfiles]);

  const clientMap = useMemo(() => {
    const m = new Map<string, Client>();
    allClients.forEach((c) => m.set(c.id, c));
    return m;
  }, [allClients]);

  const vendors = useMemo(
    () => allProfiles.filter((p) => p.role === "vendedor"),
    [allProfiles]
  );

  // Clientes do vendedor selecionado (ou todos)
  const clientsForFilter = useMemo(() => {
    if (vendorId === "all") return allClients;
    return allClients.filter((c) => c.vendor_id === vendorId);
  }, [allClients, vendorId]);

  // Anos disponíveis
  const years = useMemo(() => {
    const set = new Set(allSales.map((s) => new Date(s.sale_date).getFullYear()));
    if (set.size === 0) set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [allSales]);

  // Filtro principal
  const filteredSales = useMemo(() => {
    return allSales.filter((s) => {
      const d = new Date(s.sale_date);
      if (d.getFullYear() !== year) return false;
      if (month !== "all" && d.getMonth() + 1 !== month) return false;
      if (vendorId !== "all" && s.vendor_id !== vendorId) return false;
      if (clientId !== "all" && s.client_id !== clientId) return false;
      if (searchSale) {
        const q = searchSale.toLowerCase();
        const vendorName  = profileMap.get(s.vendor_id)?.full_name?.toLowerCase() ?? "";
        const clientName  = clientMap.get(s.client_id)?.name?.toLowerCase() ?? "";
        const product     = s.product?.toLowerCase() ?? "";
        if (!vendorName.includes(q) && !clientName.includes(q) && !product.includes(q)) return false;
      }
      return true;
    });
  }, [allSales, year, month, vendorId, clientId, searchSale, profileMap, clientMap]);

  // Totais do período filtrado
  const totals = useMemo(() => ({
    tons:       filteredSales.reduce((a, s) => a + Number(s.tons), 0),
    commission: filteredSales.reduce((a, s) => a + Number(s.total_commission), 0),
    count:      filteredSales.length,
    vendors:    new Set(filteredSales.map((s) => s.vendor_id)).size,
    clients:    new Set(filteredSales.map((s) => s.client_id)).size,
  }), [filteredSales]);

  // Resumo por vendedor
  const byVendor = useMemo(() => {
    const map = new Map<string, Sale[]>();
    vendors.forEach((v) => map.set(v.id, []));
    filteredSales.forEach((s) => {
      if (!map.has(s.vendor_id)) map.set(s.vendor_id, []);
      map.get(s.vendor_id)!.push(s);
    });
    return map;
  }, [filteredSales, vendors]);

  // Filtros ativos
  const hasFilters = vendorId !== "all" || clientId !== "all" || month !== "all" || searchSale !== "";

  function clearFilters() {
    setVendorId("all");
    setClientId("all");
    setMonth("all");
    setSearchSale("");
  }

  // Export CSV
  function exportCSV() {
    const rows: string[][] = [
      ["Data","Vendedor","Cliente","Produto","Toneladas","Comissão/t","Total Comissão","Stage"],
      ...filteredSales.map((s) => [
        s.sale_date,
        profileMap.get(s.vendor_id)?.full_name ?? s.vendor_id,
        clientMap.get(s.client_id)?.name ?? s.client_id,
        s.product,
        String(s.tons),
        String(s.commission_per_ton),
        String(s.total_commission),
        STAGE_LABEL[s.stage] ?? s.stage,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `agrotrial_${year}_${month === "all" ? "anual" : String(month).padStart(2, "0")}.csv`;
    a.click();
  }

  const periodLabel = month === "all"
    ? String(year)
    : `${MONTHS[Number(month) - 1]} ${year}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodLabel} · {totals.count} vendas · {totals.vendors} vendedor{totals.vendors !== 1 ? "es" : ""} · {totals.clients} cliente{totals.clients !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "resumo" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("resumo")}
            className="gap-1.5"
          >
            <Users className="h-3.5 w-3.5" /> Por vendedor
          </Button>
          <Button
            variant={view === "detalhes" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("detalhes")}
            className="gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5" /> Detalhes
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filtros</span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" /> Limpar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Ano */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ano</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Mês */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mês</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Todos os meses</option>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>

          {/* Vendedor */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Vendedor</label>
            <select
              value={vendorId}
              onChange={(e) => { setVendorId(e.target.value); setClientId("all"); }}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Todos os vendedores</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.full_name ?? v.email}</option>
              ))}
            </select>
          </div>

          {/* Cliente */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cliente</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Todos os clientes</option>
              {clientsForFilter.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Busca livre */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Busca</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Produto, vendedor…"
                value={searchSale}
                onChange={(e) => setSearchSale(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Toneladas",   value: tons(totals.tons),         color: "text-primary" },
          { label: "Comissões",   value: brl(totals.commission),    color: "text-amber-700 dark:text-amber-400" },
          { label: "Vendas",      value: totals.count,              color: "text-foreground" },
          { label: "Clientes",    value: totals.clients,            color: "text-foreground" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className={`mt-1 text-xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── VISÃO: RESUMO POR VENDEDOR ─────────────────────────────────────────── */}
      {view === "resumo" && (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Users className="h-4 w-4 text-primary" />
              Resumo por vendedor — {periodLabel}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Vendedor","Vendas","Clientes","Toneladas","Comissão/t","Total Comissão","% da Meta","Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground first:pl-6 first:text-left text-right last:text-center">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vendors.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">Nenhum vendedor.</td></tr>
                ) : (
                  vendors
                    .filter((v) => vendorId === "all" || v.id === vendorId)
                    .map((v) => {
                      const sales     = byVendor.get(v.id) ?? [];
                      const totalTons = sales.reduce((a, s) => a + Number(s.tons), 0);
                      const totalComm = sales.reduce((a, s) => a + Number(s.total_commission), 0);
                      const clients   = new Set(sales.map((s) => s.client_id)).size;
                      const goalPct   = v.monthly_goal_tons > 0 && month !== "all"
                        ? Math.min(999, (totalTons / v.monthly_goal_tons) * 100)
                        : null;

                      return (
                        <tr key={v.id} className={`transition-colors hover:bg-muted/30 ${!v.active ? "opacity-50" : ""}`}>
                          <td className="px-6 py-4">
                            <p className="font-semibold">{v.full_name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">{v.email}</p>
                          </td>
                          <td className="px-4 py-4 text-right">{sales.length}</td>
                          <td className="px-4 py-4 text-right">{clients}</td>
                          <td className="px-4 py-4 text-right font-mono font-semibold">{tons(totalTons)}</td>
                          <td className="px-4 py-4 text-right text-muted-foreground">{brl(v.commission_per_ton)}/t</td>
                          <td className="px-4 py-4 text-right font-mono font-bold text-amber-700 dark:text-amber-400">{brl(totalComm)}</td>
                          <td className="px-4 py-4 text-right">
                            {goalPct !== null ? (
                              <span className={`font-bold ${goalPct >= 100 ? "text-emerald-600" : goalPct >= 60 ? "text-amber-600" : "text-red-500"}`}>
                                {goalPct.toFixed(0)}%
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              v.active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                            }`}>
                              {v.active ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
              {vendors.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/60 font-bold">
                    <td className="px-6 py-3 text-sm">Total geral</td>
                    <td className="px-4 py-3 text-right text-sm">{totals.count}</td>
                    <td className="px-4 py-3 text-right text-sm">{totals.clients}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{tons(totals.tons)}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right font-mono text-sm text-amber-700 dark:text-amber-400">{brl(totals.commission)}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {/* ── VISÃO: DETALHES POR VENDA ──────────────────────────────────────────── */}
      {view === "detalhes" && (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <BarChart3 className="h-4 w-4 text-primary" />
              Detalhamento de vendas — {filteredSales.length} resultado{filteredSales.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="w-8 px-4 py-3" />
                  {["Data","Vendedor","Cliente","Produto","Toneladas","Comissão","Stage"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground first:text-left text-right last:text-center">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSales.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">Nenhuma venda no período selecionado.</td></tr>
                ) : (
                  filteredSales.map((s) => {
                    const vendor  = profileMap.get(s.vendor_id);
                    const client  = clientMap.get(s.client_id);
                    const open    = expandedId === s.id;

                    return (
                      <>
                        {/* Linha principal */}
                        <tr
                          key={s.id}
                          className="cursor-pointer transition-colors hover:bg-muted/30"
                          onClick={() => setExpandedId(open ? null : s.id)}
                        >
                          <td className="px-4 py-3 text-center">
                            {open
                              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            }
                          </td>
                          <td className="px-4 py-3 text-left text-muted-foreground">
                            {new Date(s.sale_date).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-medium">{vendor?.full_name ?? "—"}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold">{client?.name ?? "—"}</span>
                            {client?.city && (
                              <span className="ml-1 text-xs text-muted-foreground">· {client.city}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">{s.product}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">{tons(Number(s.tons))}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                            {brl(Number(s.total_commission))}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STAGE_COLOR[s.stage] ?? "bg-muted text-muted-foreground"}`}>
                              {STAGE_LABEL[s.stage] ?? s.stage}
                            </span>
                          </td>
                        </tr>

                        {/* Linha expandida — detalhes da venda */}
                        {open && (
                          <tr key={`${s.id}-detail`} className="bg-muted/20">
                            <td />
                            <td colSpan={7} className="px-6 py-4">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
                                <Detail label="Vendedor"      value={vendor?.full_name ?? "—"} />
                                <Detail label="E-mail"        value={vendor?.email ?? "—"} />
                                <Detail label="Comissão/t"    value={brl(s.commission_per_ton)} />
                                <Detail label="Total comissão" value={brl(Number(s.total_commission))} highlight />

                                <Detail label="Cliente"       value={client?.name ?? "—"} />
                                <Detail label="Fazenda"       value={client?.farm ?? "—"} />
                                <Detail label="Cidade"        value={client?.city ? `${client.city}${client.state ? ` / ${client.state}` : ""}` : "—"} />
                                <Detail label="Telefone"      value={client?.phone ?? "—"} />

                                <Detail label="Produto"       value={s.product} />
                                <Detail label="Toneladas"     value={tons(Number(s.tons))} />
                                {s.price_per_ton != null && (
                                  <Detail label="Preço/t"     value={brl(s.price_per_ton)} />
                                )}
                                {s.delivery_date && (
                                  <Detail label="Entrega"     value={new Date(s.delivery_date).toLocaleDateString("pt-BR")} />
                                )}

                                {s.notes && (
                                  <div className="col-span-full">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Observações</p>
                                    <p className="mt-0.5 text-foreground">{s.notes}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Componente auxiliar ──────────────────────────────────────────────────────

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-medium ${highlight ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}