/**
 * admin.ts
 * Funções de fetch para o painel administrativo do AgroTrial.
 *
 * IMPORTANTE: Estas funções buscam dados de TODOS os vendedores.
 * O acesso é controlado pelo RLS do Supabase (política admin_select).
 * Se chamadas por um vendedor, o Supabase retornará array vazio por RLS.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Client, Sale } from "@/lib/agro";

// ─── Tipos exclusivos do admin ────────────────────────────────────────────────

export interface VendorSummary {
  vendor_id: string;
  vendor_name: string | null;
  vendor_email: string | null;
  commission_per_ton: number;
  monthly_goal_tons: number;
  active: boolean;
  total_sales: number;
  total_tons: number;
  total_commission: number;
  month_tons: number;
  month_commission: number;
  year_tons: number;
  total_clients: number;
}

export interface AdminProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "admin" | "vendedor";
  active: boolean;
  commission_per_ton: number;
  monthly_goal_tons: number;
  recall_days: number;
  created_at: string;
}

// ─── Fetch de resumo por vendedor (usa a view admin_sales_summary) ────────────

/**
 * Retorna o resumo de vendas de cada vendedor para o dashboard admin.
 * Ordenado por toneladas no mês (ranking).
 */
export async function fetchVendorSummaries(): Promise<VendorSummary[]> {
  const { data, error } = await supabase
    .from("admin_sales_summary")
    .select("*")
    .order("month_tons", { ascending: false });

  if (error) throw error;
  return (data ?? []) as VendorSummary[];
}

// ─── Fetch de todos os vendedores (gestão de usuários) ───────────────────────

/**
 * Lista todos os perfis com role = 'vendedor' para o painel de gestão.
 * Inclui admins também para permitir gerenciamento completo.
 */
export async function fetchAllProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, active, commission_per_ton, monthly_goal_tons, recall_days, created_at"
    )
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AdminProfile[];
}

/**
 * Busca um perfil específico pelo ID (para a tela de edição).
 */
export async function fetchProfileById(id: string): Promise<AdminProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, active, commission_per_ton, monthly_goal_tons, recall_days, created_at"
    )
    .eq("id", id)
    .single();

  if (error) return null;
  return data as AdminProfile;
}

// ─── Fetch de todas as vendas (visão geral admin) ─────────────────────────────

/**
 * Busca todas as vendas de todos os vendedores.
 * Inclui dados do cliente via join para exibição na tabela.
 */
export async function fetchAllSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .order("sale_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Sale[];
}

/**
 * Busca vendas filtradas por vendedor específico.
 */
export async function fetchSalesByVendor(vendorId: string): Promise<Sale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("sale_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Sale[];
}

// ─── Fetch de todos os clientes ───────────────────────────────────────────────

/**
 * Busca todos os clientes de todos os vendedores.
 */
export async function fetchAllClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Client[];
}

// ─── Ações administrativas via RPC ───────────────────────────────────────────

/**
 * Cria um novo vendedor via RPC segura (admin_create_user no Supabase).
 */
export async function adminCreateUser(params: {
  email: string;
  password: string;
  full_name: string;
  role?: "admin" | "vendedor";
  commission?: number;
  monthly_goal?: number;
  recall_days?: number;
}): Promise<{ id: string; email: string; role: string }> {
  const { data, error } = await supabase.rpc("admin_create_user", {
    p_email:        params.email,
    p_password:     params.password,
    p_full_name:    params.full_name,
    p_role:         params.role ?? "vendedor",
    p_commission:   params.commission ?? 8,
    p_monthly_goal: params.monthly_goal ?? 1000,
    p_recall_days:  params.recall_days ?? 60,
  });

  if (error) throw error;
  return data as { id: string; email: string; role: string };
}

/**
 * Atualiza dados de qualquer usuário via RPC segura (admin_update_user no Supabase).
 */
export async function adminUpdateUser(params: {
  user_id: string;
  full_name?: string;
  role?: "admin" | "vendedor";
  commission?: number;
  monthly_goal?: number;
  recall_days?: number;
  active?: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc("admin_update_user", {
    p_user_id:      params.user_id,
    p_full_name:    params.full_name,
    p_role:         params.role,
    p_commission:   params.commission,
    p_monthly_goal: params.monthly_goal,
    p_recall_days:  params.recall_days,
    p_active:       params.active,
  });

  if (error) throw error;
}

// ─── Helpers de cálculo para o dashboard ──────────────────────────────────────

/**
 * Agrega totais globais a partir dos resumos por vendedor.
 */
export function calcGlobalTotals(summaries: VendorSummary[]) {
  return {
    monthTons:       summaries.reduce((a, s) => a + Number(s.month_tons), 0),
    monthCommission: summaries.reduce((a, s) => a + Number(s.month_commission), 0),
    yearTons:        summaries.reduce((a, s) => a + Number(s.year_tons), 0),
    totalSales:      summaries.reduce((a, s) => a + Number(s.total_sales), 0),
    totalClients:    summaries.reduce((a, s) => a + Number(s.total_clients), 0),
    activeVendors:   summaries.filter((s) => s.active).length,
  };
}

/**
 * Agrega vendas por mês para o gráfico de barras (últimos 12 meses).
 */
export function calcMonthlySales(sales: Sale[]): { month: string; tons: number; commission: number }[] {
  const map = new Map<string, { tons: number; commission: number }>();

  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, { tons: 0, commission: 0 });
  }

  for (const s of sales) {
    const key = s.sale_date.slice(0, 7);
    if (!map.has(key)) continue;
    const cur = map.get(key)!;
    cur.tons       += Number(s.tons);
    cur.commission += Number(s.total_commission);
  }

  return Array.from(map.entries()).map(([month, v]) => ({
    month,
    tons:       Math.round(v.tons * 10) / 10,
    commission: Math.round(v.commission * 100) / 100,
  }));
}
