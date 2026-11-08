# -------- Stage 1: install production dependencies --------
FROM node:22-alpine AS deps
WORKDIR /app

# Copy manifests first so Docker can cache this layer when deps don't change
COPY package.json package-lock.json ./

# Only production deps — jest, nodemon, newman etc. are not needed at runtime
RUN npm ci --omit=dev && npm cache clean --force


# -------- Stage 2: runtime image --------
FROM node:22-alpine AS runtime

# Run as a non-root user (security best practice)
RUN addgroup -S hustle && adduser -S hustle -G hustle

WORKDIR /app

# Bring in the installed production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the application source
COPY --chown=hustle:hustle . .

# Expose the HTTP port the container will listen on
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

USER hustle

# Healthcheck: hit the root route the API exposes
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/ || exit 1

CMD ["node", "server.js"]