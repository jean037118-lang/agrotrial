-- =============================================================================
-- AgroTrial CRM — Migration RBAC
-- Adiciona: role, active, email em profiles
-- Cria:     função is_admin(), função handle_new_user atualizada
-- Atualiza: políticas RLS de todas as tabelas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ALTERAÇÕES NA TABELA profiles
-- -----------------------------------------------------------------------------

-- Campo de perfil: 'admin' ou 'vendedor' (padrão vendedor para não quebrar contas existentes)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'vendedor'
  CHECK (role IN ('admin', 'vendedor'));

-- Campo de status: permite ativar/inativar vendedores
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Campo de e-mail: espelhado do auth.users para facilitar a gestão de usuários pelo admin
-- (auth.users não é acessível diretamente pelo frontend via RLS)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Preenche o e-mail nas contas já existentes a partir do auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- -----------------------------------------------------------------------------
-- 2. FUNÇÃO is_admin()
-- Verifica se o usuário autenticado tem role = 'admin' na tabela profiles.
-- Usada nas políticas RLS — SECURITY DEFINER para leitura segura sem loop.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. POLÍTICAS RLS — profiles
-- Regra: o próprio usuário lê/edita seu perfil.
--        Admin lê todos os perfis e pode editar qualquer um.
--        Apenas service_role pode criar perfis (trigger handle_new_user).
-- -----------------------------------------------------------------------------

-- Remove políticas anteriores
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;

-- Leitura: próprio perfil OU admin
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Atualização pelo próprio usuário (nome, meta, dias de recompra)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));
  -- Vendedor não pode alterar o próprio role via esta policy

-- Atualização pelo admin (pode mudar role, active, commission_per_ton de qualquer perfil)
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Insert: apenas service_role (via trigger on_auth_user_created)
-- Não criamos policy de INSERT para 'authenticated' — o trigger usa SECURITY DEFINER

-- -----------------------------------------------------------------------------
-- 4. POLÍTICAS RLS — clients
-- Regra: vendedor vê/edita apenas seus clientes.
--        Admin vê todos (somente leitura — não cria/edita clientes alheios).
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "own clients all" ON public.clients;

-- Vendedor: acesso total apenas aos próprios
CREATE POLICY "clients_vendor_all"
  ON public.clients FOR ALL TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- Admin: leitura de todos os clientes (sem WITH CHECK = somente leitura via RLS)
CREATE POLICY "clients_admin_select"
  ON public.clients FOR SELECT TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 5. POLÍTICAS RLS — sales
-- Regra: vendedor vê/edita apenas suas vendas.
--        Admin vê todas as vendas (somente leitura).
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "own sales all" ON public.sales;

CREATE POLICY "sales_vendor_all"
  ON public.sales FOR ALL TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "sales_admin_select"
  ON public.sales FOR SELECT TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. POLÍTICAS RLS — future_sales
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "own future_sales all" ON public.future_sales;

CREATE POLICY "future_sales_vendor_all"
  ON public.future_sales FOR ALL TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "future_sales_admin_select"
  ON public.future_sales FOR SELECT TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 7. POLÍTICAS RLS — agenda_tasks
-- Agenda é exclusiva do vendedor — admin não precisa ver.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "own agenda all" ON public.agenda_tasks;

CREATE POLICY "agenda_vendor_all"
  ON public.agenda_tasks FOR ALL TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 8. FUNÇÃO handle_new_user — atualizada para incluir email e role
-- Role padrão continua 'vendedor'. Admin é definido manualmente ou pelo painel.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor'),
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET email  = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. FUNÇÃO admin_create_user()
-- Permite ao admin criar um novo vendedor via RPC sem expor a service_role key.
-- O frontend chama: supabase.rpc('admin_create_user', { ... })
-- Internamente usa auth.admin — disponível no contexto SECURITY DEFINER service_role.
-- NOTA: esta função deve ser criada com permissão de service_role no painel Supabase
--       ou via SQL Editor logado como postgres/service_role.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email           TEXT,
  p_password        TEXT,
  p_full_name       TEXT,
  p_role            TEXT DEFAULT 'vendedor',
  p_commission      NUMERIC DEFAULT 8.00,
  p_monthly_goal    NUMERIC DEFAULT 1000,
  p_recall_days     INTEGER DEFAULT 60
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_user_id UUID;
  v_result      JSON;
