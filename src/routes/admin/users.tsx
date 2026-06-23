/**
 * _admin/users.tsx
 * Gerenciamento de usuários — listagem com ações rápidas e acesso à edição.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import {
  fetchAllProfiles, adminUpdateUser, adminCreateUser, type AdminProfile,
} from "@/lib/admin";
import { brl } from "@/lib/agro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  UserPlus, Pencil, PowerOff, Power, Search,
  ShieldCheck, User,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const profilesOpts = queryOptions({
  queryKey: ["admin", "all-profiles"],
  queryFn: fetchAllProfiles,
});

export const Route = createFileRoute("/admin/users")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return qc.ensureQueryData(profilesOpts);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <UsersPage />
    </Suspense>
  ),
});

// ─── Página principal ──────────────────────────────────────────────────────────

function UsersPage() {
  const qc = useQueryClient();
  const { data: profiles = [] } = useQuery(profilesOpts);

  const [search, setSearch]           = useState("");
  const [showCreate, setShowCreate]   = useState(false);

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  });

  // Toggle ativo/inativo
  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminUpdateUser({ user_id: id, active }),
    onSuccess: (_, { active }) => {
      toast.success(active ? "Usuário ativado." : "Usuário desativado.");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Usuários
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profiles.length} usuário{profiles.length !== 1 ? "s" : ""} cadastrado{profiles.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Novo vendedor
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabela */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Usuário</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Perfil</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Comissão/t</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Meta/mês</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    {search ? "Nenhum resultado para a busca." : "Nenhum usuário cadastrado."}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">{p.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{p.email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <RoleBadge role={p.role} />
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-foreground">
                      {brl(p.commission_per_ton)}<span className="text-xs text-muted-foreground">/t</span>
                    </td>
                    <td className="px-4 py-4 text-right text-foreground">
                      {Number(p.monthly_goal_tons).toLocaleString("pt-BR")} t
                    </td>
                    <td className="px-4 py-4 text-center">
                      <StatusBadge active={p.active} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Editar */}
                        <Link to={`/admin/users/${p.id}`}>
                          <Button variant="ghost" size="icon" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        {/* Ativar / Inativar */}
                        <Button
                          variant="ghost"
                          size="icon"
                          title={p.active ? "Desativar" : "Ativar"}
                          disabled={toggleActive.isPending}
                          onClick={() =>
                            toggleActive.mutate({ id: p.id, active: !p.active })
                          }
                          className={
                            p.active
                              ? "text-muted-foreground hover:text-destructive"
                              : "text-muted-foreground hover:text-emerald-600"
                          }
                        >
                          {p.active
                            ? <PowerOff className="h-4 w-4" />
                            : <Power    className="h-4 w-4" />
                          }
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: criar vendedor */}
      <CreateUserDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          qc.invalidateQueries({ queryKey: ["admin"] });
        }}
      />
    </div>
  );
}

// ─── Modal de criação de usuário ───────────────────────────────────────────────

function CreateUserDialog({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    full_name:    "",
    email:        "",
    password:     "",
    role:         "vendedor" as "admin" | "vendedor",
    commission:   "8",
    monthly_goal: "1000",
    recall_days:  "60",
  });
  const [saving, setSaving] = useState(false);

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminCreateUser({
        email:        form.email,
        password:     form.password,
        full_name:    form.full_name,
        role:         form.role,
        commission:   Number(form.commission),
        monthly_goal: Number(form.monthly_goal),
        recall_days:  Number(form.recall_days),
      });
      toast.success(`Usuário ${form.full_name} criado com sucesso.`);
      setForm({ full_name: "", email: "", password: "", role: "vendedor", commission: "8", monthly_goal: "1000", recall_days: "60" });
      onCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuário.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input required value={form.full_name} onChange={f("full_name")} placeholder="João Silva" />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input required type="email" value={form.email} onChange={f("email")} placeholder="joao@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Senha inicial</Label>
            <Input required type="password" value={form.password} onChange={f("password")} placeholder="Mínimo 6 caracteres" minLength={6} />
          </div>
          <div className="space-y-1.5">
            <Label>Perfil</Label>
            <select
              value={form.role}
              onChange={f("role")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {form.role === "vendedor" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Comissão (R$/t)</Label>
                <Input type="number" step="0.01" value={form.commission} onChange={f("commission")} />
              </div>
              <div className="space-y-1.5">
                <Label>Meta mensal (t)</Label>
                <Input type="number" step="1" value={form.monthly_goal} onChange={f("monthly_goal")} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Criando…" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: "admin" | "vendedor" }) {
  return role === "admin" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
      <ShieldCheck className="h-3 w-3" /> Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
      <User className="h-3 w-3" /> Vendedor
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
      active
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
        : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
    }`}>
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}
