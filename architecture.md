# Guía de Arquitectura y Extensión - JobAuto 🌐

Este documento detalla la estructura técnica de **JobAuto** y sirve de manual de referencia para añadir nuevas funciones, scrapers o desplegar el sistema en la nube (producción / multiusuario).

---

## 1. Estructura General del Proyecto

```
jobauto/
├── dashboard/          → Aplicación React (Vite)
│   ├── src/
│   │   ├── App.jsx     → Dashboard principal, interfaz Kanban y modales de IA
│   │   └── index.css   → Estilos y diseño general (tema oscuro)
│   └── package.json
│
├── extension/          → Extensión de Google Chrome
│   ├── manifest.json   → Permisos y configuración de la extensión
│   ├── popup.html/js   → Ajuste de modo y URL del servidor de API
│   └── content.js      → Scrapers e inyección visual en portales de empleo
│
├── server/             → Servidor backend Express (Node.js)
│   ├── data.json       → Almacenamiento local del modo single-user
│   ├── db.js           → Enrutador y abstracción de Base de Datos
│   ├── db/
│   │   └── jsonAdapter.js → Adaptador para persistir en archivos planos JSON
│   ├── ai.js           → Conexión con LLMs (Gemini, Groq, Ollama) y prompts
│   └── server.js       → Endpoints API y temporizadores en segundo plano
```

---

## 2. Cómo añadir un nuevo Scraper en la Extensión

Para soportar un nuevo portal de empleo o proyectos freelance (ej. *Malt* o *FlexJobs*):

1. **Añadir el host en `manifest.json`**:
   Asegúrate de que la URL esté listada bajo `content_scripts` -> `matches` para que se ejecute en esa página.
2. **Modificar `extension/content.js`**:
   - En la función `scrapeJobData()`, añade un bloque condicional `else if (url.includes('tupagina.com'))`.
   - Utiliza selectores DOM estándar (`document.querySelector`) para extraer:
     - `title` (Título del puesto o proyecto).
     - `company` (Nombre de la empresa o cliente).
     - `description` (Cuerpo de texto con requisitos).
     - `budget` (Presupuesto, opcional para freelance).
   - Asigna un nombre a la plataforma en el bloque final para la visualización del Kanban:
     ```js
     if (host.includes('tupagina')) platform = 'TuPagina';
     ```

---

## 3. Cómo Extender la Base de Datos (Cloud / Multiusuario Ready)

El archivo `server/db.js` está estructurado bajo el **Patrón Adapter**. Si deseas pasar de un almacenamiento local de un único archivo JSON a una base de datos de producción (como MongoDB o PostgreSQL):

1. **Crear el Adaptador en `server/db/`**:
   Crea un archivo `server/db/mongoAdapter.js` que implemente la misma interfaz de funciones asíncronas de base de datos que `jsonAdapter.js` (ej. `getProposals`, `addApplication`, etc.).
2. **Modificar el router `server/db.js`**:
   Lee la variable de entorno y asocia el adaptador correspondiente:
   ```js
   import { jsonAdapter } from './db/jsonAdapter.js';
   import { mongoAdapter } from './db/mongoAdapter.js';

   const dbType = process.env.DATABASE_TYPE || 'json';
   const adapter = dbType === 'mongodb' ? mongoAdapter : jsonAdapter;
   ```

---

## 4. Guía de Despliegue en la Nube (Producción SaaS)

### A. Despliegue mediante Contenedor Docker
Puedes alojar JobAuto de forma automática y aislada en cualquier plataforma de nube compatible con Docker:

1. **Construir y Probar la Imagen Localmente**:
   ```bash
   # Construir imagen docker
   docker build -t jobauto-app .

   # Ejecutar contenedor localmente expuesto en puerto 3000
   docker run -p 3000:3000 -e GEMINI_API_KEY="tu_key" -e JWT_SECRET="un_secreto_largo" jobauto-app
   ```

2. **Variables de Entorno Indispensables en Producción**:
   - `PORT`: El puerto de escucha (normalmente `3000` o asignado dinámicamente por la nube).
   - `JWT_SECRET`: Llave de firma de sesiones (ej. genera una cadena aleatoria segura).
   - `GEMINI_API_KEY` o `GROQ_API_KEY` (dependiendo de tu IA favorita).

### B. Despliegue Directo en Render (Gratuito y Sencillo)
1. Crea una cuenta en [Render.com](https://render.com).
2. Crea un **New Web Service** y conecta tu repositorio Git.
3. Configura las siguientes propiedades en Render:
   - **Environment**: Selecciona `Docker` (Render detectará tu `Dockerfile` raíz automáticamente).
   - **Branch**: Selecciona `main` o tu rama principal.
4. En la pestaña **Environment**, añade tus variables de entorno (`GEMINI_API_KEY`, `JWT_SECRET`).
5. Haz clic en **Create Web Service**. Tu aplicación se compilará y desplegará en pocos minutos.

### C. Despliegue en Google Cloud Run (Premium y Escalable)
1. Asegúrate de tener instalado el CLI de Google Cloud (`gcloud`).
2. Sube y despliega el contenedor con un solo comando:
   ```bash
   gcloud run deploy jobauto-app --source . --platform managed --allow-unauthenticated
   ```
3. Configura tus variables de entorno durante el asistente de terminal o desde la consola de Google Cloud.

### D. Conectar la Extensión de Chrome al Servidor Desplegado
Una vez desplegado tu servidor (ej. `https://jobauto-backend.onrender.com`):
1. Abre el menú emergente (Popup) de tu extensión de Chrome haciendo clic en su icono.
2. En el campo **Servidor URL (Cloud/Local)** escribe `https://jobauto-backend.onrender.com` y pulsa **Guardar Ajuste**.
3. El indicador debería cambiar a verde **Conectado**. A partir de ese momento, la extensión enviará de manera segura todos tus proyectos extraídos al servidor en la nube.

