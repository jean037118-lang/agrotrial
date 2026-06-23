/**
 * routes/_admin/route.tsx
 * Layout raiz do painel administrativo.
 *
 * IMPORTANTE: Este arquivo deve ser _admin/route.tsx (dentro de pasta),
 * NÃO _admin.tsx (arquivo solto). O plugin Vite do TanStack Router trata
 * arquivos soltos _nome.tsx como conflitantes com index.tsx no build.
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
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ChevronRight, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });

    const profile = await fetchAuthProfile();
    if (!profile) throw redirect({ to: "/auth" });

    if (!profile.active) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    if (profile.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }

    return { user: data.session.user, profile };
  },
  component: AdminLayout,
});

const ADMIN_TITLES: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/ranking":   "Ranking de Vendedores",
  "/admin/reports":   "Relatórios",
  "/admin/users":     "Gerenciar Usuários",
};

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = pathname.startsWith("/admin/users/")
    ? "Editar Usuário"
    : ADMIN_TITLES[pathname] ?? "Administração";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="hidden items-center gap-1.5 text-sm sm:flex">
              <div className="flex items-center gap-1 font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>AgroTrial Admin</span>
              </div>
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
