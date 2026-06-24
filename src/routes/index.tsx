/**
 * routes/index.tsx
 * Redireciona direto para /auth — sem landing page.
 * Se já houver sessão ativa, redireciona para a rota correta por role.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchAuthProfile, getHomeRouteForRole } from "@/lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Verifica sessão ativa
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      // Sessão existe → redireciona para painel correto por role
      const profile = await fetchAuthProfile();
      if (profile && profile.active) {
        throw redirect({ to: getHomeRouteForRole(profile.role) });
      }
    }

    // Sem sessão → vai direto para login
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
