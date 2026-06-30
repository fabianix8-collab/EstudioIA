-- =============================================================================
-- EstudioIA — Esquema de Supabase
-- =============================================================================
-- Tabla de mensajes: guarda el historial de conversaciones por usuario.
--
-- MODELO DE SEGURIDAD (actualizado):
-- El frontend NO accede a esta tabla directamente. Todo el acceso pasa por
-- la Edge Function `mensajes-proxy`, que:
--   1. Verifica el Firebase ID Token del usuario contra los servidores de
--      Firebase (no se puede falsificar desde el cliente).
--   2. Extrae el uid YA VERIFICADO del token.
--   3. Usa la SERVICE_ROLE key (solo disponible server-side) para leer,
--      escribir o borrar, filtrando siempre por ese uid verificado.
--
-- Por qué no se usa `auth.uid()` de Postgres: la app autentica con Firebase,
-- no con Supabase Auth, así que Postgres no tiene forma nativa de saber
-- qué usuario está haciendo la query — de ahí la necesidad del proxy.
--
-- Las políticas RLS de abajo se dejan en `using (true)` INTENCIONALMENTE,
-- pero esto ya no es un riesgo: la anon key pública no tiene ninguna ruta
-- de acceso a esta tabla, porque solo la service_role key (vía la Edge
-- Function) puede tocarla. RLS aquí actúa como defensa en profundidad,
-- no como el único control de acceso.
-- =============================================================================
create table if not exists mensajes (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     text not null,          -- uid de Firebase, verificado server-side
  session_id  text not null,
  ramo        text not null,
  rol         text not null check (rol in ('user', 'assistant')),
  contenido   text not null
);

create index if not exists idx_mensajes_user_ramo    on mensajes (user_id, ramo);
create index if not exists idx_mensajes_session      on mensajes (session_id);
create index if not exists idx_mensajes_created_at   on mensajes (created_at desc);

-- RLS habilitado como defensa en profundidad. El control de acceso real
-- ocurre en mensajes-proxy, que es la única ruta autorizada a esta tabla
-- (usa la service_role key, que bypassa RLS por diseño en Supabase, pero
-- queda igual habilitado por si en el futuro se expone la tabla por error
-- con la anon key — en ese caso, sin políticas permisivas, quedaría cerrada).
alter table mensajes enable row level security;

-- NOTA: no se crean políticas de SELECT/INSERT/DELETE para "anon" ni
-- "authenticated". Sin políticas, RLS deniega todo por defecto a esos
-- roles. Solo la service_role key (usada exclusivamente desde
-- mensajes-proxy) puede operar sobre esta tabla, ya que service_role
-- bypassa RLS por diseño en Supabase.
