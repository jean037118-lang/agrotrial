/**
 * _admin/users.$id.tsx
 * Formulário de edição de um usuário específico.
 * Admin pode alterar: nome, role, comissão, meta, dias de recompra, status.
 */

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { Suspense, useState, useEffect } from "react";
import { fetchProfileById, adminUpdateUser } from "@/lib/admin";
import { brl } from "@/lib/agro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, User, PowerOff, Power } from "lucide-react";

// ─── Rota ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/users/$id")({
  loader: async ({ context, params }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return qc.ensureQueryData(
      queryOptions({
        queryKey: ["admin", "profile", params.id],
        queryFn: () => fetchProfileById(params.id),
      })
    );
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <EditUserPage />
    </Suspense>
  ),
});

// ─── Página ───────────────────────────────────────────────────────────────────

function EditUserPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery(
    queryOptions({
      queryKey: ["admin", "profile", id],
      queryFn: () => fetchProfileById(id),
    })
  );

  const [form, setForm] = useState({
    full_name:    "",
    role:         "vendedor" as "admin" | "vendedor",
    commission:   "8",
    monthly_goal: "1000",
    recall_days:  "60",
    active:       true,
  });

  // Preenche o form quando o profile carrega
  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name:    profile.full_name ?? "",
      role:         profile.role,
      commission:   String(profile.commission_per_ton),
      monthly_goal: String(profile.monthly_goal_tons),
      recall_days:  String(profile.recall_days),
      active:       profile.active,
    });
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: () =>
      adminUpdateUser({
        user_id:      id,
        full_name:    form.full_name,
        role:         form.role,
        commission:   Number(form.commission),
        monthly_goal: Number(form.monthly_goal),
        recall_days:  Number(form.recall_days),
        active:       form.active,
      }),
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso.");
      qc.invalidateQueries({ queryKey: ["admin"] });
      navigate({ to: "/admin/users" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const f = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl text-center py-12">
        <p className="text-muted-foreground">Usuário não encontrado.</p>
        <Link to="/admin/users" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          ← Voltar para usuários
        </Link>
      </div>
    );
  }

  const cpt = Number(form.commission) || 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link to="/admin/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Editar usuário
          </h1>
          <p className="text-sm text-muted-foreground">{profile.email ?? "—"}</p>
        </div>
      </div>

      {/* Badge de status atual */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-5 py-3">
        {form.role === "admin"
          ? <ShieldCheck className="h-5 w-5 text-primary" />
          : <User className="h-5 w-5 text-muted-foreground" />
        }
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{profile.full_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground capitalize">{form.role}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
          form.active
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-600"
        }`}>
          {form.active ? "Ativo" : "Inativo"}
        </span>
      </div>

      {/* Formulário */}
      <Card>
        <CardContent className="p-6">
          <form
            onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
            className="space-y-5"
          >
            {/* Nome */}
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                required
                value={form.full_name}
                onChange={f("full_name")}
                placeholder="Nome do vendedor"
              />
            </div>

            {/* Perfil */}
            <div className="space-y-1.5">
              <Label>Perfil de acesso</Label>
              <select
                value={form.role}
                onChange={f("role")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Administradores não têm acesso à área operacional de vendas.
              </p>
            </div>

            {/* Comissão e meta — só para vendedor */}
            {form.role === "vendedor" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Comissão por tonelada (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.commission}
                      onChange={f("commission")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Meta mensal (toneladas)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={form.monthly_goal}
                      onChange={f("monthly_goal")}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Recompra automática (dias)</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={form.recall_days}
                    onChange={f("recall_days")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Cliente aparece como "precisa ligar" após esse número de dias sem comprar.
                  </p>
                </div>

                {/* Preview de comissão */}
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  Exemplo: 50 toneladas × {brl(cpt)} ={" "}
                  <strong className="text-primary">{brl(50 * cpt)}</strong> de comissão.
                </div>
              </>
            )}

            {/* Status ativo/inativo */}
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Status da conta</p>
                  <p className="text-xs text-muted-foreground">
                    Usuários inativos não conseguem fazer login.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={form.active ? "destructive" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={() => setForm((prev) => ({ ...prev, active: !prev.active }))}
                >
                  {form.active
                    ? <><PowerOff className="h-4 w-4" /> Desativar</>
                    : <><Power    className="h-4 w-4" /> Ativar</>
                  }
                </Button>
              </div>
            </div>

            {/* Rodapé do form */}
            <div className="flex items-center justify-between pt-2">
              <Link to="/admin/users">
                <Button type="button" variant="ghost">Cancelar</Button>
              </Link>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
