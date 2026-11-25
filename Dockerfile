FROM node:22-bookworm-slim AS ui
WORKDIR /ui
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
RUN npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend .
COPY models /app/models
COPY --from=ui /ui/dist /app/frontend/dist
RUN mkdir -p /app/data
ENV PORT=8000 DATABASE_PATH=/app/data/neuroscan.db
EXPOSE 8000
CMD ["node","server.js"]
