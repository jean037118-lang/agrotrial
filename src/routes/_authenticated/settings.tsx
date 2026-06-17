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
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    commission_per_ton: String(profile?.commission_per_ton ?? 8),
    monthly_goal_tons: String(profile?.monthly_goal_tons ?? 1000),
    recall_days: String(profile?.recall_days ?? 60),
  });

  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name ?? "",
      commission_per_ton: String(profile.commission_per_ton),
      monthly_goal_tons: String(profile.monthly_goal_tons),
      recall_days: String(profile.recall_days),
    });
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("Sessão expirou."); }
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: form.full_name,
      commission_per_ton: Number(form.commission_per_ton),
      monthly_goal_tons: Number(form.monthly_goal_tons),
      recall_days: Number(form.recall_days),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas.");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  const cpt = Number(form.commission_per_ton) || 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">Configurações</h1>
        <p className="text-muted-foreground">Comissão, meta mensal e recompra automática.</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Seu nome</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Comissão por tonelada (R$)</Label>
                <Input type="number" step="0.01" value={form.commission_per_ton}
                  onChange={(e) => setForm({ ...form, commission_per_ton: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Meta mensal (toneladas)</Label>
                <Input type="number" step="1" value={form.monthly_goal_tons}
                  onChange={(e) => setForm({ ...form, monthly_goal_tons: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Recompra automática (dias)</Label>
              <Input type="number" step="1" value={form.recall_days}
                onChange={(e) => setForm({ ...form, recall_days: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                Cliente aparece como "precisa ligar" após esse número de dias sem comprar.
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              Exemplo: 50 toneladas × {brl(cpt)} = <strong className="text-earth">{brl(50 * cpt)}</strong> de comissão.
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>Salvar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
