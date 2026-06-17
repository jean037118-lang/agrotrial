import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAgenda, fetchClients, fetchSales,
  TASK_LABEL, STATUS_LABEL, STATUS_EMOJI, STATUS_DOT,
  getTaskStatus, getDeliveryStatus, isNucleosProduct, toISODate, todayStr,
  type AgendaTask, type Sale, type TaskStatus,
} from "@/lib/agro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Phone, Briefcase, Users, RotateCw, Trash2, Plane,
  ChevronLeft, ChevronRight, Bell, Truck,
} from "lucide-react";
import { toast } from "sonner";

const agendaOpts = queryOptions({ queryKey: ["agenda"], queryFn: fetchAgenda });
const clientsOpts = queryOptions({ queryKey: ["clients"], queryFn: fetchClients });
const salesOpts = queryOptions({ queryKey: ["sales"], queryFn: fetchSales });

export const Route = createFileRoute("/_authenticated/agenda")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return Promise.all([
      qc.ensureQueryData(agendaOpts),
      qc.ensureQueryData(clientsOpts),
      qc.ensureQueryData(salesOpts),
    ]);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <AgendaPage />
    </Suspense>
  ),
});

const ICON: Record<AgendaTask["type"], React.ComponentType<{ className?: string }>> = {
  ligacao: Phone, visita: Briefcase, reuniao: Users, pos_venda: RotateCw, viagem: Plane,
};

const TASK_TYPES: AgendaTask["type"][] = ["ligacao", "visita", "reuniao", "pos_venda", "viagem"];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function AgendaPage() {
  const qc = useQueryClient();
  const { data: tasks } = useSuspenseQuery(agendaOpts);
  const { data: clients } = useSuspenseQuery(clientsOpts);
  const { data: sales } = useSuspenseQuery(salesOpts);
  const [open, setOpen] = useState(false);
  const [calMode, setCalMode] = useState<"mes" | "semana">("mes");
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const today = todayStr();
  const overdue = tasks.filter((t) => !t.done && t.due_date < today);
  const todays = tasks.filter((t) => !t.done && t.due_date === today);
  const upcoming = tasks.filter((t) => !t.done && t.due_date > today);
  const done = tasks.filter((t) => t.done);

  async function toggle(t: AgendaTask) {
    const { error } = await supabase.from("agenda_tasks").update({ done: !t.done }).eq("id", t.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["agenda"] });
  }
  async function remove(id: string) {
    const { error } = await supabase.from("agenda_tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["agenda"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Agenda comercial</h1>
          <p className="text-muted-foreground">Ligações, visitas, reuniões, viagens e pós-venda.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> Nova tarefa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
            <TaskForm clients={clients} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["agenda"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      <NotificationsPanel tasks={tasks} sales={sales} />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Calendário
            </h3>
            <Tabs value={calMode} onValueChange={(v) => setCalMode(v as "mes" | "semana")}>
              <TabsList>
                <TabsTrigger value="mes">Mês</TabsTrigger>
                <TabsTrigger value="semana">Semana</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {calMode === "mes" ? (
            <MonthCalendar tasks={tasks} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          ) : (
            <WeekStrip tasks={tasks} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          )}

          <Legend />

          <DayAgenda date={selectedDate} tasks={tasks} clients={clients} onToggle={toggle} onRemove={remove} />
        </CardContent>
      </Card>

      <Section title="Atrasadas" items={overdue} clients={clients} onToggle={toggle} onRemove={remove} tone="destructive" />
      <Section title="Hoje" items={todays} clients={clients} onToggle={toggle} onRemove={remove} tone="earth" />
      <Section title="Próximas" items={upcoming} clients={clients} onToggle={toggle} onRemove={remove} />
      <Section title="Concluídas" items={done} clients={clients} onToggle={toggle} onRemove={remove} muted />
    </div>
  );
}

/* ----------------------------- Notificações ----------------------------- */

type Summary = { atrasado: number; hoje: number; agendado: number; total: number };

function summarizeTasks(items: AgendaTask[]): Summary {
  let atrasado = 0, hoje = 0, agendado = 0;
  for (const t of items) {
    if (t.done) continue;
    const status = getTaskStatus(t);
    if (status === "atrasado") atrasado++;
    else if (status === "hoje") hoje++;
    else agendado++;
  }
  return { atrasado, hoje, agendado, total: atrasado + hoje + agendado };
}

function summarizeDeliveries(sales: Sale[]): Summary {
  let atrasado = 0, hoje = 0, agendado = 0;
  for (const s of sales) {
    if (!isNucleosProduct(s.product)) continue;
    const status = getDeliveryStatus(s);
    if (status === "atrasado") atrasado++;
    else if (status === "hoje") hoje++;
    else if (status === "agendado") agendado++;
  }
  return { atrasado, hoje, agendado, total: atrasado + hoje + agendado };
}

function NotificationsPanel({ tasks, sales }: { tasks: AgendaTask[]; sales: Sale[] }) {
  const visitas = summarizeTasks(tasks.filter((t) => t.type === "visita"));
  const posVenda = summarizeTasks(tasks.filter((t) => t.type === "pos_venda"));
  const nucleos = summarizeDeliveries(sales);

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Bell className="h-4 w-4" /> Notificações
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <NotificationCard icon={Briefcase} title="Vencimento de visita" summary={visitas} />
        <NotificationCard icon={RotateCw} title="Pós-venda" summary={posVenda} />
        <NotificationCard icon={Truck} title="Entrega Núcleos" summary={nucleos} />
      </div>
    </div>
  );
}

