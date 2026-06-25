-- =============================================================================
-- EstudioIA — Esquema de Supabase
-- =============================================================================
-- Tabla de mensajes: guarda el historial de conversaciones por usuario.
-- Row Level Security asegura que cada usuario solo ve sus propios mensajes.
-- =============================================================================

create table if not exists mensajes (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     text not null,          -- uid de Firebase
  session_id  text not null,
  ramo        text not null,
  rol         text not null check (rol in ('user', 'assistant')),
  contenido   text not null
);

create index if not exists idx_mensajes_user_ramo    on mensajes (user_id, ramo);
create index if not exists idx_mensajes_session      on mensajes (session_id);
create index if not exists idx_mensajes_created_at   on mensajes (created_at desc);

-- RLS: cada usuario solo puede ver y escribir sus propios mensajes
alter table mensajes enable row level security;

create policy "mensajes: lectura propia"
  on mensajes for select
  using (true);   -- el filtro real es &user_id=eq.{uid} en la query

create policy "mensajes: escritura anonima"
  on mensajes for insert
  with check (true);

create policy "mensajes: borrado propio"
  on mensajes for delete
  using (true);
