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
  ├── src/api.js      — callLLM() + Supabase REST (historial)
  ├── src/auth.js     — Firebase authentication
  ├── src/ui.js       — DOM helpers, formateo Markdown, renderHistory
  ├── src/chat.js     — lógica de conversación y sesiones
  └── src/main.js     — inicialización y conexión de eventos
         │
         ▼
  Supabase Edge Function: groq-proxy
         │                    ↑
         │              GROQ_API_KEY (secret en servidor, nunca en cliente)
         ▼
  Groq API (Llama 3.1-8b-instant)
```

**Decisión de seguridad clave:** la GROQ_API_KEY nunca llega al navegador. Toda llamada a Groq pasa por `supabase/functions/groq-proxy`, donde la key vive como variable de entorno del servidor. Esto resuelve el problema más común en proyectos de IA frontend: keys expuestas en el bundle de JavaScript.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5 + CSS3 + JavaScript ES Modules (sin bundler, sin framework) |
| IA | Groq API (Llama 3.1-8b-instant) vía Supabase Edge Function |
| Base de datos | Supabase (Postgres + RLS) |
| Autenticación | Firebase Auth (Google + Email/Password) |
| Deploy | GitHub Pages + GitHub Actions |

---

## Estructura del proyecto

```
EstudioIA/
├── index.html                          # Entrada principal (HTML + CSS)
├── src/
│   ├── config.js                       # Estado global y config de Supabase
│   ├── ramos.js                        # Los 6 tutores especializados
│   ├── api.js                          # callLLM() + Supabase REST
│   ├── auth.js                         # Firebase auth
│   ├── ui.js                           # DOM helpers y formateo
│   ├── chat.js                         # Lógica de conversación
│   └── main.js                         # Punto de entrada
├── supabase/
│   ├── schema.sql                      # Tablas + RLS
│   └── functions/groq-proxy/index.ts   # Proxy seguro para Groq API
├── screenshots/                        # Capturas para el README
├── .github/workflows/deploy.yml        # CI/CD a GitHub Pages
└── DEPLOYMENT.md                       # Runbook operativo completo
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

Para activar el tutor IA real localmente, necesitas la Edge Function de Supabase desplegada. Ver `DEPLOYMENT.md`.

---

## Roadmap

- [x] 6 tutores especializados con system prompts por dominio
- [x] Proxy seguro para Groq API (key nunca en el cliente)
- [x] Historial de conversaciones agrupado por sesión
- [x] Formateo de código y Markdown en el chat
- [x] Modo demo sin configuración
- [x] Arquitectura modular (6 módulos JS con responsabilidad única)
- [x] Deploy automático con GitHub Actions
- [ ] Persistencia de sesión entre visitas (IndexedDB)
- [ ] Soporte para más modelos (Mixtral, Gemma)
- [ ] Exportar conversación como PDF
- [ ] Modo "examen" — el tutor hace preguntas en vez de responderlas

---

## Licencia

MIT — proyecto educativo / portafolio.
