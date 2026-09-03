# ============================================================================
# Painel de Crédito PJ — imagem de produção
#
# Build em dois estágios: o Node compila o bundle, o nginx serve os estáticos.
# A imagem final não carrega Node nem node_modules.
# ============================================================================

# ---------- Estágio 1: build ----------
FROM node:22-alpine AS build

WORKDIR /app

# O package.json referencia o xlsx pela distribuição oficial da SheetJS
# (https://cdn.sheetjs.com), porque a versão publicada no npm tem falhas sem
# correção. O build precisa de saída para esse host.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# As variáveis VITE_* são embutidas no bundle em tempo de build — não são lidas
# em runtime. Por isso entram como build args, e não como env do container.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

RUN npm run build

# ---------- Estágio 2: runtime ----------
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# O nginx do Alpine já roda o worker como usuário sem privilégio.
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
