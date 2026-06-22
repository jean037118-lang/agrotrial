import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchClients, fetchSales, tons, daysSince, POTENTIAL_LABEL,
  type Client, type Sale,
} from "@/lib/agro";
import { ClientsMap } from "@/components/ClientsMap";
import { ClientHistory } from "@/components/ClientHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, MapPin, Phone, MessageCircle, Wheat, Trash2,
  List, Map as LucideMapIcon, Pencil, User, History,
} from "lucide-react";
import { toast } from "sonner";

const clientsOpts = queryOptions({ queryKey: ["clients"], queryFn: fetchClients });
const salesOpts = queryOptions({ queryKey: ["sales"], queryFn: fetchSales });

export const Route = createFileRoute("/_authenticated/clients")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return Promise.all([qc.ensureQueryData(clientsOpts), qc.ensureQueryData(salesOpts)]);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <ClientsPage />
    </Suspense>
  ),
});

const TODOS = "todos";

function ClientsPage() {
  const qc = useQueryClient();
  const { data: clients } = useSuspenseQuery(clientsOpts);
  const { data: sales } = useSuspenseQuery(salesOpts);
  const [query, setQuery] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [view, setView] = useState<"lista" | "mapa">("lista");
  const [stateFilter, setStateFilter] = useState(TODOS);
  const [cityFilter, setCityFilter] = useState(TODOS);

  const aggregates = useMemo(() => {
    const map = new globalThis.Map<string, { tons: number; last: string | null; bySale: { product: string; tons: number; date: string }[] }>();
    for (const s of sales as Sale[]) {
      const prev = map.get(s.client_id) ?? { tons: 0, last: null, bySale: [] };
      prev.tons += Number(s.tons);
      if (!prev.last || s.sale_date > prev.last) prev.last = s.sale_date;
      prev.bySale.push({ product: s.product, tons: Number(s.tons), date: s.sale_date });
      map.set(s.client_id, prev);
    }
    return map;
  }, [sales]);

  const states = useMemo(() => {
    const set = new globalThis.Set<string>();
    for (const c of clients) if (c.state) set.add(c.state);
    return Array.from(set).sort();
  }, [clients]);

  const cities = useMemo(() => {
    const set = new globalThis.Set<string>();
    for (const c of clients) {
      if (!c.city) continue;
      if (stateFilter !== TODOS && c.state !== stateFilter) continue;
      set.add(c.city);
    }
    return Array.from(set).sort();
  }, [clients, stateFilter]);

  const filtered = clients.filter((c) => {
    const matchesQuery = [c.name, c.farm, c.city, c.state, c.culture]
      .filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesState = stateFilter === TODOS || c.state === stateFilter;
    const matchesCity = cityFilter === TODOS || c.city === cityFilter;
    return matchesQuery && matchesState && matchesCity;
  });

  function onStateChange(v: string) {
    setStateFilter(v);
    setCityFilter(TODOS);
  }

  async function deleteClient(id: string) {
    if (!confirm("Excluir este cliente e todas as vendas dele?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cliente removido.");
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["sales"] });
  }

  async function geocodeAll() {
    const sem = clients.filter((c) => !c.lat && (c.city || c.state));
    if (sem.length === 0) return toast.info("Todos os clientes já têm coordenadas.");
    toast.info(`Buscando coordenadas para ${sem.length} cliente(s)…`);
    let ok = 0;
    for (const c of sem) {
      try {
        const q = encodeURIComponent(`${c.city}, ${c.state}, Brasil`);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, { headers: { "Accept-Language": "pt-BR" } });
        const data = await res.json();
        if (data.length > 0) {
          await supabase.from("clients").update({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }).eq("id", c.id);
          ok++;
        }
        await new Promise((r) => setTimeout(r, 1100));
      } catch { /* ignorar */ }
    }
    toast.success(`${ok} cliente(s) atualizados.`);
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Clientes</h1>
          <p className="text-muted-foreground">{clients.length} cadastrados</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="gap-1"><Plus className="h-4 w-4" /> Novo cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
            <ClientForm
              initial={null}
              onDone={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["clients"] }); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, fazenda, cidade ou cultura…" className="pl-9" />
        </div>
        <Select value={stateFilter} onValueChange={onStateChange}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os estados</SelectItem>
            {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Cidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as cidades</SelectItem>
            {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex rounded-lg border border-border p-0.5">
          <Button size="sm" variant={view === "lista" ? "secondary" : "ghost"} className="gap-1.5" onClick={() => setView("lista")}>
            <List className="h-3.5 w-3.5" /> Lista
          </Button>
          <Button size="sm" variant={view === "mapa" ? "secondary" : "ghost"} className="gap-1.5" onClick={() => setView("mapa")}>
            <LucideMapIcon className="h-3.5 w-3.5" /> Mapa
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      {view === "mapa" ? (
        <div className="space-y-2">
          {clients.some((c) => !c.lat) && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <span>Alguns clientes não têm coordenadas e não aparecem no mapa.</span>
              <Button size="sm" variant="outline" className="ml-3 border-amber-300 text-amber-800 hover:bg-amber-100" onClick={geocodeAll}>
                Buscar coordenadas
              </Button>
            </div>
          )}
          <ClientsMap clients={filtered} sales={sales as Sale[]} />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum cliente {query && "encontrado"}. Cadastre o primeiro 🌱
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((c) => {
            const agg = aggregates.get(c.id);
            const d = daysSince(agg?.last ?? null);
            const topProducts = agg?.bySale.reduce((acc, s) => {
              acc[s.product] = (acc[s.product] ?? 0) + s.tons;
              return acc;
            }, {} as Record<string, number>) ?? {};
            const topList = Object.entries(topProducts).sort((a, b) => b[1] - a[1]).slice(0, 3);

            return (
              <Card
                key={c.id}
                className="overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
                onClick={() => setHistoryClient(c)}
              >
                <CardContent className="p-5">
                  {/* Cabeçalho */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="truncate font-display text-base font-semibold text-primary">{c.name}</h3>
                          <PotentialBadge p={c.potential} />
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{c.farm ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => setHistoryClient(c)} aria-label="Histórico" title="Ver histórico">
                        <History className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditClient(c)} aria-label="Editar">
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteClient(c.id)} aria-label="Excluir">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  {/* Infos */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <Info icon={MapPin} text={[c.city, c.state].filter(Boolean).join("/") || "—"} />
                    <Info icon={Wheat} text={c.culture || "—"} />
                    <Info icon={Phone} text={c.phone || "—"} />
                    {c.whatsapp ? (
                      <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                        target="_blank" rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-success hover:underline">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    ) : <div />}
                  </div>

                  {/* Histórico por produto */}
                  {topList.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Compras por produto</div>
                      {topList.map(([prod, t]) => (
                        <div key={prod} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate max-w-[160px]">{prod}</span>
                          <span className="font-semibold text-foreground">{tons(t)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rodapé */}
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total histórico</div>
                      <div className="font-display text-base font-semibold text-primary">{tons(agg?.tons ?? 0)}</div>
                    </div>
                    <Badge variant={d === null || d >= 60 ? "outline" : "secondary"}
                      className={d === null || d >= 60 ? "border-orange-300 text-orange-600" : "bg-emerald-100 text-emerald-700"}>
                      {d === null ? "Nunca comprou" : d === 0 ? "Hoje" : `${d}d atrás`}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog editar */}
      <Dialog open={!!editClient} onOpenChange={(v) => { if (!v) setEditClient(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          {editClient && (
            <ClientForm
              initial={editClient}
              onDone={() => { setEditClient(null); qc.invalidateQueries({ queryKey: ["clients"] }); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Painel de histórico/timeline */}
      <ClientHistory
        client={historyClient}
        sales={sales as Sale[]}
        onClose={() => setHistoryClient(null)}
      />
    </div>
  );
}

function PotentialBadge({ p }: { p: Client["potential"] }) {
  const cls =
    p === "grande" ? "bg-emerald-100 text-emerald-700" :
    p === "medio" ? "bg-amber-100 text-amber-700" :
    "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>{POTENTIAL_LABEL[p]}</span>;
}

function Info({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{text}</span>
    </div>
  );
}

function ClientForm({ initial, onDone }: { initial: Client | null; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    farm: initial?.farm ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    phone: initial?.phone ?? "",
    whatsapp: initial?.whatsapp ?? "",
    email: initial?.email ?? "",
    culture: initial?.culture ?? "",
    potential: (initial?.potential ?? "medio") as Client["potential"],
    notes: initial?.notes ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("Sessão expirou."); }

    if (initial) {
      const { error } = await supabase.from("clients").update({ ...form }).eq("id", initial.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Cliente atualizado.");
    } else {
      let lat: number | null = null;
      let lng: number | null = null;
      if (form.city || form.state) {
        try {
          const q = encodeURIComponent(`${form.city}, ${form.state}, Brasil`);
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, { headers: { "Accept-Language": "pt-BR" } });
          const data = await res.json();
          if (data.length > 0) { lat = parseFloat(data[0].lat); lng = parseFloat(data[0].lon); }
        } catch { /* sem coordenadas */ }
      }
      const { error } = await supabase.from("clients").insert({ ...form, vendor_id: user.id, lat, lng });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Cliente cadastrado.");
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <Field label="Nome *"><Input required value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <Field label="Fazenda"><Input value={form.farm} onChange={(e) => set("farm", e.target.value)} /></Field>
      <Field label="Cidade"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
      <Field label="Estado"><Input maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} /></Field>
      <Field label="Telefone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
      <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="55DDDNUMERO" /></Field>
      <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
      <Field label="Cultura">
        <Select value={form.culture} onValueChange={(v) => set("culture", v)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {["Soja","Milho","Algodão","Cana","Café","Pastagem","Horticultura","Outras"].map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Potencial de compra">
        <Select value={form.potential} onValueChange={(v) => set("potential", v as Client["potential"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pequeno">Pequeno</SelectItem>
            <SelectItem value="medio">Médio</SelectItem>
            <SelectItem value="grande">Grande</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Observações">
          <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>
      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : initial ? "Salvar alterações" : "Cadastrar cliente"}</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
