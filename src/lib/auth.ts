/**
 * auth.ts
 * Funções centrais de autenticação do AgroTrial com suporte a RBAC.
 * Usado pelo hook useProfile e pelo redirecionamento pós-login.
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "vendedor";

export interface AuthProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
  commission_per_ton: number;
  monthly_goal_tons: number;
  recall_days: number;
}

// ─── Funções ──────────────────────────────────────────────────────────────────

/**
 * Busca o perfil completo do usuário logado, incluindo role.
 * Retorna null se não houver sessão ativa.
 */
export async function fetchAuthProfile(): Promise<AuthProfile | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, active, commission_per_ton, monthly_goal_tons, recall_days"
    )
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return data as AuthProfile;
}

/**
 * Retorna apenas o role do usuário logado.
 * Versão leve para checks rápidos de autorização.
 */
export async function fetchUserRole(): Promise<UserRole | null> {
  const profile = await fetchAuthProfile();
  return profile?.role ?? null;
}

/**
 * Retorna a rota de destino após login com base no role.
 *   admin    → /admin/dashboard
 *   vendedor → /dashboard
 */
export function getHomeRouteForRole(role: UserRole): "/admin/dashboard" | "/dashboard" {
  return role === "admin" ? "/admin/dashboard" : "/dashboard";
}

/**
 * Verifica se o usuário logado está ativo.
 * Vendedores inativos são bloqueados mesmo com sessão válida.
 */
export async function checkUserIsActive(): Promise<boolean> {
  const profile = await fetchAuthProfile();
  return profile?.active ?? false;
}
