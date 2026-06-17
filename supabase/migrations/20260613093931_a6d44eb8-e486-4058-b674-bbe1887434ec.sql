
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  commission_per_ton NUMERIC(10,2) NOT NULL DEFAULT 8.00,
  monthly_goal_tons NUMERIC(10,2) NOT NULL DEFAULT 1000,
  recall_days INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  farm TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  culture TEXT,
  potential TEXT NOT NULL DEFAULT 'medio' CHECK (potential IN ('pequeno','medio','grande')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own clients all" ON public.clients FOR ALL TO authenticated USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());
CREATE INDEX clients_vendor_idx ON public.clients(vendor_id);

-- sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients ON DELETE CASCADE,
  product TEXT NOT NULL DEFAULT 'Gesso Agrícola',
  tons NUMERIC(10,2) NOT NULL CHECK (tons > 0),
  price_per_ton NUMERIC(10,2),
  commission_per_ton NUMERIC(10,2) NOT NULL,
  total_commission NUMERIC(12,2) GENERATED ALWAYS AS (tons * commission_per_ton) STORED,
  stage TEXT NOT NULL DEFAULT 'venda' CHECK (stage IN ('lead','contato','proposta','negociacao','venda','pos_venda')),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sales all" ON public.sales FOR ALL TO authenticated USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());
CREATE INDEX sales_vendor_idx ON public.sales(vendor_id);
CREATE INDEX sales_client_idx ON public.sales(client_id);
CREATE INDEX sales_date_idx ON public.sales(sale_date);

-- future_sales (previsão)
CREATE TABLE public.future_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients ON DELETE CASCADE,
  expected_tons NUMERIC(10,2) NOT NULL CHECK (expected_tons > 0),
  expected_month DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.future_sales TO authenticated;
GRANT ALL ON public.future_sales TO service_role;
ALTER TABLE public.future_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own future_sales all" ON public.future_sales FOR ALL TO authenticated USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());
CREATE INDEX future_sales_vendor_idx ON public.future_sales(vendor_id);

-- agenda_tasks
CREATE TABLE public.agenda_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'ligacao' CHECK (type IN ('ligacao','visita','reuniao','pos_venda')),
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_tasks TO authenticated;
GRANT ALL ON public.agenda_tasks TO service_role;
ALTER TABLE public.agenda_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agenda all" ON public.agenda_tasks FOR ALL TO authenticated USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());
CREATE INDEX agenda_vendor_idx ON public.agenda_tasks(vendor_id);

-- timestamp trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sales_updated BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
