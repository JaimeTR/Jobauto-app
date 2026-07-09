# JobAuto - Automatizacion de Postulaciones con IA

Plataforma todo en uno para automatizar tu busqueda de empleo y propuestas freelance con inteligencia artificial.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-19-61dafb)](https://react.dev)

---

## Que hace JobAuto

| Funcion | Descripcion |
|---|---|
| **Dashboard Kanban** | Tablero drag-drop para seguir postulaciones y propuestas |
| **Extension Chrome** | Extrae ofertas de 11+ portales con un clic |
| **IA Generativa** | Cartas de presentacion, CVs adaptados, guias de entrevista |
| **RSS Monitor** | Escanea feeds RSS cada 15 min y evalua compatibilidad |
| **Doble modo** | Modo Empleo (job) y modo Freelance con metricas separadas |
| **2FA Email** | Autenticacion con codigo OTP por correo |

---

## Arquitectura

```
jobauto/
├── server/          # Backend Express + Node.js
│   ├── ai.js        # LLMs: Gemini, Groq, Ollama
│   ├── db/          # Adaptadores: JSON (local) + MongoDB (cloud)
│   ├── services/    # Email SMTP + RSS Listener
│   └── utils/       # JWT + Auth
├── dashboard/       # Frontend React 19 + Vite
│   └── src/
│       ├── App.jsx           # Kanban, modales IA, settings
│       └── OnboardingWizard.jsx
└── extension/       # Chrome Extension MV3
    ├── content.js   # Scrapers para 11+ portales
    └── popup.js     # UI de control y conexion al servidor
```

---

## Instalacion Rapida

### Requisitos

- Node.js >= 20
- API Key de [Google Gemini](https://aistudio.google.com) (gratis)

### Backend

```bash
cd server
cp .env.example .env          # Configura tus claves API
npm install
npm start                     # http://localhost:3000
```

### Dashboard (desarrollo)

```bash
cd dashboard
npm install
npm run dev                   # http://localhost:5173
```

### Extension Chrome

1. Abri `chrome://extensions`
2. Activa **Modo Desarrollador**
3. Clic en **Cargar extension sin empaquetar**
4. Selecciona la carpeta `extension/`

---

## Variables de Entorno

Copia `server/.env.example` a `server/.env` y completa:

```env
# Servidor
PORT=3000
JWT_SECRET=genera_uno_seguro
NODE_ENV=development
CORS_ORIGIN=*

# Base de datos: 'json' (local) o 'mongodb' (nube)
DATABASE_TYPE=json
MONGODB_URI=mongodb+srv://...

# IA (al menos una es obligatoria)
GEMINI_API_KEY=tu_key_de_gemini
GROQ_API_KEY=tu_key_de_groq     # opcional

# Email (para verificacion 2FA)
SMTP_HOST=smtp.tuproveedor.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tu@email.com
SMTP_PASS=tu_password
```

---

## Portales Soportados por la Extension

| Plataforma | Tipo |
|---|---|
| LinkedIn | Empleo |
| Indeed | Empleo |
| InfoJobs | Empleo |
| Computrabajo | Empleo |
| Bumeran | Empleo |
| GetOnBoard | Empleo |
| Freelancer.com | Freelance |
| Workana | Freelance |
| Upwork | Freelance |
| Guru | Freelance |
| Fiverr | Freelance |

---

## Endpoints API

### Auth
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/auth/register` | Solicitar registro (envia OTP) |
| POST | `/api/auth/verify` | Verificar OTP y crear cuenta |
| POST | `/api/auth/login` | Iniciar sesion (envia OTP 2FA) |
| POST | `/api/auth/verify-login` | Verificar OTP de login |

### Perfil
| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/profile/job` | Obtener perfil empleo |
| PUT | `/api/profile/job` | Actualizar perfil empleo |
| GET | `/api/profile/freelance` | Obtener perfil freelance |
| PUT | `/api/profile/freelance` | Actualizar perfil freelance |
| POST | `/api/profile/extract-cv` | Subir y analizar CV con IA |

### Postulaciones (Job)
| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/applications` | Listar postulaciones |
| POST | `/api/applications` | Agregar postulacion |
| PUT | `/api/applications/:id` | Actualizar postulacion |
| DELETE | `/api/applications/:id` | Eliminar postulacion |
| POST | `/api/applications/:id/tailor` | Generar materiales IA |
| POST | `/api/applications/:id/interview-prep` | Generar guia entrevista |

### Propuestas (Freelance)
| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/freelance/proposals` | Listar propuestas |
| POST | `/api/freelance/proposals` | Agregar propuesta |
| PUT | `/api/freelance/proposals/:id` | Actualizar propuesta |
| DELETE | `/api/freelance/proposals/:id` | Eliminar propuesta |
| POST | `/api/freelance/proposals/:id/tailor` | Generar pitch IA |
| POST | `/api/freelance/proposals/:id/interview-prep` | Guia reunion |
| POST | `/api/freelance/proposals/:id/follow-up` | Mensaje seguimiento |
| POST | `/api/freelance/generate-bio` | Optimizar bio de perfil |

---

## Despliegue

### Docker

```bash
docker build -t jobauto-app .
docker run -p 3000:3000 \
  -e GEMINI_API_KEY="tu_key" \
  -e JWT_SECRET="secreto_largo" \
  jobauto-app
```

### Hostinger

1. Conecta el repo en **Hostinger Panel > Git**
2. Entry point: `server/server.js`
3. Variables de entorno en el panel con `NODE_ENV=production`
4. Para hosting compartido, usa el `.htaccess` incluido

### Render / Railway / Fly.io

El `Dockerfile` en la raiz es detectado automaticamente por estas plataformas.

---

## Stack Tecnologico

**Frontend:** React 19, Vite 8, Lucide Icons
**Backend:** Express 4, Node 20+
**IA:** Google Gemini 1.5 Flash, Groq Llama 3.1, Ollama (local)
**Base de datos:** JSON (dev) / MongoDB Atlas (produccion)
**Email:** Nodemailer con SMTP (Titan Email)
**DevOps:** Docker multi-stage, GitHub Actions (pendiente)

---

## Roadmap

- [x] Kanban drag-drop con columnas
- [x] Scrapers para 11+ portales
- [x] Cartas y CVs con IA
- [x] Guias de entrevista con IA
- [x] RSS feed monitor
- [x] Adaptador MongoDB
- [x] Docker listo para produccion
- [ ] Tests automatizados
- [ ] CI/CD con GitHub Actions
- [ ] Pagos integrados (Stripe)
- [ ] App movil (PWA)

---

Hecho con [React](https://react.dev) + [Express](https://expressjs.com) + [Gemini](https://aistudio.google.com)
