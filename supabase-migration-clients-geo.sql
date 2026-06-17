-- Adiciona colunas de coordenadas geográficas à tabela de clientes.
-- Execute este script no SQL Editor do seu projeto Supabase
-- (Project > SQL Editor > New query).

alter table public.clients
  add column if not exists lat numeric,
  add column if not exists lng numeric;

comment on column public.clients.lat is 'Latitude (geocodificada a partir de cidade/estado ou definida manualmente)';
comment on column public.clients.lng is 'Longitude (geocodificada a partir de cidade/estado ou definida manualmente)';
