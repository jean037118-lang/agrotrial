import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/agrotrial-logo.png";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard" });
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
            <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
