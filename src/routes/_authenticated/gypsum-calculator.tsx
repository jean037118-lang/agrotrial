import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calculator, Sprout, Info, TrendingUp } from "lucide-react";
import { tons, fetchClients } from "@/lib/agro";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const clientsOpts = queryOptions({ queryKey: ["clients"], queryFn: fetchClients });

export const Route = createFileRoute("/_authenticated/gypsum-calculator")({
  loader: ({ context }) => {
    const qc = (context as { queryClient: import("@tanstack/react-query").QueryClient }).queryClient;
    return qc.ensureQueryData(clientsOpts);
  },
  component: () => (
    <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
      <GypsumCalculatorPage />
    </Suspense>
  ),
});

// Densidade aparente do solo padrão (t/m³) por classe textural — usada para
// converter a dose de referência (calculada para densidade 1,3) para a
// densidade real da camada.
const DENSITY_BY_TEXTURE: Record<string, number> = {
  arenoso: 1.5,
  medio: 1.3,
  argiloso: 1.1,
  muito_argiloso: 1.0,
};

const TEXTURE_LABEL: Record<string, string> = {
  arenoso: "Arenoso",
  medio: "Médio",
  argiloso: "Argiloso",
  muito_argiloso: "Muito argiloso",
};

// Densidade de referência sobre a qual a regra prática de 50 kg/% de argila
// foi calibrada (solo de textura média).
const REFERENCE_DENSITY = 1.3;

const BAG_KG = 50; // saco padrão de gesso agrícola

type CalcResult = { totalTons: number } | null;
type ResultSetter = (r: CalcResult) => void;

