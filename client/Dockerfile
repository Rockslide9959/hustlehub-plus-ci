# -------- Stage 1: build the Vite bundle --------
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies with a clean, reproducible lockfile install
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build the static bundle
COPY . .
RUN npm run build


# -------- Stage 2: serve with Nginx --------
FROM nginx:1.27-alpine AS runtime

# Replace the default Nginx config with our SPA + reverse-proxy config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy the built static assets into Nginx's web root
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx alpine already defines a non-root user; drop privileges where possible
# by binding to port 80 inside the container (compose maps it externally).
EXPOSE 80

# 127.0.0.1, not localhost: in Alpine, localhost resolves to IPv6 (::1) first,
# but Nginx only listens on IPv4 port 80, so a localhost check always fails.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]