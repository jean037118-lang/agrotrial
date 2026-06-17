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
  tons: number;       // mantido para compatibilidade (quantidade principal)
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
  const { data } = await supabase.from("profiles").select("*").maybeSingle();
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