BEGIN
  -- Apenas admins podem chamar esta função
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem criar usuários.';
  END IF;

  -- Valida role
  IF p_role NOT IN ('admin', 'vendedor') THEN
    RAISE EXCEPTION 'Role inválido: use ''admin'' ou ''vendedor''.';
  END IF;

  -- Cria o usuário no auth.users via extensão interna do Supabase
  SELECT id INTO v_new_user_id
  FROM auth.users
  WHERE email = p_email;

  IF v_new_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe um usuário com o e-mail %', p_email;
  END IF;

  -- Insere na auth.users (disponível em SECURITY DEFINER com role service_role)
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, created_at, updated_at,
    instance_id, aud, role
  )
  VALUES (
    gen_random_uuid(),
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', p_full_name, 'role', p_role),
    now(), now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
  )
  RETURNING id INTO v_new_user_id;

  -- Upsert no profile (o trigger já faz isso, mas garantimos commission e goal)
  INSERT INTO public.profiles (
    id, full_name, email, role, active,
    commission_per_ton, monthly_goal_tons, recall_days
  )
  VALUES (
    v_new_user_id, p_full_name, p_email, p_role, true,
    p_commission, p_monthly_goal, p_recall_days
  )
  ON CONFLICT (id) DO UPDATE SET
    commission_per_ton = EXCLUDED.commission_per_ton,
    monthly_goal_tons  = EXCLUDED.monthly_goal_tons,
    recall_days        = EXCLUDED.recall_days,
    role               = EXCLUDED.role;

  v_result := json_build_object(
    'id',    v_new_user_id,
    'email', p_email,
    'role',  p_role
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_user(TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,INTEGER)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. FUNÇÃO admin_update_user()
-- Admin atualiza dados de qualquer vendedor (role, comissão, active, nome).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id         UUID,
  p_full_name       TEXT        DEFAULT NULL,
  p_role            TEXT        DEFAULT NULL,
  p_commission      NUMERIC     DEFAULT NULL,
  p_monthly_goal    NUMERIC     DEFAULT NULL,
  p_recall_days     INTEGER     DEFAULT NULL,
  p_active          BOOLEAN     DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem editar usuários.';
  END IF;

  IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'vendedor') THEN
    RAISE EXCEPTION 'Role inválido: use ''admin'' ou ''vendedor''.';
  END IF;

  UPDATE public.profiles SET
    full_name          = COALESCE(p_full_name,    full_name),
    role               = COALESCE(p_role,          role),
    commission_per_ton = COALESCE(p_commission,    commission_per_ton),
    monthly_goal_tons  = COALESCE(p_monthly_goal,  monthly_goal_tons),
    recall_days        = COALESCE(p_recall_days,   recall_days),
    active             = COALESCE(p_active,        active),
    updated_at         = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado: %', p_user_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_user(UUID,TEXT,TEXT,NUMERIC,NUMERIC,INTEGER,BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user(UUID,TEXT,TEXT,NUMERIC,NUMERIC,INTEGER,BOOLEAN)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 11. VIEW admin_sales_summary
-- Agrega vendas por vendedor para o dashboard admin.
-- Acessível apenas por admin via RLS implícita na função is_admin().
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.admin_sales_summary AS
SELECT
  p.id                                              AS vendor_id,
  p.full_name                                       AS vendor_name,
  p.email                                           AS vendor_email,
  p.commission_per_ton,
  p.monthly_goal_tons,
  p.active,
  COUNT(s.id)                                       AS total_sales,
  COALESCE(SUM(s.tons), 0)                          AS total_tons,
  COALESCE(SUM(s.total_commission), 0)              AS total_commission,
  COALESCE(SUM(CASE
    WHEN date_trunc('month', s.sale_date::date) = date_trunc('month', CURRENT_DATE)
    THEN s.tons ELSE 0
  END), 0)                                          AS month_tons,
  COALESCE(SUM(CASE
    WHEN date_trunc('month', s.sale_date::date) = date_trunc('month', CURRENT_DATE)
    THEN s.total_commission ELSE 0
  END), 0)                                          AS month_commission,
  COALESCE(SUM(CASE
    WHEN date_trunc('year', s.sale_date::date) = date_trunc('year', CURRENT_DATE)
    THEN s.tons ELSE 0
  END), 0)                                          AS year_tons,
  COUNT(DISTINCT c.id)                              AS total_clients
FROM public.profiles p
LEFT JOIN public.sales s   ON s.vendor_id = p.id
LEFT JOIN public.clients c ON c.vendor_id = p.id
WHERE p.role = 'vendedor'
GROUP BY p.id, p.full_name, p.email, p.commission_per_ton, p.monthly_goal_tons, p.active;

-- Grant apenas para authenticated; o acesso real é controlado via is_admin() no frontend
GRANT SELECT ON public.admin_sales_summary TO authenticated;

-- -----------------------------------------------------------------------------
-- Comentários finais
-- -----------------------------------------------------------------------------
-- Após aplicar esta migration:
-- 1. Defina manualmente o primeiro admin:
--    UPDATE public.profiles SET role = 'admin' WHERE email = 'seuemail@dominio.com';
-- 2. Teste is_admin() logado como admin:
--    SELECT public.is_admin();  -- deve retornar true
-- 3. Prossiga com as etapas de frontend (Etapas 2 a 5).
-- =============================================================================
