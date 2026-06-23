/**
 * _authenticated/settings.tsx
 * Configurações do vendedor.
 *
 * Alterações RBAC (Etapa 5):
 *   - Campo "Comissão por tonelada" agora é somente leitura para o vendedor.
 *     O valor é exibido mas não pode ser alterado — apenas o admin define via painel.
 *   - Vendedor ainda pode editar: nome, meta mensal e dias de recompra.
 *   - O upsert no Supabase omite commission_per_ton (a RLS bloquearia mesmo assim).
 */

import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { Suspense, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfile, brl } from "@/lib/agro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock } from "lucide-react";

const profileOpts = queryOptions({ queryKey: ["profile"], queryFn: fetchProfile });

export const Route = createFileRoute("/_authenticated/settings")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return qc.ensureQueryData(profileOpts);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <SettingsPage />
    </Suspense>
  ),
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: profile } = useSuspenseQuery(profileOpts);
  const [saving, setSaving] = useState(false);

  // Campos editáveis pelo vendedor (comissão excluída)
  const [form, setForm] = useState({
    full_name:         profile?.full_name ?? "",
    monthly_goal_tons: String(profile?.monthly_goal_tons ?? 1000),
    recall_days:       String(profile?.recall_days ?? 60),
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name:         profile.full_name ?? "",
        monthly_goal_tons: String(profile.monthly_goal_tons),
        recall_days:       String(profile.recall_days),
      });
    }
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return toast.error("Sessão expirou. Faça login novamente.");
    }

    // Salva apenas os campos permitidos para o vendedor.
    // commission_per_ton é intencionalmente omitido.
    const { error } = await supabase.from("profiles").update({
      full_name:         form.full_name,
      monthly_goal_tons: Number(form.monthly_goal_tons),
      recall_days:       Number(form.recall_days),
    }).eq("id", user.id);

    setSaving(false);
    if (error) return toast.error(error.message);

    toast.success("Configurações salvas.");
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["auth-profile"] });
  }

  const cpt = Number(profile?.commission_per_ton) || 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">Configurações</h1>
        <p className="text-muted-foreground">Meta mensal e preferências da sua conta.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={save} className="space-y-4">

            {/* Nome */}
            <div className="space-y-1.5">
              <Label>Seu nome</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Seu nome completo"
              />
            </div>

            {/* Comissão — somente leitura, definida pelo admin */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Comissão por tonelada (R$)
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  <Lock className="h-2.5 w-2.5" />
                  Definida pelo admin
                </span>
              </Label>
              <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {brl(cpt)} / tonelada
              </div>
              <p className="text-xs text-muted-foreground">
                Para alterar a comissão, entre em contato com o administrador.
              </p>
            </div>

            {/* Meta e recompra */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Meta mensal (toneladas)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={form.monthly_goal_tons}
                  onChange={(e) => setForm({ ...form, monthly_goal_tons: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Recompra automática (dias)</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={form.recall_days}
                  onChange={(e) => setForm({ ...form, recall_days: e.target.value })}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Cliente aparece como "precisa ligar" após esse número de dias sem comprar.
            </p>

            {/* Preview de comissão */}
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              Exemplo: 50 toneladas × {brl(cpt)} ={" "}
              <strong className="text-earth">{brl(50 * cpt)}</strong> de comissão.
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
