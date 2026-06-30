// ============================================================================
// src/api.js — Llamadas a la API (Groq via Edge Function + Supabase via Edge Function)
// ============================================================================
// DECISIONES DE SEGURIDAD:
//
// 1. callLLM() llama a la Supabase Edge Function 'groq-proxy' en vez de
//    llamar directamente a api.groq.com. Esto significa que la GROQ_API_KEY
//    nunca llega al navegador — vive como secret en el servidor de Supabase.
//
// 2. saveMessage(), loadHistory(), loadSession() y deleteSession() llaman a
//    la Edge Function 'mensajes-proxy' en vez de hablar directo con
//    /rest/v1/mensajes usando la anon key.
//
//    POR QUÉ: la app autentica con Firebase, no con Supabase Auth, así que
//    `auth.uid()` de Postgres no puede filtrar por usuario — Row Level
//    Security a nivel de base de datos no tiene forma de saber quién hace
//    la query. Confiar en que el FRONTEND siempre mande el user_id correcto
//    en la query (como se hacía antes) es inseguro: la anon key es pública,
//    y cualquiera puede llamar a la REST API de Supabase directamente sin
//    pasar por este archivo, sin ningún filtro.
//
//    mensajes-proxy verifica el Firebase ID Token del lado del servidor y
//    usa el uid VERIFICADO para filtrar — nunca confía en lo que mande el
//    cliente. Ver supabase/functions/mensajes-proxy/index.ts.
// ============================================================================

import { SUPABASE_URL, SUPABASE_ANON, APP } from './config.js';
import { getCurrentIdToken } from './auth.js';

// ---------------------------------------------------------------------------
// LLM — llama al proxy seguro en Supabase (la key real nunca llega al cliente)
// ---------------------------------------------------------------------------
export async function callLLM(messages) {
  if (APP.isDemoMode) {
    await new Promise(r => setTimeout(r, 1200));
    return getDemoResponse(
      messages[messages.length - 1]?.content ||
      messages[messages.length - 1]?.parts?.[0]?.text || ''
    );
  }

  const normalized = messages.map(m => ({
    role: m.role === 'model' ? 'assistant' : (m.role || 'user'),
    content: m.parts?.[0]?.text ?? m.content ?? '',
  }));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/groq-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify({
      messages: normalized,
      model: 'llama-3.1-8b-instant',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Error ${res.status} del servidor`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.text ?? 'Sin respuesta';
}

function getDemoResponse(question) {
  const ramo = APP.currentRamo?.name || 'el tema';
  return `**[Modo Demo]** Estoy funcionando como tutor de **${ramo}**.

Esta es una vista previa del tutor. En la versión completa respondería tu pregunta: _"${String(question).substring(0, 80)}..."_

Aquí hay un ejemplo de código formateado:

\`\`\`python
def hola_mundo():
    print("¡EstudioIA funcionando!")
    return True
\`\`\`

¡EstudioIA es tu compañero de estudio para aprender tecnología! 🚀`;
}

// ---------------------------------------------------------------------------
// Supabase — historial de mensajes vía mensajes-proxy (Firebase token verificado)
// ---------------------------------------------------------------------------

/**
 * Wrapper interno: llama a mensajes-proxy adjuntando el Firebase ID Token
 * del usuario autenticado. Si no hay sesión activa, no hace la llamada.
 */
async function mensajesProxyCall(action, extra = {}) {
  if (!APP.user || APP.isDemoMode) return null;

  // APP.user es un objeto plano (uid, email, name) — no tiene getIdToken().
  // El token real se obtiene de la instancia viva de Firebase Auth.
  let idToken;
  try {
    idToken = await getCurrentIdToken();
  } catch (err) {
    console.error('[mensajes-proxy] Could not get ID token:', err.message);
    return null;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/mensajes-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({ action, idToken, ...extra }),
    });

    if (!res.ok) {
      console.error(`[mensajes-proxy] ${action} failed:`, res.status);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error(`[mensajes-proxy] ${action} error:`, err);
    return null;
  }
}

export async function saveMessage(rol, contenido, ramo) {
  await mensajesProxyCall('save', {
    rol,
    contenido,
    ramo,
    sessionId: APP.sessionId || 'default',
  });
}

export async function loadHistory(ramo) {
  const result = await mensajesProxyCall('loadHistory', { ramo });
  return result?.data || [];
}

export async function loadSession(sessionId) {
  const result = await mensajesProxyCall('loadSession', { sessionId });
  return result?.data || [];
}

export async function deleteSession(sessionId) {
  await mensajesProxyCall('deleteSession', { sessionId });
}
