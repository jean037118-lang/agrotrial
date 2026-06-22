/**
 * index.tsx
 * Landing page do AgroTrial.
 *
 * Alterações RBAC (Etapa 3):
 *   - Se já há sessão ativa, redireciona para a rota correta por role
 *     (admin → /admin/dashboard, vendedor → /dashboard)
 *   - Antes redirecionava sempre para /dashboard
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sprout, TrendingUp, Wallet, Users, MapPin, BellRing } from "lucide-react";
import { fetchAuthProfile, getHomeRouteForRole } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  { icon: Users,    title: "Cadastro completo",   desc: "Cliente, fazenda, cultura, potencial e histórico." },
  { icon: Wallet,   title: "Comissão automática", desc: "Toneladas × R$ por tonelada, calculado na hora." },
  { icon: BellRing, title: "Recompra inteligente",desc: "Sistema avisa quando é hora de ligar de novo." },
  { icon: TrendingUp,title:"Funil & previsão",    desc: "Lead → venda, com previsão de toneladas futuras." },
  { icon: MapPin,   title: "Mapa de clientes",    desc: "Visualize sua carteira em campo." },
  { icon: Sprout,   title: "Meta & ranking",      desc: "Acompanhe meta mensal e top compradores." },
];

function Landing() {
  const navigate = useNavigate();

  // Redireciona sessão ativa para a rota correta conforme role
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;

      const profile = await fetchAuthProfile();
      if (!profile || !profile.active) return;

      navigate({ to: getHomeRouteForRole(profile.role), replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md gradient-earth text-primary-foreground">
              <Sprout className="h-5 w-5" />
            </div>
            <div className="font-display text-xl font-semibold text-primary">AgroTrial CRM</div>
          </div>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-earth">
                Para vendedores de gesso agrícola
              </span>
              <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.05] text-primary md:text-6xl">
                Vendas por tonelada,<br /> comissão no automático.
              </h1>
              <p className="mt-5 max-w-lg text-lg text-muted-foreground">
                Gestão de clientes, vendas, toneladas e comissões — pensada para quem
                vive no campo e precisa de algo simples no celular e no computador.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/auth"
                  className="rounded-md gradient-earth px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-95"
                >
                  Começar grátis
                </Link>
                <a
                  href="#recursos"
                  className="rounded-md border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground hover:bg-accent"
                >
                  Ver recursos
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-3xl bg-earth/10 blur-2xl" />
              <div className="rounded-3xl border border-border bg-card p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Toneladas vendidas</span>
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                    85% da meta
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-semibold text-primary">850</span>
                  <span className="text-muted-foreground">/ 1.000 t</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[85%] gradient-earth" />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted/60 p-4">
                    <div className="text-xs text-muted-foreground">Comissão do mês</div>
                    <div className="mt-1 font-display text-2xl font-semibold text-earth">R$ 6.800</div>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-4">
                    <div className="text-xs text-muted-foreground">Clientes ativos</div>
                    <div className="mt-1 font-display text-2xl font-semibold text-primary">42</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="border-t border-border/60 bg-card/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="font-display text-3xl font-semibold text-primary md:text-4xl">
              Tudo no mesmo lugar
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Pensado para a rotina do vendedor: rápido de cadastrar, fácil de consultar no campo.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-border bg-card p-6 transition hover:border-earth/60 hover:shadow-md"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-earth">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-primary">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} AgroTrial CRM
        </div>
      </footer>
    </div>
  );
}
