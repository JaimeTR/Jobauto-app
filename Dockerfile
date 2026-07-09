# --- ETAPA 1: Compilación de Frontend (React) ---
FROM node:20-alpine AS builder

WORKDIR /app/dashboard

# Copiar configuración e instalar dependencias del dashboard
COPY dashboard/package*.json ./
RUN npm install

# Copiar el código fuente del dashboard
COPY dashboard/ ./

# Copiar la estructura del servidor temporalmente para que Vite pueda compilar hacia ../server/public
COPY server/ ../server/

# Compilar frontend
RUN npm run build


# --- ETAPA 2: Servidor Backend (Express de Producción) ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copiar dependencias de backend
COPY server/package*.json ./
RUN npm install --omit=dev

# Copiar el código fuente de backend y la SPA compilada desde el builder
COPY server/ ./
COPY --from=builder /app/server/public ./public/

EXPOSE 3000

CMD ["node", "server.js"]