function GypsumCalculatorPage() {
  const { data: clients } = useSuspenseQuery(clientsOpts);
  const [result, setResult] = useState<CalcResult>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">Calculadora de Gesso</h1>
        <p className="text-muted-foreground">
          Estime a necessidade de gesso agrícola para correção de subsuperfície.
        </p>
      </div>

      <Tabs defaultValue="argila" onValueChange={() => setResult(null)}>
        <TabsList>
          <TabsTrigger value="argila">Pelo teor de argila</TabsTrigger>
          <TabsTrigger value="calcio">Pela análise de solo (Ca²⁺/CTC)</TabsTrigger>
        </TabsList>
        <TabsContent value="argila" className="mt-4">
          <ClayMethod onResult={setResult} />
        </TabsContent>
        <TabsContent value="calcio" className="mt-4">
          <CalciumMethod onResult={setResult} />
        </TabsContent>
      </Tabs>

      {result && <ForecastCard totalTons={result.totalTons} clients={clients} />}

      <Card className="border-dashed">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Os resultados são estimativas para apoiar a conversa comercial. A recomendação
            agronômica final deve sempre considerar a análise de solo completa e o
            acompanhamento de um agrônomo responsável pela propriedade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Método 1 — Estimativa pelo teor de argila (Embrapa, simplificado)        */
/* NG (kg/ha) = 50 × teor de argila (%), referência para solo médio (1,3)   */
/* e camada de 0-20 cm; ajustada por profundidade e densidade real do solo  */
/* ----------------------------------------------------------------------- */

function ClayMethod({ onResult }: { onResult: ResultSetter }) {
  const [clay, setClay] = useState("35");
  const [depth, setDepth] = useState("0.4"); // m
  const [texture, setTexture] = useState("medio");
  const [area, setArea] = useState("10"); // ha

  const clayPct = Number(clay) || 0;
  const depthM = Number(depth) || 0;
  const areaHa = Number(area) || 0;
  const density = DENSITY_BY_TEXTURE[texture] ?? REFERENCE_DENSITY;

  // Fórmula base para camada de 0-20 cm (kg/ha), calibrada para solo médio
  const baseNgPerHa = 50 * clayPct;
  // Ajuste por profundidade (referência 0,20 m) e por densidade real do solo
  // em relação à densidade de referência da fórmula (1,3 — solo médio)
  const ngPerHa = baseNgPerHa * (depthM / 0.2) * (density / REFERENCE_DENSITY);
  const totalKg = ngPerHa * areaHa;
  const totalTons = totalKg / 1000;
  const bags = Math.ceil(totalKg / BAG_KG);

  const valid = clayPct > 0 && depthM > 0 && areaHa > 0;

  useEffect(() => {
    onResult(valid ? { totalTons } : null);
  }, [valid, totalTons, onResult]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Teor de argila (%)">
            <Input type="number" min="0" max="100" step="1" value={clay} onChange={(e) => setClay(e.target.value)} />
          </Field>
          <Field label="Classe textural (densidade do solo)">
            <Select value={texture} onValueChange={setTexture}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TEXTURE_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Profundidade de correção (m)">
            <Input type="number" min="0.1" max="1" step="0.1" value={depth} onChange={(e) => setDepth(e.target.value)} />
          </Field>
          <Field label="Área (hectares)">
            <Input type="number" min="0" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <ResultCard
        visible={valid}
        ngPerHa={ngPerHa}
        totalTons={totalTons}
        bags={bags}
        areaHa={areaHa}
        note={`Estimativa pela regra prática: 50 kg de gesso por hectare para cada 1% de argila,
calibrada para solo de textura média (densidade ${REFERENCE_DENSITY.toLocaleString("pt-BR")} t/m³) e camada de 20 cm.
Ajustada para ${depthM.toLocaleString("pt-BR")} m de profundidade e densidade ${density.toLocaleString("pt-BR")} t/m³ (${TEXTURE_LABEL[texture]}).`}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Método 2 — Estimativa pela saturação de Ca²⁺ na CTC (mais técnico)       */
/* NG (t/ha) = 5 × CTC × (Y - Ca/CTC atual) × profundidade(m) / 0,2 × dens. */
/* onde Y = saturação por Ca desejada (fração), comumente 0,5 (~50%)       */
/* ----------------------------------------------------------------------- */

function CalciumMethod({ onResult }: { onResult: ResultSetter }) {
  const [ctc, setCtc] = useState("8");        // cmolc/dm³
  const [ca, setCa] = useState("1.5");        // cmolc/dm³ — Ca²⁺ atual na camada
  const [target, setTarget] = useState("50"); // % saturação de Ca desejada
  const [depth, setDepth] = useState("0.4");  // m
  const [texture, setTexture] = useState("medio");
  const [area, setArea] = useState("10");     // ha

  const ctcVal = Number(ctc) || 0;
  const caVal = Number(ca) || 0;
  const targetFrac = (Number(target) || 0) / 100;
  const depthM = Number(depth) || 0;
  const areaHa = Number(area) || 0;
  const density = DENSITY_BY_TEXTURE[texture] ?? REFERENCE_DENSITY;

  const currentSat = ctcVal > 0 ? caVal / ctcVal : 0;
  const satGap = Math.max(0, targetFrac - currentSat);

  // Necessidade de Ca (cmolc/dm³) × fator de conversão para CaSO4·2H2O (gesso)
  // 1 cmolc/dm³ de Ca equivale a ~860 kg/ha de gesso por 20 cm de profundidade
  // (considerando densidade 1,0; ajustamos pela densidade real e profundidade)
  const CA_TO_GYPSUM_FACTOR = 860; // kg de gesso por cmolc/dm³ de Ca, camada 20cm, densidade 1,0
  const ngPerHa = satGap * CA_TO_GYPSUM_FACTOR * (depthM / 0.2) * density;
  const totalKg = ngPerHa * areaHa;
  const totalTons = totalKg / 1000;
  const bags = Math.ceil(totalKg / BAG_KG);

  const valid = ctcVal > 0 && depthM > 0 && areaHa > 0;

  useEffect(() => {
    onResult(valid ? { totalTons } : null);
  }, [valid, totalTons, onResult]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="CTC efetiva (cmolc/dm³)">
            <Input type="number" min="0" step="0.1" value={ctc} onChange={(e) => setCtc(e.target.value)} />
          </Field>
          <Field label="Ca²⁺ atual na camada (cmolc/dm³)">
            <Input type="number" min="0" step="0.1" value={ca} onChange={(e) => setCa(e.target.value)} />
          </Field>
          <Field label="Saturação de Ca²⁺ desejada (%)">
            <Input type="number" min="0" max="100" step="1" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
          <Field label="Classe textural (densidade)">
            <Select value={texture} onValueChange={setTexture}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TEXTURE_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Profundidade de correção (m)">
            <Input type="number" min="0.1" max="1" step="0.1" value={depth} onChange={(e) => setDepth(e.target.value)} />
          </Field>
          <Field label="Área (hectares)">
            <Input type="number" min="0" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {ctcVal > 0 && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Saturação atual</div>
            <div className="font-display text-lg font-semibold">{(currentSat * 100).toFixed(1)}%</div>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Déficit a corrigir</div>
            <div className="font-display text-lg font-semibold">{(satGap * 100).toFixed(1)} p.p.</div>
          </div>
        </div>
      )}

      <ResultCard
        visible={valid}
        ngPerHa={ngPerHa}
        totalTons={totalTons}
        bags={bags}
        areaHa={areaHa}
        note="Estimativa baseada no déficit de saturação por cálcio na CTC efetiva, convertido para gesso agrícola (CaSO₄·2H₂O) e ajustado por profundidade e densidade do solo."
      />
    </div>
  );
}

function ResultCard({
  visible, ngPerHa, totalTons, bags, areaHa, note,
}: {
  visible: boolean;
  ngPerHa: number;
  totalTons: number;
  bags: number;
  areaHa: number;
  note: string;
}) {
  if (!visible) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Preencha os campos acima para calcular a necessidade de gesso.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="gradient-earth p-6 text-primary-foreground">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
          <Calculator className="h-3.5 w-3.5" /> Resultado estimado
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs opacity-80">Dose por hectare</div>
            <div className="font-display text-2xl font-semibold">
              {(ngPerHa / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} t/ha
            </div>
            <div className="text-xs opacity-70">{ngPerHa.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg/ha</div>
          </div>
          <div>
            <div className="text-xs opacity-80">Total para {areaHa.toLocaleString("pt-BR")} ha</div>
            <div className="font-display text-2xl font-semibold">{tons(totalTons)}</div>
          </div>
          <div>
            <div className="text-xs opacity-80">Em sacos de {BAG_KG} kg</div>
            <div className="font-display text-2xl font-semibold">{bags.toLocaleString("pt-BR")}</div>
          </div>
        </div>
      </CardContent>
      <CardContent className="flex gap-2 border-t border-border p-4 text-xs text-muted-foreground">
        <Sprout className="mt-0.5 h-3.5 w-3.5 shrink-0 text-earth" />
        <p>{note}</p>
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------------- */
/* Integração com o funil — transformar o resultado em previsão de venda    */
/* ----------------------------------------------------------------------- */

function ForecastCard({
  totalTons, clients,
}: { totalTons: number; clients: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [saving, setSaving] = useState(false);

  if (clients.length === 0 || totalTons <= 0) return null;

  async function submit() {
    if (!clientId) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("Sessão expirou."); }
    const { error } = await supabase.from("future_sales").insert({
      vendor_id: user.id,
      client_id: clientId,
      expected_tons: Number(totalTons.toFixed(2)),
      expected_month: month + "-01",
      notes: "Gerado pela Calculadora de Gesso",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Previsão de venda criada a partir do cálculo.");
    qc.invalidateQueries({ queryKey: ["future_sales"] });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <TrendingUp className="h-4 w-4 text-earth" />
          Transformar em previsão de venda
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <Field label="Cliente">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Mês previsto">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[160px]" />
          </Field>
          <Button onClick={submit} disabled={saving || !clientId}>
            {saving ? "Salvando…" : `Salvar ${tons(totalTons)}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
