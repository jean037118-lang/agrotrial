/**
 * auth.ts — CORRIGIDO
 *
 * Problema original: getUser() faz chamada ao servidor e retorna 403 no browser.
 * Solução: usar getSession() que lê o token local (localStorage) sem chamada de rede.
 * Também trocado .single() por .maybeSingle() para evitar o erro 406 quando
 * o profile ainda não existe.
 */

import { supabase } from "@/integrations/supabase/client";

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

/**
 * Busca o perfil completo do usuário logado incluindo role.
 * Usa getSession() (local, sem rede) para obter o user_id,
 * depois faz uma única query na tabela profiles.
 */
export async function fetchAuthProfile(): Promise<AuthProfile | null> {
  // getSession() lê do localStorage — sem chamada de rede, sem 403
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return null;

  // maybeSingle() retorna null se não encontrar (evita o 406 do .single())
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, active, commission_per_ton, monthly_goal_tons, recall_days"
    )
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !data) return null;

  return data as AuthProfile;
}

/**
 * Retorna apenas o role do usuário logado.
 */
export async function fetchUserRole(): Promise<UserRole | null> {
  const profile = await fetchAuthProfile();
  return profile?.role ?? null;
}

/**
 * Retorna a rota de destino pós-login com base no role.
 */
export function getHomeRouteForRole(role: UserRole): "/admin/dashboard" | "/dashboard" {
  return role === "admin" ? "/admin/dashboard" : "/dashboard";
}

/**
 * Verifica se o usuário logado está ativo.
 */
export async function checkUserIsActive(): Promise<boolean> {
  const profile = await fetchAuthProfile();
  return profile?.active ?? false;
}
