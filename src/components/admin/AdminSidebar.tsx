/**
 * AdminSidebar.tsx — versão corrigida
 * Fundo azul escuro #0D1B2A, logo sem filtro e maior, menu branco.
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
    <Sidebar
      collapsible="icon"
      style={{ backgroundColor: "#0D1B2A", borderRight: "none" }}
    >
      {/* ── Header / Logo ─────────────────────────────────────────── */}
      <SidebarHeader style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-center px-3 py-5">
          {collapsed ? (
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
              <Sprout className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full">
              {/* Logo original sem filtro, sem fundo branco, maior */}
              <img
                src={logo}
                alt="AgroTrial"
                className="w-full max-w-[160px] h-auto object-contain"
              />
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-white/50" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                  Administrador
                </span>
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* ── Menu ──────────────────────────────────────────────────── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel
            style={{ color: "rgba(255,255,255,0.35)" }}
            className="text-[10px] font-bold uppercase tracking-widest"
          >
            Gestão
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ADMIN_ITEMS.map((item) => {
                const active =
                  pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      style={
                        active
                          ? {
                              backgroundColor: "rgba(255,255,255,0.12)",
                              color: "#ffffff",
                              fontWeight: 600,
                              borderRadius: "8px",
                            }
                          : {
                              color: "rgba(255,255,255,0.65)",
                              borderRadius: "8px",
                            }
                      }
                      className="transition-colors hover:!bg-white/10 hover:!text-white"
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
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

      {/* ── Rodapé ────────────────────────────────────────────────── */}
      <SidebarFooter style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {!collapsed && profile && (
          <div className="px-3 py-2">
            <p className="truncate text-xs font-semibold text-white">
              {profile.full_name ?? "Administrador"}
            </p>
            <p className="truncate text-[10px] text-white/40">
              {profile.email ?? ""}
            </p>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              style={{ color: "rgba(255,255,255,0.5)", borderRadius: "8px" }}
              className="hover:!bg-red-500/20 hover:!text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && (
                <span className="text-sm font-medium">Sair</span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
