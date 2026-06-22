import { supabase } from "@/integrations/supabase/client";

export type Client = {
  id: string;
  vendor_id: string;
  name: string;
  farm: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  culture: string | null;
  potential: "pequeno" | "medio" | "grande";
  notes: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  vendor_id: string;
  name: string;
  unit: "ton" | "kg" | "L" | "saco" | "cx" | "un";
  commission_value: number;
  commission_type: "per_unit" | "percent";
  active: boolean;
  created_at: string;
};

export type Sale = {
  id: string;
  vendor_id: string;
  client_id: string;
  product: string;
  product_id: string | null;
  unit: string;
  tons: number;
  quantity: number | null;
  price_per_ton: number | null;
  commission_per_ton: number;
  total_commission: number;
  stage: "lead" | "contato" | "proposta" | "negociacao" | "venda" | "pos_venda";
  sale_date: string;
  delivery_date: string | null;
  notes: string | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  commission_per_ton: number;
  monthly_goal_tons: number;
  recall_days: number;
  // ── Campos RBAC ──────────────────────────────────────────────────────────
  /** Papel do usuário: 'admin' | 'vendedor' */
  role: "admin" | "vendedor";
  /** Indica se o usuário está ativo no sistema */
  active: boolean;
  /** E-mail do usuário (espelhado de auth.users) */
  email: string | null;
};

export type FutureSale = {
  id: string;
  vendor_id: string;
  client_id: string;
  expected_tons: number;
  expected_month: string;
  notes: string | null;
};

export type AgendaTask = {
  id: string;
  vendor_id: string;
  client_id: string | null;
  type: "ligacao" | "visita" | "reuniao" | "pos_venda" | "viagem";
  title: string;
  due_date: string;
  done: boolean;
  notes: string | null;
};

/** Interação registrada no histórico do cliente (timeline do CRM). */
export type Interaction = {
  id: string;
  vendor_id: string;
  client_id: string;
  type: InteractionType;
  notes: string | null;
  occurred_at: string;
  created_at: string;
};

export type InteractionType =
  | "ligacao" | "whatsapp" | "visita" | "reuniao"
  | "proposta" | "venda" | "pos_venda" | "email" | "outro";

export const INTERACTION_LABEL: Record<InteractionType, string> = {
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  visita: "Visita",
  reuniao: "Reunião",
  proposta: "Proposta",
  venda: "Venda",
  pos_venda: "Pós-venda",
  email: "E-mail",
  outro: "Outro",
};

export const INTERACTION_COLOR: Record<InteractionType, string> = {
  ligacao: "bg-blue-100 text-blue-700",
  whatsapp: "bg-emerald-100 text-emerald-700",
  visita: "bg-purple-100 text-purple-700",
  reuniao: "bg-indigo-100 text-indigo-700",
  proposta: "bg-amber-100 text-amber-700",
  venda: "bg-primary/15 text-primary",
  pos_venda: "bg-teal-100 text-teal-700",
  email: "bg-slate-100 text-slate-700",
  outro: "bg-muted text-muted-foreground",
};

export const UNIT_LABEL: Record<string, string> = {
  ton: "Tonelada (t)",
  kg: "Quilograma (kg)",
  L: "Litro (L)",
  saco: "Saco",
  cx: "Caixa",
  un: "Unidade",
};

export const STAGES: Sale["stage"][] = ["lead", "contato", "proposta", "negociacao", "venda", "pos_venda"];
export const STAGE_LABEL: Record<Sale["stage"], string> = {
  lead: "Lead",
  contato: "Contato",
  proposta: "Proposta",
  negociacao: "Negociação",
  venda: "Venda",
  pos_venda: "Pós-venda",
};

export const TASK_LABEL: Record<AgendaTask["type"], string> = {
  ligacao: "Ligação",
  visita: "Visita",
  reuniao: "Reunião",
  pos_venda: "Pós-venda",
  viagem: "Viagem",
};

export const POTENTIAL_LABEL: Record<Client["potential"], string> = {
  pequeno: "Pequeno",
  medio: "Médio",
  grande: "Grande",
};

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export const tons = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " t";

export const qty = (v: number, unit: string) => {
  const n = v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return unit === "ton" ? `${n} t` : `${n} ${unit}`;
};

export async function fetchProfile(): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active, commission_per_ton, monthly_goal_tons, recall_days")
    .maybeSingle();
  return (data as Profile) ?? null;
}

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function fetchSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from("sales").select("*").order("sale_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Sale[];
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products").select("*").eq("active", true).order("name");
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function fetchFutureSales(): Promise<FutureSale[]> {
  const { data, error } = await supabase
    .from("future_sales").select("*").order("expected_month", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FutureSale[];
}

export async function fetchAgenda(): Promise<AgendaTask[]> {
  const { data, error } = await supabase
    .from("agenda_tasks").select("*").order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AgendaTask[];
}

/** Busca todas as interações (todos os clientes), mais recentes primeiro. */
export async function fetchInteractions(): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from("interactions").select("*").order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Interaction[];
}

/** Busca interações de um cliente específico, mais recentes primeiro. */
export async function fetchClientInteractions(clientId: string): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from("interactions").select("*")
    .eq("client_id", clientId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Interaction[];
}

/** Calcula comissão de um produto dado quantidade e preço */
export function calcCommission(product: Product, quantity: number, pricePerUnit: number): number {
  if (product.commission_type === "percent") {
    return (quantity * pricePerUnit * product.commission_value) / 100;
  }
  return quantity * product.commission_value;
}

export function daysSince(date: string | null): number | null {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function todayStr(): string {
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type TaskStatus = "atrasado" | "hoje" | "concluido" | "agendado";

export function getTaskStatus(t: { due_date: string; done: boolean }): TaskStatus {
  if (t.done) return "concluido";
  const today = todayStr();
  if (t.due_date < today) return "atrasado";
  if (t.due_date === today) return "hoje";
  return "agendado";
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  atrasado: "Atrasado",
  hoje: "Hoje",
  concluido: "Concluído",
  agendado: "Agendado",
};

export const STATUS_EMOJI: Record<TaskStatus, string> = {
  atrasado: "🔴",
  hoje: "🟡",
  concluido: "🟢",
  agendado: "⚪",
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  atrasado: "bg-destructive",
  hoje: "bg-gold",
  concluido: "bg-success",
  agendado: "bg-muted-foreground/30",
};

export function isNucleosProduct(product: string): boolean {
  return /n[uú]cleo/i.test(product);
}

export function getDeliveryStatus(s: { delivery_date: string | null; stage: Sale["stage"] }): TaskStatus | null {
  if (s.stage === "pos_venda") return "concluido";
  if (!s.delivery_date) return null;
  const today = todayStr();
  if (s.delivery_date < today) return "atrasado";
  if (s.delivery_date === today) return "hoje";
  return "agendado";
}

export async function saveClientCoordinates(clientId: string, lat: number, lng: number): Promise<void> {
  await supabase.from("clients").update({ lat, lng }).eq("id", clientId);
}
