/**
 * routes/auth.tsx — CORRIGIDO
 * Usa getSession() (sem chamada de rede) em vez de getUser().
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/agrotrial-logo.png";
import { fetchAuthProfile, getHomeRouteForRole } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sessão já ativa → redireciona para a rota correta por role
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const profile = await fetchAuthProfile();
      if (!profile || !profile.active) return;
      navigate({ to: getHomeRouteForRole(profile.role), replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setLoading(false);
      toast.error(
        authError.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : authError.message
      );
      return;
    }

    // Busca profile para obter role
    const profile = await fetchAuthProfile();

    if (!profile) {
      setLoading(false);
      await supabase.auth.signOut();
      toast.error("Perfil não encontrado. Entre em contato com o administrador.");
      return;
    }

    if (!profile.active) {
      setLoading(false);
      await supabase.auth.signOut();
      toast.error("Sua conta foi desativada. Entre em contato com o administrador.");
      return;
    }

    setLoading(false);
    toast.success(profile.role === "admin" ? "Bem-vindo, administrador!" : "Bem-vindo de volta!");
    navigate({ to: getHomeRouteForRole(profile.role), replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <img src={logo} alt="AgroTrial" className="h-14 w-auto" />
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-xl sm:p-8">
          <h1 className="text-center font-display text-xl font-semibold text-foreground">
            Entrar
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Acesse sua carteira de clientes
          </p>

          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-in">E-mail</Label>
              <Input
                id="email-in" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-in">Senha</Label>
              <Input
                id="pw-in" type="password" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base"
              disabled={loading}
            >
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
