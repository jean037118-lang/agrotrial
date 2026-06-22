/**
 * RoleGuard.tsx
 * Componente que bloqueia a renderização de conteúdo com base no papel do usuário.
 *
 * Uso 1 — Bloquear rota inteira (em _authenticated/route.tsx ou _admin/route.tsx):
 *   <RoleGuard allow="admin" redirectTo="/dashboard" />
 *
 * Uso 2 — Ocultar trecho de UI condicionalmente:
 *   <RoleGuard allow="admin" fallback={null}>
 *     <BotaoDeAdmin />
 *   </RoleGuard>
 *
 * Uso 3 — Bloquear usuário inativo:
 *   <RoleGuard allow="vendedor" checkActive />
 */

import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useProfile } from "@/hooks/useProfile";
import type { UserRole } from "@/lib/auth";
import { Sprout } from "lucide-react";

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoleGuardProps {
  /** Papel(éis) permitido(s) para acessar este conteúdo */
  allow: UserRole | UserRole[];
  /** Rota para redirecionar quando o papel não bate. Se omitido, renderiza fallback. */
  redirectTo?: string;
  /** Conteúdo a renderizar quando autorizado */
  children?: React.ReactNode;
  /** Conteúdo a renderizar quando NÃO autorizado (padrão: null) */
  fallback?: React.ReactNode;
  /** Se true, bloqueia também usuários com active === false */
  checkActive?: boolean;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function RoleGuard({
  allow,
  redirectTo,
  children,
  fallback = null,
  checkActive = false,
}: RoleGuardProps) {
  const navigate = useNavigate();
  const { role, isInactive, isLoading } = useProfile();

  const allowedRoles = Array.isArray(allow) ? allow : [allow];
  const isAllowed = role !== undefined && allowedRoles.includes(role);
  const isBlocked = !isAllowed || (checkActive && isInactive);

  useEffect(() => {
    if (isLoading || !isBlocked || !redirectTo) return;
    navigate({ to: redirectTo as never, replace: true });
  }, [isLoading, isBlocked, redirectTo, navigate]);

  // Enquanto carrega, exibe spinner neutro para evitar flash de conteúdo errado
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Sprout className="h-8 w-8 animate-pulse text-primary" />
          <span className="text-sm">Carregando…</span>
        </div>
      </div>
    );
  }

  // Usuário inativo — exibe mensagem específica
  if (checkActive && isInactive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-destructive/10">
            <Sprout className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Conta desativada
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta foi desativada pelo administrador. Entre em contato para
            reativar o acesso.
          </p>
        </div>
      </div>
    );
  }

  // Papel não autorizado com redirect configurado — aguarda o useEffect navegar
  if (isBlocked && redirectTo) return null;

  // Papel não autorizado sem redirect — renderiza fallback
  if (isBlocked) return <>{fallback}</>;

  // Autorizado — renderiza conteúdo normalmente
  return <>{children}</>;
}

// ─── Helpers de conveniência ──────────────────────────────────────────────────

/** Renderiza children apenas se o usuário for admin */
export function AdminOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <RoleGuard allow="admin" fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/** Renderiza children apenas se o usuário for vendedor */
export function VendedorOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <RoleGuard allow="vendedor" fallback={fallback}>
      {children}
    </RoleGuard>
  );
}
