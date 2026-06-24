/**
 * app-sidebar.tsx
 * Sidebar do painel de VENDEDOR.
 *
 * Alterações RBAC (Etapa 3):
 *   - Itens do menu lidos via useProfile() — renderiza apenas rotas de vendedor
 *   - Admin nunca chega aqui (bloqueado em _authenticated/route.tsx)
 *   - Exibe nome e email do vendedor logado no rodapé
 */

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Receipt, CalendarDays, Trophy,
  LineChart, Settings, LogOut, Sprout, TrendingUp, Calculator,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import logo from "@/assets/agrotrial-logo.png";
import { useProfile } from "@/hooks/useProfile";

// ─── Itens do menu do vendedor ────────────────────────────────────────────────

const VENDOR_ITEMS = [
  { title: "Dashboard",           url: "/dashboard",         icon: LayoutDashboard },
  { title: "Clientes",            url: "/clients",           icon: Users },
  { title: "Vendas",              url: "/sales",             icon: Receipt },
  { title: "Previsão",            url: "/future-sales",      icon: TrendingUp },
  { title: "Agenda",              url: "/agenda",            icon: CalendarDays },
  { title: "Calculadora de Gesso",url: "/gypsum-calculator", icon: Calculator },
  { title: "Ranking",             url: "/ranking",           icon: Trophy },
  { title: "Relatórios",          url: "/reports",           icon: LineChart },
] as const;

// ─── Componente ───────────────────────────────────────────────────────────────

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useProfile();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Você saiu da sua conta.");
    navigate({ to: "/auth", replace: true });
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <Sidebar collapsible="icon">
      {/* Logo */}
      <SidebarHeader style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
  <div className="flex items-center justify-center px-3 py-5">
    {collapsed ? (
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
        <Sprout className="h-5 w-5 text-white" strokeWidth={2.5} />
      </div>
    ) : (
      <div className="flex flex-col items-center gap-2 w-full">
        <img
          src={logo}
          alt="AgroTrial"
          className="w-full max-w-[170px] h-auto object-contain"
        />
      </div>
    )}
      </SidebarHeader>

      <SidebarContent>
        {/* Menu de operação — apenas rotas do vendedor */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
            Operação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {VENDOR_ITEMS.map((item) => {
                const active =
                  pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && (
                          <span className="text-sm font-medium">{item.title}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Configurações */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
            Conta
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/settings"}
                >
                  <Link to="/settings" className="flex items-center gap-3">
                    <Settings className="h-4 w-4" />
                    {!collapsed && (
                      <span className="text-sm font-medium">Configurações</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Rodapé com nome do vendedor + logout */}
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && profile && (
          <div className="px-3 py-2">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">
              {firstName || profile.full_name || "Vendedor"}
            </p>
            <p className="truncate text-[10px] text-sidebar-foreground/50">
              {profile.email ?? ""}
            </p>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="text-sm font-medium">Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
