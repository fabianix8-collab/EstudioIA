# 🎓 EstudioIA — Tu Tutor Inteligente de Tecnología

> **Demo en vivo:** [fabianix8-collab.github.io/EstudioIA](https://fabianix8-collab.github.io/EstudioIA/)

Plataforma de tutorías con IA especializada en tecnología e informática. Cada tutor tiene un perfil y contexto distinto — no es un chatbot genérico, es un tutor que entiende el dominio específico de lo que estás estudiando.

---

## ¿Qué hace?

- **6 tutores especializados** — Programación, Base de Datos, Redes, Sistemas Operativos, Cloud & DevOps, e Inteligencia Artificial. Cada uno con su propio system prompt, chips de pregunta rápida y color de acento
- **Historial de conversaciones** — las sesiones se guardan por usuario y ramo en Supabase, con agrupación por sesión y vista de conversaciones anteriores
- **Formateo de código** — bloques de código con resaltado de sintaxis, negritas, cursivas y links renderizados correctamente en el chat
- **IA real vía proxy seguro** — llama a Groq (Llama 3.1) a través de una Supabase Edge Function; la API key nunca llega al navegador
- **Modo demo** — cualquier visitante puede usar la app sin configurar nada ni crear cuenta
- **Dark/Light mode** — con transiciones suaves y preferencia persistida
- **Deploy automático** — GitHub Actions despliega en cada push a `main`

---

## Demo

**[→ Abrir EstudioIA](https://fabianix8-collab.github.io/EstudioIA/)**

Haz click en **"Continuar sin cuenta"** para entrar al modo demo sin crear cuenta. En modo completo (con Groq API key configurada), el tutor responde con IA real usando Llama 3.1 de Groq.

---

## Screenshots

![Selector de tutores — 6 áreas de tecnología disponibles](screenshots/selector.png)

![Chat con el tutor de Programación](screenshots/tutor-ia.png)

---

## Arquitectura

```
Usuario
  │
  ▼
index.html  (HTML + CSS)
  │
  ├── src/config.js   — estado global, URL de Supabase (pública por diseño)
  ├── src/ramos.js    — configuración de los 6 tutores
  ├── src/api.js      — callLLM() + acceso a historial vía Edge Functions
  ├── src/auth.js     — Firebase authentication
  ├── src/ui.js       — DOM helpers, formateo Markdown, renderHistory
  ├── src/chat.js     — lógica de conversación y sesiones
  └── src/main.js     — inicialización y conexión de eventos
         │
         ├──────────────────────────────┬─────────────────────────────┐
         ▼                              ▼                             │
  Edge Function: groq-proxy      Edge Function: mensajes-proxy        │
         │                              │                             │
   GROQ_API_KEY                  verifica Firebase ID Token           │
   (secret, server-side)         con la API de Firebase                │
         ▼                              │                             │
   Groq API (Llama 3.1)                 ▼                             │
                              usa SERVICE_ROLE_KEY (secret) para ──────┘
                              leer/escribir en Supabase, filtrando
                              siempre por el uid YA VERIFICADO
```

**Decisión de seguridad clave #1 — Groq API Key:** nunca llega al navegador. Toda llamada a Groq pasa por `supabase/functions/groq-proxy`, donde la key vive como variable de entorno del servidor. Esto resuelve el problema más común en proyectos de IA frontend: keys expuestas en el bundle de JavaScript.

**Decisión de seguridad clave #2 — acceso a `mensajes`:** ver sección **Security** más abajo.

---

## Security

Esta sección documenta una vulnerabilidad real que se identificó y corrigió durante el desarrollo — se deja documentada intencionalmente, porque el proceso de encontrar y corregir problemas de seguridad es tan relevante como el código final.

**El problema.** La tabla `mensajes` en Supabase originalmente tenía Row Level Security (RLS) habilitado, pero con políticas `using (true)` — es decir, RLS estaba activo pero configurado para permitir todo. El frontend filtraba correctamente por `user_id` en sus queries, pero ese filtro vivía solo en el código JavaScript del cliente. Como la `anon key` de Supabase es pública (visible en cualquier navegador que cargue la app), cualquiera podía hacer una llamada REST directa a `/rest/v1/mensajes` sin pasar por el frontend, sin ningún filtro, y leer o borrar el historial de conversaciones de **cualquier usuario** — un IDOR (Insecure Direct Object Reference) explotable, no teórico.

**Por qué pasó.** La app autentica con Firebase, no con Supabase Auth. Las políticas RLS de Postgres pueden filtrar automáticamente usando `auth.uid()` — pero solo cuando la autenticación es de Supabase. Con Firebase, Postgres no tiene ninguna forma nativa de saber qué usuario está haciendo la query, así que la única defensa real terminó siendo "confiar en que el frontend mande el filtro correcto" — que no es una defensa cuando la API es pública.

**El fix.** Se migró el acceso a `mensajes` detrás de una nueva Edge Function, `mensajes-proxy`, siguiendo el mismo patrón ya usado para `groq-proxy`:

1. El frontend ya no llama a `/rest/v1/mensajes` con la anon key. En su lugar, manda su Firebase ID Token a `mensajes-proxy`.
2. La función verifica ese token contra los servidores de Firebase (server-side, no falsificable desde el cliente).
3. Solo con el `uid` ya verificado, la función usa la `service_role` key — que vive únicamente en el servidor — para leer, escribir o borrar, filtrando siempre por ese uid.
4. Las políticas RLS permisivas se eliminaron; sin políticas, RLS deniega todo por defecto a `anon` y `authenticated`. Solo `service_role` (usada exclusivamente desde la función) puede operar sobre la tabla.

El resultado: la anon key pública ya no tiene ninguna ruta de acceso a `mensajes`, sin importar qué tan pública sea.

Este hallazgo surgió auditando el propio proyecto con [GitScan](https://github.com/fabianix8-collab/gitscan), otra herramienta de este portafolio.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5 + CSS3 + JavaScript ES Modules (sin bundler, sin framework) |
| IA | Groq API (Llama 3.1-8b-instant) vía Supabase Edge Function |
| Base de datos | Supabase (Postgres + RLS, acceso vía Edge Functions) |
| Autenticación | Firebase Auth (Google + Email/Password) |
| Deploy | GitHub Pages + GitHub Actions |

---

## Estructura del proyecto

```
EstudioIA/
├── index.html                              # Entrada principal (HTML + CSS)
├── src/
│   ├── config.js                           # Estado global y config de Supabase
│   ├── ramos.js                            # Los 6 tutores especializados
│   ├── api.js                              # callLLM() + acceso a historial vía proxies
│   ├── auth.js                             # Firebase auth + obtención de ID Token
│   ├── ui.js                               # DOM helpers y formateo
│   ├── chat.js                             # Lógica de conversación
│   └── main.js                             # Punto de entrada
├── supabase/
│   ├── schema.sql                          # Tablas + RLS (acceso solo vía service_role)
│   └── functions/
│       ├── groq-proxy/index.ts             # Proxy seguro para Groq API
│       └── mensajes-proxy/index.ts         # Gateway verificado para historial de mensajes
├── screenshots/                            # Capturas para el README
├── .github/workflows/deploy.yml            # CI/CD a GitHub Pages
└── DEPLOYMENT.md                           # Runbook operativo completo
```

---

## Correr localmente

```bash
# Clonar el repo
git clone https://github.com/fabianix8-collab/EstudioIA.git
cd EstudioIA

# Servir con cualquier servidor estático
npx serve .
# → http://localhost:3000
```

No requiere `npm install` ni proceso de build. Es HTML/JS puro con ES Modules nativos del navegador.

Para activar el tutor IA real y el historial de conversaciones localmente, necesitas ambas Edge Functions de Supabase desplegadas (`groq-proxy` y `mensajes-proxy`). Ver `DEPLOYMENT.md`.

---

## Roadmap

- [x] 6 tutores especializados con system prompts por dominio
- [x] Proxy seguro para Groq API (key nunca en el cliente)
- [x] Historial de conversaciones agrupado por sesión
- [x] Formateo de código y Markdown en el chat
- [x] Modo demo sin configuración
- [x] Arquitectura modular (6 módulos JS con responsabilidad única)
- [x] Deploy automático con GitHub Actions
- [x] Gateway verificado server-side para acceso a historial (ver Security)
- [ ] Persistencia de sesión entre visitas (IndexedDB)
- [ ] Soporte para más modelos (Mixtral, Gemma)
- [ ] Exportar conversación como PDF
- [ ] Modo "examen" — el tutor hace preguntas en vez de responderlas

---

## Contexto

Estudiar tecnología fuera de horario de clases significa, casi siempre, quedarte con la duda hasta el día siguiente — o perder media hora buscando en foros una respuesta que ya nadie revisa. EstudioIA nace de esa fricción: un tutor especializado por área, disponible a cualquier hora, que entiende el contexto específico de lo que estás preguntando en vez de dar respuestas genéricas de chatbot.

No reemplaza un profesor ni un compañero de estudio — es un complemento para esas dos de la mañana en que solo necesitas que alguien te explique por qué tu query no usa el índice, o qué diferencia hay entre TCP y UDP en la práctica, sin tener que esperar a la próxima clase.

---

## Licencia

MIT — proyecto educativo / portafolio.
