# EstudioIA — Runbook de despliegue

## Requisitos

- Cuenta en [supabase.com](https://supabase.com) (proyecto `estudioia`)
- Cuenta en [console.groq.com](https://console.groq.com) (API key gratuita)
- Repo en GitHub con Pages activado

## Paso 1 — Supabase: crear tablas

En el SQL Editor de tu proyecto Supabase, ejecuta `supabase/schema.sql`.

## Paso 2 — Supabase: desplegar Edge Function

```bash
supabase login
supabase link --project-ref kffomlostoklnixfzzmb
supabase functions deploy groq-proxy
supabase secrets set GROQ_API_KEY=gsk_tu-key-aqui
```

## Paso 3 — GitHub Pages

1. Settings → Pages → Source → GitHub Actions
2. Push a `main` — el workflow despliega automáticamente

## Paso 4 — (Opcional) Firebase para autenticación real

Si quieres login con Google/Email para guardar historial:
1. Crea un proyecto en [console.firebase.google.com](https://console.firebase.google.com)
2. Habilita Authentication → Google + Email/Password
3. En `src/main.js`, en la función `init()`, llama a `initFirebase()` con tus credenciales

Sin Firebase, el botón "Continuar sin cuenta" funciona en modo demo.

## Troubleshooting

| Síntoma | Causa |
|---|---|
| Tutor no responde | GROQ_API_KEY no configurada en Supabase secrets |
| Historial no guarda | Tabla `mensajes` no creada (ejecutar schema.sql) |
| Pantalla en blanco en Pages | Verificar que Pages esté en modo GitHub Actions |