function NotificationCard({
  icon: Icon, title, summary,
}: { icon: React.ComponentType<{ className?: string }>; title: string; summary: Summary }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-earth">
            <Icon className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-bold text-foreground">{title}</h4>
        </div>
        <span className="font-display text-xl font-bold tabular-nums text-foreground">{summary.total}</span>
      </div>
      {summary.total === 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
          🟢 Tudo em dia
        </span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {summary.atrasado > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
              🔴 {summary.atrasado} atrasado{summary.atrasado > 1 ? "s" : ""}
            </span>
          )}
          {summary.hoje > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-earth">
              🟡 {summary.hoje} hoje
            </span>
          )}
          {summary.agendado > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              {summary.agendado} agendado{summary.agendado > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Calendário ------------------------------ */

function useTasksByDate(tasks: AgendaTask[]) {
  return useMemo(() => {
    const map = new Map<string, AgendaTask[]>();
    for (const t of tasks) {
      const arr = map.get(t.due_date) ?? [];
      arr.push(t);
      map.set(t.due_date, arr);
    }
    return map;
  }, [tasks]);
}

function DayCell({
  label, dayNumber, dateStr, dayTasks, isToday, isSelected, onSelect,
}: {
  label?: string; dayNumber: number; dateStr: string; dayTasks: AgendaTask[];
  isToday: boolean; isSelected: boolean; onSelect: (date: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(dateStr)}
      className={`flex flex-col items-center gap-1 rounded-lg py-1.5 text-sm transition-colors ${
        isSelected
          ? "bg-primary text-primary-foreground"
          : isToday
          ? "bg-accent text-foreground"
          : "text-foreground hover:bg-muted"
      }`}
    >
      {label && (
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
      )}
      <span className={isToday && !isSelected ? "font-bold text-primary" : "font-medium"}>{dayNumber}</span>
      <span className="flex h-1.5 items-center gap-0.5">
        {dayTasks.slice(0, 3).map((t) => (
          <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[getTaskStatus(t)]}`} />
        ))}
        {dayTasks.length > 3 && <span className="text-[8px] leading-none">+{dayTasks.length - 3}</span>}
      </span>
    </button>
  );
}

function MonthCalendar({
  tasks, selectedDate, onSelectDate,
}: { tasks: AgendaTask[]; selectedDate: string; onSelectDate: (date: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const [y, m] = selectedDate.split("-").map(Number);
    return new Date(y, m - 1, 1);
  });

  const today = todayStr();
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDate = useTasksByDate(tasks);

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-display text-sm font-semibold capitalize text-foreground">{monthLabel}</span>
        <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {WEEKDAY_LABELS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return (
            <DayCell
              key={dateStr}
              dayNumber={day}
              dateStr={dateStr}
              dayTasks={byDate.get(dateStr) ?? []}
              isToday={dateStr === today}
              isSelected={dateStr === selectedDate}
              onSelect={onSelectDate}
            />
          );
        })}
      </div>
    </div>
  );
}

function WeekStrip({
  tasks, selectedDate, onSelectDate,
}: { tasks: AgendaTask[]; selectedDate: string; onSelectDate: (date: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - date.getDay());
    return date;
  });

  const today = todayStr();
  const byDate = useTasksByDate(tasks);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() + i);
    return d;
  });

  const rangeLabel = `${days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCursor((c) => { const n = new Date(c); n.setDate(c.getDate() - 7); return n; })}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-display text-sm font-semibold capitalize text-foreground">{rangeLabel}</span>
        <Button variant="ghost" size="icon" onClick={() => setCursor((c) => { const n = new Date(c); n.setDate(c.getDate() + 7); return n; })}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const dateStr = toISODate(d);
          return (
            <DayCell
              key={dateStr}
              label={WEEKDAY_LABELS[d.getDay()]}
              dayNumber={d.getDate()}
              dateStr={dateStr}
              dayTasks={byDate.get(dateStr) ?? []}
              isToday={dateStr === today}
              isSelected={dateStr === selectedDate}
              onSelect={onSelectDate}
            />
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /> Atrasado</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold" /> Hoje</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Concluído</span>
    </div>
  );
}

function DayAgenda({
  date, tasks, clients, onToggle, onRemove,
}: {
  date: string; tasks: AgendaTask[]; clients: { id: string; name: string }[];
  onToggle: (t: AgendaTask) => void; onRemove: (id: string) => void;
}) {
  const dayTasks = tasks.filter((t) => t.due_date === date);
  const [y, m, d] = date.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <h4 className="font-display text-sm font-semibold capitalize text-foreground">{label}</h4>
      {dayTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma tarefa nesta data.</p>
      ) : (
        <div className="space-y-2">
          {dayTasks.map((t) => {
            const Icon = ICON[t.type];
            const c = clients.find((x) => x.id === t.client_id);
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <Checkbox checked={t.done} onCheckedChange={() => onToggle(t)} />
                <div className="grid h-8 w-8 place-items-center rounded-md bg-accent text-earth"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm font-medium ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                  <div className="text-xs text-muted-foreground">{TASK_LABEL[t.type]}{c && ` • ${c.name}`}</div>
                </div>
                <StatusBadge status={getTaskStatus(t)} />
                <Button variant="ghost" size="icon" onClick={() => onRemove(t.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  atrasado: "bg-destructive/10 text-destructive",
  hoje: "bg-gold/15 text-earth",
  concluido: "bg-success/10 text-success",
  agendado: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE_CLASS[status]}`}>
      {STATUS_EMOJI[status]} {STATUS_LABEL[status]}
    </span>
  );
}

/* --------------------------------- Lista --------------------------------- */

function Section({
  title, items, clients, onToggle, onRemove, tone, muted,
}: {
  title: string; items: AgendaTask[]; clients: { id: string; name: string }[];
  onToggle: (t: AgendaTask) => void; onRemove: (id: string) => void;
  tone?: "earth" | "destructive"; muted?: boolean;
}) {
  if (items.length === 0) return null;
  const accent = tone === "destructive" ? "border-destructive/40" : tone === "earth" ? "border-earth/40" : "border-border";
  return (
    <Card className={accent}>
      <CardContent className="p-0">
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title} ({items.length})</h3>
        </div>
        <div className="divide-y divide-border">
          {items.map((t) => {
            const Icon = ICON[t.type];
            const c = clients.find((x) => x.id === t.client_id);
            return (
              <div key={t.id} className={`flex items-center gap-3 px-5 py-3 ${muted ? "opacity-60" : ""}`}>
                <Checkbox checked={t.done} onCheckedChange={() => onToggle(t)} />
                <div className="grid h-8 w-8 place-items-center rounded-md bg-accent text-earth"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm font-medium ${t.done ? "line-through" : ""}`}>{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {TASK_LABEL[t.type]} • {new Date(t.due_date).toLocaleDateString("pt-BR")} {c && `• ${c.name}`}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemove(t.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskForm({
  clients, onDone,
}: { clients: { id: string; name: string }[]; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", type: "ligacao" as AgendaTask["type"], client_id: "",
    due_date: new Date().toISOString().slice(0, 10), notes: "",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("Sessão expirou."); }
    const { error } = await supabase.from("agenda_tasks").insert({
      vendor_id: user.id,
      title: form.title,
      type: form.type,
      client_id: form.client_id || null,
      due_date: form.due_date,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Tarefa criada.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Título</Label>
        <Input required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ligar para Fazenda Santa Fé" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={(v) => set("type", v as AgendaTask["type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{TASK_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input type="date" required value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Cliente (opcional)</Label>
        <Select value={form.client_id} onValueChange={(v) => set("client_id", v)}>
          <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>Salvar</Button>
      </div>
    </form>
  );
}
