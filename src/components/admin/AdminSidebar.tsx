/**
 * AdminSidebar.tsx
 * Sidebar exclusiva do painel administrativo do AgroTrial.
 *
 * Alterações visuais:
 *   - Logo com fundo branco (bg-white) ✓
 *   - Itens de menu ativos/hover em azul escuro #0D1B2A (cor da logo)
 *   - Badge "Administrador" e ícone ShieldCheck em azul escuro
 *   - Ícone colapsado em azul escuro em vez do verde padrão
 */

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Trophy, Users, LogOut,
  Sprout, ShieldCheck, BarChart3,
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

// Azul escuro da logo AgroTrial
const BRAND = "#0D1B2A";

const ADMIN_ITEMS = [
  { title: "Dashboard",  url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Ranking",    url: "/admin/ranking",   icon: Trophy },
  { title: "Relatórios", url: "/admin/reports",   icon: BarChart3 },
  { title: "Usuários",   url: "/admin/users",     icon: Users },
] as const;

export function AdminSidebar() {
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center px-2 py-3">
          {collapsed ? (
            /* Ícone colapsado — azul escuro da logo */
            <div
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
              style={{ backgroundColor: BRAND }}
            >
              <Sprout className="h-4 w-4" strokeWidth={2.5} />
            </div>
          ) : (
            <div className="space-y-1 px-1">
              {/* Logo com fundo branco */}
              <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                <img src={logo} alt="AgroTrial" className="h-6 w-auto" />
              </div>
              {/* Badge Administrador — azul escuro */}
              <div className="flex items-center gap-1.5 px-1">
                <ShieldCheck
                  className="h-3 w-3"
                  style={{ color: BRAND }}
                />
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: BRAND }}
                >
                  Administrador
                </span>
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
            Gestão
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ADMIN_ITEMS.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      /* Item ativo: fundo azul escuro suave + texto/ícone azul escuro */
                      style={active ? {
                        backgroundColor: `${BRAND}15`,
                        color: BRAND,
                        fontWeight: 600,
                      } : undefined}
                      className={!active
                        ? "hover:bg-[#0D1B2A]/10 hover:text-[#0D1B2A]"
                        : ""
                      }
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && (
                          <span className="text-sm">{item.title}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && profile && (
          <div className="px-3 py-2">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">
              {profile.full_name ?? "Administrador"}
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
