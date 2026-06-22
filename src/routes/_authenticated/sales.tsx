import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { Suspense, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchClients, fetchSales, fetchProfile, fetchProducts,
  brl, tons, qty, calcCommission,
  STAGES, STAGE_LABEL, UNIT_LABEL,
  type Sale, type Product,
} from "@/lib/agro";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowRight, Package, Pencil } from "lucide-react";
import { toast } from "sonner";

const profileOpts = queryOptions({ queryKey: ["profile"], queryFn: fetchProfile });
const clientsOpts = queryOptions({ queryKey: ["clients"], queryFn: fetchClients });
const salesOpts = queryOptions({ queryKey: ["sales"], queryFn: fetchSales });
const productsOpts = queryOptions({ queryKey: ["products"], queryFn: fetchProducts });

export const Route = createFileRoute("/_authenticated/sales")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return Promise.all([
      qc.ensureQueryData(profileOpts),
      qc.ensureQueryData(clientsOpts),
      qc.ensureQueryData(salesOpts),
      qc.ensureQueryData(productsOpts),
    ]);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <SalesPage />
    </Suspense>
  ),
});

function SalesPage() {
  const qc = useQueryClient();
  const { data: profile } = useSuspenseQuery(profileOpts);
  const { data: clients } = useSuspenseQuery(clientsOpts);
  const { data: sales } = useSuspenseQuery(salesOpts);
  const { data: products } = useSuspenseQuery(productsOpts);
  const [openSale, setOpenSale] = useState(false);
  const [openProduct, setOpenProduct] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [stageFilter, setStageFilter] = useState<Sale["stage"] | "todos">("todos");

  const totalTons = sales.reduce((a, s) => a + Number(s.tons), 0);
  const totalCommission = sales.reduce((a, s) => a + Number(s.total_commission), 0);

  const filtered = stageFilter === "todos" ? sales : sales.filter((s) => s.stage === stageFilter);

  const funnelCount = useMemo(() =>
    Object.fromEntries(STAGES.map((s) => [s, sales.filter((x) => x.stage === s).length])),
    [sales]
  );

  async function remove(id: string) {
    if (!confirm("Excluir esta venda?")) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Venda removida.");
    qc.invalidateQueries({ queryKey: ["sales"] });
  }

  async function updateStage(id: string, stage: Sale["stage"]) {
    const { error } = await supabase.from("sales").update({ stage }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["sales"] });
  }

  async function toggleProduct(id: string, active: boolean) {
    await supabase.from("products").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Tabs defaultValue="vendas">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold text-primary">Vendas</h1>
            <p className="text-muted-foreground">
              {sales.length} vendas • {tons(totalTons)} • {brl(totalCommission)} em comissão
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="vendas">Vendas</TabsTrigger>
              <TabsTrigger value="produtos">Produtos</TabsTrigger>
            </TabsList>
            <Dialog open={openSale} onOpenChange={setOpenSale}>
              <DialogTrigger asChild>
                <Button className="gap-1" disabled={clients.length === 0}>
                  <Plus className="h-4 w-4" /> Nova venda
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Nova venda</DialogTitle></DialogHeader>
                <SaleForm
                  defaultCommission={profile?.commission_per_ton ?? 8}
                  clients={clients}
                  products={products}
                  onDone={() => { setOpenSale(false); qc.invalidateQueries({ queryKey: ["sales"] }); }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ABA VENDAS */}
        <TabsContent value="vendas" className="space-y-5 mt-4">
          {/* Funil */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Funil comercial</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setStageFilter("todos")}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${stageFilter === "todos" ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"}`}
                >
                  <div className="text-[10px] uppercase tracking-wider">Todos</div>
                  <div className="font-display text-lg font-semibold">{sales.length}</div>
                </button>
                {STAGES.map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <button
                      onClick={() => setStageFilter(s === stageFilter ? "todos" : s)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${stageFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"}`}
                    >
                      <div className="text-[10px] uppercase tracking-wider">{STAGE_LABEL[s]}</div>
                      <div className="font-display text-lg font-semibold">{funnelCount[s]}</div>
                    </button>
                    {i < STAGES.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhuma venda {stageFilter !== "todos" && `em "${STAGE_LABEL[stageFilter as Sale["stage"]]}"`}.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {filtered.map((s) => {
                  const c = clients.find((x) => x.id === s.client_id);
                  return (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{c?.name ?? "Cliente"}</span>
                          <Badge variant="outline" className="text-xs">{s.product}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(s.sale_date).toLocaleDateString("pt-BR")}
                          {s.delivery_date && ` • entrega ${new Date(s.delivery_date).toLocaleDateString("pt-BR")}`}
                          {c?.city && ` • ${c.city}/${c.state}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-display text-base font-semibold text-primary">
                            {qty(Number(s.tons), s.unit ?? "ton")}
                          </div>
                          {s.price_per_ton && (
                            <div className="text-xs text-muted-foreground">
                              {brl(Number(s.price_per_ton))}/{s.unit ?? "t"}
                            </div>
                          )}
                          <div className="text-xs text-earth font-medium">{brl(Number(s.total_commission))}</div>
                        </div>
                        <Select value={s.stage} onValueChange={(v) => updateStage(s.id, v as Sale["stage"])}>
                          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STAGES.map((st) => (
                              <SelectItem key={st} value={st}>{STAGE_LABEL[st]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ABA PRODUTOS */}
        <TabsContent value="produtos" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{products.length} produto(s) cadastrado(s)</p>
            <Dialog open={openProduct} onOpenChange={(v) => { setOpenProduct(v); if (!v) setEditProduct(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Novo produto</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editProduct ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
                <ProductForm
                  initial={editProduct}
                  onDone={() => { setOpenProduct(false); setEditProduct(null); qc.invalidateQueries({ queryKey: ["products"] }); }}
                />
              </DialogContent>
            </Dialog>
          </div>

          {products.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                Nenhum produto cadastrado. Adicione gesso, calcário, agrotóxico…
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-4 gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Unidade: {UNIT_LABEL[p.unit] ?? p.unit} •{" "}
                        Comissão: {p.commission_type === "percent"
                          ? `${p.commission_value}%`
                          : `${brl(p.commission_value)}/${p.unit}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => { setEditProduct(p); setOpenProduct(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={p.active ? "outline" : "secondary"}
                        size="sm"
                        onClick={() => toggleProduct(p.id, !p.active)}
                      >
                        {p.active ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SaleForm({
  defaultCommission, clients, products, onDone,
}: {
  defaultCommission: number;
  clients: { id: string; name: string; city: string | null; state: string | null }[];
  products: Product[];
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: clients[0]?.id ?? "",
    product_id: "",
    product: "",
    unit: "ton",
    tons: "",
    price_per_ton: "",
    commission_per_ton: String(defaultCommission),
    commission_type: "per_unit" as "per_unit" | "percent",
    sale_date: new Date().toISOString().slice(0, 10),
    delivery_date: "",
    stage: "venda" as Sale["stage"],
    notes: "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  function selectProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    set("product_id", id);
    set("product", p.name);
    set("unit", p.unit);
    set("commission_per_ton", String(p.commission_value));
    set("commission_type", p.commission_type);
  }

  const quantity = Number(form.tons) || 0;
  const price = Number(form.price_per_ton) || 0;
  const commVal = Number(form.commission_per_ton) || 0;
  const preview = form.commission_type === "percent"
    ? (quantity * price * commVal) / 100
    : quantity * commVal;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_id) return toast.error("Selecione um cliente.");
    if (!form.product) return toast.error("Informe o produto.");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("Sessão expirou."); }

    const total_commission = form.commission_type === "percent"
      ? (quantity * price * commVal) / 100
      : quantity * commVal;

    const { error } = await supabase.from("sales").insert({
      vendor_id: user.id,
      client_id: form.client_id,
      product: form.product,
      product_id: form.product_id || null,
      unit: form.unit,
      tons: quantity,
      quantity,
      price_per_ton: price || null,
      commission_per_ton: commVal,
      total_commission,
      stage: form.stage,
      sale_date: form.sale_date,
      delivery_date: form.delivery_date || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);

    // Registra automaticamente no histórico/timeline do cliente
    await supabase.from("interactions").insert({
      vendor_id: user.id,
      client_id: form.client_id,
      type: "venda",
      notes: `${form.product} — ${quantity} ${form.unit}`,
      occurred_at: new Date(form.sale_date + "T12:00:00").toISOString(),
    });
    toast.success(`Venda registrada • ${brl(total_commission)} de comissão`);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Cliente">
        <Select value={form.client_id} onValueChange={(v) => set("client_id", v)}>
          <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}{c.city ? ` — ${c.city}/${c.state}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Produto do catálogo">
          <Select value={form.product_id} onValueChange={selectProduct}>
            <SelectTrigger><SelectValue placeholder="Selecione ou digite" /></SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Nome do produto *">
          <Input
            required value={form.product}
            onChange={(e) => set("product", e.target.value)}
            placeholder="Ex: Gesso Agrícola"
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Quantidade *">
          <Input type="number" step="0.001" required value={form.tons} onChange={(e) => set("tons", e.target.value)} />
        </Field>
        <Field label="Unidade">
          <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(UNIT_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Estágio">
          <Select value={form.stage} onValueChange={(v) => set("stage", v as Sale["stage"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label={`Preço/${form.unit}`}>
          <Input type="number" step="0.01" value={form.price_per_ton} onChange={(e) => set("price_per_ton", e.target.value)} />
        </Field>
        <Field label="Comissão">
          <Input type="number" step="0.01" required value={form.commission_per_ton} onChange={(e) => set("commission_per_ton", e.target.value)} />
        </Field>
        <Field label="Tipo comissão">
          <Select value={form.commission_type} onValueChange={(v) => set("commission_type", v as "per_unit" | "percent")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="per_unit">R$ por {form.unit}</SelectItem>
              <SelectItem value="percent">% do valor</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Data da venda"><Input type="date" value={form.sale_date} onChange={(e) => set("sale_date", e.target.value)} /></Field>
        <Field label="Entrega prevista"><Input type="date" value={form.delivery_date} onChange={(e) => set("delivery_date", e.target.value)} /></Field>
      </div>

      <Field label="Observações">
        <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Detalhes do pedido, condições, etc." />
      </Field>

      {/* Preview de comissão */}
      <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
        <div className="text-xs uppercase tracking-wider text-primary/70 mb-1">Comissão calculada</div>
        <div className="text-3xl font-bold text-primary">{brl(preview)}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {quantity} {form.unit} ×{" "}
          {form.commission_type === "percent"
            ? `${commVal}% de ${brl(price)}/${form.unit}`
            : `${brl(commVal)}/${form.unit}`}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar venda"}</Button>
      </div>
    </form>
  );
}

function ProductForm({ initial, onDone }: { initial: Product | null; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    unit: initial?.unit ?? "ton",
    commission_value: String(initial?.commission_value ?? ""),
    commission_type: initial?.commission_type ?? "per_unit" as "per_unit" | "percent",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("Sessão expirou."); }
    const payload = {
      name: form.name,
      unit: form.unit,
      commission_value: Number(form.commission_value),
      commission_type: form.commission_type,
    };
    const { error } = initial
      ? await supabase.from("products").update(payload).eq("id", initial.id)
      : await supabase.from("products").insert({ ...payload, vendor_id: user.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Produto atualizado." : "Produto cadastrado.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nome do produto *">
        <Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Gesso Agrícola, Calcário, Roundup" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unidade de venda">
          <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(UNIT_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tipo de comissão">
          <Select value={form.commission_type} onValueChange={(v) => set("commission_type", v as "per_unit" | "percent")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="per_unit">R$ por unidade</SelectItem>
              <SelectItem value="percent">% sobre o valor</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label={form.commission_type === "percent" ? "Comissão (%)" : `Comissão (R$ por ${form.unit})`}>
        <Input
          type="number" step="0.01" required
          value={form.commission_value}
          onChange={(e) => set("commission_value", e.target.value)}
          placeholder={form.commission_type === "percent" ? "Ex: 3.5" : "Ex: 8.00"}
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : initial ? "Atualizar" : "Cadastrar produto"}</Button>
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
