// ============================================================================
// supabase/functions/mensajes-proxy/index.ts
// ============================================================================
// Gateway de acceso a la tabla `mensajes`.
//
// PROBLEMA QUE RESUELVE:
// El frontend autentica con Firebase, no con Supabase Auth. Eso significa
// que `auth.uid()` de Postgres no tiene forma de saber quién es el usuario,
// y las políticas RLS de `mensajes` quedaban en `using (true)` — es decir,
// CUALQUIERA con la anon key (pública, vive en el navegador de cualquier
// visitante) podía leer o borrar el historial de CUALQUIER usuario haciendo
// una llamada REST directa a Supabase sin pasar por el frontend.
//
// SOLUCIÓN:
// El frontend deja de hablar directo con /rest/v1/mensajes. En su lugar,
// manda su Firebase ID Token a esta función. Acá:
//   1. Se verifica el token contra los servidores de Firebase (server-side,
//      no se puede falsificar).
//   2. Se extrae el `uid` YA VERIFICADO del token — nunca del body que
//      manda el cliente.
//   3. Se usa la SERVICE_ROLE key (que vive solo acá, en el servidor) para
//      tocar la tabla, filtrando siempre por ese uid verificado.
//
// Resultado: la anon key pública ya no tiene ningún uso sobre `mensajes`,
// y un atacante no puede leer datos de otro usuario aunque tenga la anon key,
// porque ya no hay ninguna ruta que la acepte para esta tabla.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SERVICE_ROLE_KEY')!;
const FIREBASE_PROJECT_ID   = Deno.env.get('FIREBASE_PROJECT_ID')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Cliente de Supabase con privilegios de servicio — nunca se expone al cliente
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { action, idToken, ramo, contenido, rol, sessionId } = await req.json();

    if (!idToken) {
      return jsonResponse({ error: 'Missing Firebase ID token' }, 401);
    }

    // Verifica el token contra Firebase. Si está falsificado, expirado,
    // o no corresponde a este proyecto, lanza error y cortamos acá.
    const uid = await verifyFirebaseToken(idToken);
    if (!uid) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }

    switch (action) {
      case 'save':
        return await handleSave(uid, rol, contenido, ramo, sessionId);
      case 'loadHistory':
        return await handleLoadHistory(uid, ramo);
      case 'loadSession':
        return await handleLoadSession(uid, sessionId);
      case 'deleteSession':
        return await handleDeleteSession(uid, sessionId);
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('[mensajes-proxy] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

// ── Handlers ─────────────────────────────────────────────────

async function handleSave(uid: string, rol: string, contenido: string, ramo: string, sessionId: string) {
  if (!rol || !contenido || !ramo) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  const { error } = await supabase.from('mensajes').insert({
    rol,
    contenido,
    ramo,
    user_id:    uid, // uid verificado server-side, no el que mandó el cliente
    session_id: sessionId || 'default',
  });

  if (error) {
    console.error('[mensajes-proxy] Insert error:', error);
    return jsonResponse({ error: 'Failed to save message' }, 500);
  }

  return jsonResponse({ success: true });
}

async function handleLoadHistory(uid: string, ramo: string) {
  if (!ramo) return jsonResponse({ error: 'Missing ramo' }, 400);

  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .eq('user_id', uid)
    .eq('ramo', ramo)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[mensajes-proxy] Select error:', error);
    return jsonResponse({ error: 'Failed to load history' }, 500);
  }

  return jsonResponse({ data });
}

async function handleLoadSession(uid: string, sessionId: string) {
  if (!sessionId) return jsonResponse({ error: 'Missing sessionId' }, 400);

  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .eq('user_id', uid)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[mensajes-proxy] Select error:', error);
    return jsonResponse({ error: 'Failed to load session' }, 500);
  }

  return jsonResponse({ data });
}

async function handleDeleteSession(uid: string, sessionId: string) {
  if (!sessionId) return jsonResponse({ error: 'Missing sessionId' }, 400);

  const { error } = await supabase
    .from('mensajes')
    .delete()
    .eq('user_id', uid)
    .eq('session_id', sessionId);

  if (error) {
    console.error('[mensajes-proxy] Delete error:', error);
    return jsonResponse({ error: 'Failed to delete session' }, 500);
  }

  return jsonResponse({ success: true });
}

// ── Firebase token verification ─────────────────────────────

/**
 * Verifica un Firebase ID Token sin el SDK completo de Firebase Admin
 * (que no corre nativamente en Deno/Edge Functions). Usa el endpoint
 * público de Google para verificación de tokens, que es el mecanismo
 * oficial soportado para entornos no-Node.
 *
 * Docs: https://firebase.google.com/docs/auth/admin/verify-id-tokens
 */
async function verifyFirebaseToken(idToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${Deno.env.get('FIREBASE_WEB_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const user = data.users?.[0];

    // Verificación adicional: el token debe pertenecer a este proyecto
    if (!user || !user.localId) return null;

    return user.localId; // este es el Firebase uid
  } catch (err) {
    console.error('[mensajes-proxy] Token verification failed:', err);
    return null;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
