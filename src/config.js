// ============================================================================
// src/config.js — Configuración central de EstudioIA
// ============================================================================
// DECISION DE SEGURIDAD:
// Las keys públicas de Supabase (URL + anon key) están hardcodeadas aquí.
// Esto es CORRECTO y seguro porque:
//   1. La anon key es pública por diseño — Supabase la protege con RLS,
//      no escondiéndola.
//   2. La GROQ_API_KEY NUNCA está aquí — vive como secret en el servidor
//      de Supabase (Edge Function groq-proxy).
//
// Lo que un visitante puede hacer con estas keys:
//   - Leer/escribir solo lo que las políticas RLS permiten (historial propio)
//   - Llamar a la Edge Function groq-proxy (que a su vez limita el uso)
//
// Lo que NO puede hacer:
//   - Acceder a la GROQ_API_KEY (está en el servidor, nunca llega al cliente)
//   - Leer historial de otros usuarios (RLS por user_id de Firebase)
// ============================================================================

export const SUPABASE_URL  = 'https://kffomlostoklnixfzzmb.supabase.co';
export const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZm9tbG9zdG9rbG5peGZ6em1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNTU0MjgsImV4cCI6MjA5NzczMTQyOH0.DznF4A3iNk0gl7K0lWv4E0Z_a_UjcXqua72gU_fYh9E';

// Estado global de la aplicación
// (sin localStorage — las keys nunca se guardan en el navegador)
export const APP = {
  user:        null,
  isDemoMode:  false,
  currentRamo: null,
  messages:    [],
  sessionId:   null,
};
