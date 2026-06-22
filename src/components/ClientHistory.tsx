import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchClientInteractions, INTERACTION_LABEL, INTERACTION_COLOR,
  type Client, type Sale, type InteractionType, type Interaction,
  tons, brl,
} from "@/lib/agro";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Phone, MessageCircle, MapPinned, Users, FileText,
  ShoppingCart, PackageCheck, Mail, MoreHorizontal, Plus, Clock,
} from "lucide-react";
import { toast } from "sonner";

const ICONS: Record<InteractionType, React.ComponentType<{ className?: string }>> = {
  ligacao: Phone,
  whatsapp: MessageCircle,
  visita: MapPinned,
  reuniao: Users,
  proposta: FileText,
  venda: ShoppingCart,
  pos_venda: PackageCheck,
  email: Mail,
  outro: MoreHorizontal,
};

interface ClientHistoryProps {
  client: Client | null;
  sales: Sale[];
  onClose: () => void;
}

export function ClientHistory({ client, sales, onClose }: ClientHistoryProps) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<InteractionType>("ligacao");
  const [newNotes, setNewNotes] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ["interactions", client?.id],
    queryFn: () => fetchClientInteractions(client!.id),
    enabled: !!client,
  });

  const clientSales = sales.filter((s) => s.client_id === client?.id);

  // Combina interações + vendas numa única timeline cronológica
  const timeline = [
    ...interactions.map((i) => ({
      kind: "interaction" as const,
      date: i.occurred_at,
      data: i,
    })),
    ...clientSales.map((s) => ({
      kind: "sale" as const,
      date: s.sale_date,
      data: s,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  async function addInteraction() {
    if (!client) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("Sessão expirou."); }
    const { error } = await supabase.from("interactions").insert({
      vendor_id: user.id,
      client_id: client.id,
      type: newType,
      notes: newNotes || null,
      occurred_at: new Date(newDate + "T12:00:00").toISOString(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Interação registrada.");
    setNewNotes("");
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["interactions", client.id] });
  }

  async function removeInteraction(id: string) {
    if (!confirm("Excluir este registro do histórico?")) return;
    const { error } = await supabase.from("interactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["interactions", client?.id] });
  }

  return (
    <Sheet open={!!client} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {client && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display text-2xl text-primary">{client.name}</SheetTitle>
              <SheetDescription>
                {[client.farm, client.city && client.state ? `${client.city}/${client.state}` : null]
                  .filter(Boolean).join(" • ") || "Histórico de relacionamento"}
              </SheetDescription>
            </SheetHeader>

            {/* Resumo rápido */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total comprado</div>
                <div className="font-display text-lg font-semibold text-primary">
                  {tons(clientSales.reduce((a, s) => a + Number(s.tons), 0))}
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Interações</div>
                <div className="font-display text-lg font-semibold text-primary">{interactions.length}</div>
              </div>
            </div>

            {/* Botão adicionar */}
            <div className="mt-5">
              {!adding ? (
                <Button variant="outline" className="w-full gap-2" onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" /> Registrar interação
                </Button>
              ) : (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={newType} onValueChange={(v) => setNewType(v as InteractionType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(INTERACTION_LABEL) as InteractionType[])
                          .filter((t) => t !== "venda") // venda vem do módulo de vendas
                          .map((t) => (
                            <SelectItem key={t} value={t}>{INTERACTION_LABEL[t]}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <input
                      type="date" value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <Textarea
                    placeholder="O que foi conversado, combinado ou observado…"
                    rows={3} value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
                    <Button size="sm" onClick={addInteraction} disabled={saving}>
                      {saving ? "Salvando…" : "Salvar"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="mt-6">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Linha do tempo
              </h4>

              {isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando…</div>
              ) : timeline.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  <Clock className="mx-auto mb-2 h-8 w-8 opacity-20" />
                  Nenhum histórico ainda. Registre a primeira interação.
                </div>
              ) : (
                <ol className="relative space-y-5 border-l border-border pl-5">
                  {timeline.map((item, idx) => {
                    if (item.kind === "sale") {
                      const s = item.data as Sale;
                      return (
                        <li key={`sale-${s.id}`} className="relative">
                          <span className="absolute -left-[27px] grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                            <ShoppingCart className="h-3 w-3" />
                          </span>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <Badge className="bg-primary/15 text-primary">Venda</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(s.sale_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {s.product} — {tons(Number(s.tons))}
                          </p>
                          <p className="text-xs text-earth font-medium">{brl(Number(s.total_commission))} de comissão</p>
                        </li>
                      );
                    }

                    const it = item.data as Interaction;
                    const Icon = ICONS[it.type] ?? MoreHorizontal;
                    return (
                      <li key={`int-${it.id}`} className="relative group">
                        <span className={`absolute -left-[27px] grid h-6 w-6 place-items-center rounded-full ${INTERACTION_COLOR[it.type]}`}>
                          <Icon className="h-3 w-3" />
                        </span>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Badge className={INTERACTION_COLOR[it.type]}>{INTERACTION_LABEL[it.type]}</Badge>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(it.occurred_at).toLocaleDateString("pt-BR")}
                            </span>
                            <button
                              onClick={() => removeInteraction(it.id)}
                              className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                            >
                              remover
                            </button>
                          </div>
                        </div>
                        {it.notes && <p className="mt-1 text-sm text-foreground">{it.notes}</p>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
