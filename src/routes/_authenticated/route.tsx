/**
 * _authenticated/route.tsx
 * Layout raiz das rotas de vendedor (dashboard, clientes, vendas, agenda…).
 *
 * Alterações RBAC (Etapa 3):
 *   - beforeLoad agora verifica role além de sessão
 *   - Se o usuário logado for admin → redireciona para /admin/dashboard
 *   - Se o usuário estiver inativo   → redireciona para /auth
 *   - Vendedor ativo → acesso normal (comportamento anterior mantido)
 */

import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchAuthProfile } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // 1. Verifica se há sessão ativa
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // 2. Busca perfil com role
    const profile = await fetchAuthProfile();

    // 3. Sem perfil (raro — trigger pode ter falhado)
    if (!profile) throw redirect({ to: "/auth" });

    // 4. Usuário inativo → bloqueia acesso
    if (!profile.active) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    // 5. Admin não acessa rotas de vendedor → redireciona para painel admin
    if (profile.role === "admin") {
      throw redirect({ to: "/admin/dashboard" });
    }

    // 6. Vendedor ativo → passa o user e profile para o contexto da rota
    return { user: data.user, profile };
  },
  component: AuthedLayout,
});

// ─── Mapa de títulos por rota ─────────────────────────────────────────────────

const TITLES: Record<string, string> = {
  "/dashboard":         "Dashboard",
  "/clients":           "Clientes",
  "/sales":             "Vendas",
  "/future-sales":      "Previsão de vendas",
  "/agenda":            "Agenda",
  "/gypsum-calculator": "Calculadora de Gesso",
  "/ranking":           "Ranking",
  "/reports":           "Relatórios",
  "/settings":          "Configurações",
};

// ─── Layout do vendedor ───────────────────────────────────────────────────────

function AuthedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = TITLES[pathname] ?? "AgroTrial";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="hidden items-center gap-1.5 text-sm sm:flex">
              <span className="font-medium text-muted-foreground">AgroTrial CRM</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="font-semibold text-foreground tracking-tight">{title}</span>
            </div>
          </header>
          <main className="flex-1 px-4 py-8 md:px-8 lg:px-10">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
