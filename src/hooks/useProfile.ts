/**
 * useProfile.ts
 * Hook central de perfil e autorização do AgroTrial.
 *
 * Fornece:
 *   - Dados completos do usuário logado (nome, email, role, comissão…)
 *   - Flags de papel: isAdmin, isVendedor
 *   - Flag de bloqueio: isInactive
 *   - Estado de carregamento: isLoading
 *
 * Uso:
 *   const { isAdmin, profile, isLoading } = useProfile();
 */

import { useQuery, queryOptions } from "@tanstack/react-query";
import { fetchAuthProfile, type AuthProfile, type UserRole } from "@/lib/auth";

// ─── Query options (reutilizável em loaders de rota) ─────────────────────────

export const profileQueryOptions = queryOptions<AuthProfile | null>({
  queryKey: ["auth-profile"],
  queryFn: fetchAuthProfile,
  // Revalida quando a janela recupera foco (sessão pode ter mudado)
  refetchOnWindowFocus: true,
  // Mantém os dados em cache por 5 minutos — role não muda com frequência
  staleTime: 5 * 60 * 1000,
});

// ─── Hook principal ───────────────────────────────────────────────────────────

export interface UseProfileReturn {
  /** Dados completos do perfil, ou null enquanto carrega / sem sessão */
  profile: AuthProfile | null;
  /** Papel do usuário: 'admin' | 'vendedor' | undefined */
  role: UserRole | undefined;
  /** true se o usuário tem role === 'admin' */
  isAdmin: boolean;
  /** true se o usuário tem role === 'vendedor' */
  isVendedor: boolean;
  /** true se o usuário está marcado como inativo pelo admin */
  isInactive: boolean;
  /** true enquanto o perfil está sendo carregado pela primeira vez */
  isLoading: boolean;
  /** true se houve erro ao carregar o perfil */
  isError: boolean;
}

export function useProfile(): UseProfileReturn {
  const { data: profile, isLoading, isError } = useQuery(profileQueryOptions);

  const role = profile?.role;
  const isAdmin = role === "admin";
  const isVendedor = role === "vendedor";
  const isInactive = profile !== null && profile?.active === false;

  return {
    profile: profile ?? null,
    role,
    isAdmin,
    isVendedor,
    isInactive,
    isLoading,
    isError,
  };
}
