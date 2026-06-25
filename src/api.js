// ============================================================================
// src/api.js — Llamadas a la API (Groq via Edge Function + Supabase REST)
// ============================================================================
// DECISIONES DE SEGURIDAD:
//
// 1. callLLM() llama a la Supabase Edge Function 'groq-proxy' en vez de
//    llamar directamente a api.groq.com. Esto significa que la GROQ_API_KEY
//    nunca llega al navegador — vive como secret en el servidor de Supabase.
//    Renombrado de 'callGemini' (nombre incorrecto del archivo original) a
//    'callLLM' para reflejar que es agnóstico al proveedor.
//
// 2. saveMessage() y loadHistory() usan la REST API de Supabase con la
//    anon key. La seguridad real la da Row Level Security (RLS) en Supabase:
//    cada usuario solo puede leer/escribir sus propios mensajes.
//    Ver supabase/schema.sql para las políticas.
// ============================================================================

import { SUPABASE_URL, SUPABASE_ANON, APP } from './config.js';

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

  // Normalizar al formato OpenAI (role + content) que espera groq-proxy
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
// Supabase REST — historial de mensajes
// ---------------------------------------------------------------------------
async function supabaseFetch(method, path, body) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      method,
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=minimal' : 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    if (method === 'GET') return await res.json();
    return true;
  } catch {
    return null;
  }
}

export async function saveMessage(rol, contenido, ramo) {
  if (!APP.user || APP.isDemoMode) return;
  await supabaseFetch('POST', '/mensajes', {
    rol, contenido, ramo,
    user_id: APP.user.uid,
    session_id: APP.sessionId || 'default',
  });
}

export async function loadHistory(ramo) {
  if (!APP.user || APP.isDemoMode) return [];
  const data = await supabaseFetch('GET',
    `/mensajes?user_id=eq.${APP.user.uid}&ramo=eq.${ramo}&order=created_at.asc&limit=200`
  );
  return data || [];
}

export async function loadSession(sessionId) {
  if (!APP.user || APP.isDemoMode) return [];
  const data = await supabaseFetch('GET',
    `/mensajes?user_id=eq.${APP.user.uid}&session_id=eq.${sessionId}&order=created_at.asc`
  );
  return data || [];
}

export async function deleteSession(sessionId) {
  if (!APP.user || APP.isDemoMode) return;
  await supabaseFetch('DELETE',
    `/mensajes?user_id=eq.${APP.user.uid}&session_id=eq.${sessionId}`
  );
}
