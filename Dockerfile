FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN npm ci --ignore-scripts
COPY . .
RUN npm run db:generate && npm run build
ENV NODE_ENV=production DACOS_MODE=operational API_HOST=0.0.0.0 API_PORT=3001
USER node
EXPOSE 3001
CMD ["node", "backend/src/server.js"]
