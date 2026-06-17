import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchClients, fetchFutureSales, fetchProfile, brl, tons,
} from "@/lib/agro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const clientsOpts = queryOptions({ queryKey: ["clients"], queryFn: fetchClients });
const futureOpts = queryOptions({ queryKey: ["future_sales"], queryFn: fetchFutureSales });
const profileOpts = queryOptions({ queryKey: ["profile"], queryFn: fetchProfile });

export const Route = createFileRoute("/_authenticated/future-sales")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return Promise.all([
      qc.ensureQueryData(clientsOpts),
      qc.ensureQueryData(futureOpts),
      qc.ensureQueryData(profileOpts),
    ]);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <FutureSalesPage />
    </Suspense>
  ),
});

function FutureSalesPage() {
  const qc = useQueryClient();
  const { data: clients } = useSuspenseQuery(clientsOpts);
  const { data: future } = useSuspenseQuery(futureOpts);
  const { data: profile } = useSuspenseQuery(profileOpts);
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const m = new Map<string, { month: string; tons: number; rows: typeof future }>();
    for (const f of future) {
      const key = f.expected_month.slice(0, 7);
      const prev = m.get(key) ?? { month: key, tons: 0, rows: [] as typeof future };
      prev.tons += Number(f.expected_tons);
      prev.rows.push(f);
      m.set(key, prev);
    }
    return [...m.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [future]);

  const cpt = profile?.commission_per_ton ?? 8;

  async function remove(id: string) {
    const { error } = await supabase.from("future_sales").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["future_sales"] });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Previsão de vendas</h1>
          <p className="text-muted-foreground">Quanto você espera vender nos próximos meses.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1" disabled={clients.length === 0}>
              <Plus className="h-4 w-4" /> Nova previsão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova previsão</DialogTitle></DialogHeader>
            <FutureForm clients={clients} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["future_sales"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      {grouped.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma previsão lançada.
          </CardContent>
        </Card>
      ) : (
        grouped.map((g) => (
          <Card key={g.month}>
            <CardContent className="p-5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {new Date(g.month + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </div>
                  <div className="font-display text-2xl font-semibold text-primary">{tons(g.tons)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Comissão prevista</div>
                  <div className="font-display text-xl font-semibold text-earth">{brl(g.tons * cpt)}</div>
                </div>
              </div>
              <div className="mt-4 divide-y divide-border border-t border-border">
                {g.rows.map((r) => {
                  const c = clients.find((x) => x.id === r.client_id);
                  return (
                    <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{c?.name ?? "Cliente"}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{tons(Number(r.expected_tons))}</span>
                        <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function FutureForm({
  clients, onDone,
}: { clients: { id: string; name: string }[]; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: clients[0]?.id ?? "",
    expected_tons: "",
    expected_month: new Date().toISOString().slice(0, 7),
    notes: "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("Sessão expirou."); }
    const { error } = await supabase.from("future_sales").insert({
      vendor_id: user.id,
      client_id: form.client_id,
      expected_tons: Number(form.expected_tons),
      expected_month: form.expected_month + "-01",
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Previsão registrada.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Cliente</Label>
        <Select value={form.client_id} onValueChange={(v) => set("client_id", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Toneladas previstas</Label>
          <Input type="number" step="0.01" required value={form.expected_tons} onChange={(e) => set("expected_tons", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Mês</Label>
          <Input type="month" required value={form.expected_month} onChange={(e) => set("expected_month", e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>Salvar previsão</Button>
      </div>
    </form>
  );
}
