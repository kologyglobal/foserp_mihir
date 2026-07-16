# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
ENV CRM_UPLOAD_DIR=/data/uploads

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm install prisma@6.9.0 tsx@4.19.4 dotenv@16.5.0 --omit=dev --no-save \
  && npm cache clean --force

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY scripts/prisma-cli.ts ./scripts/prisma-cli.ts
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

RUN chmod +x ./scripts/docker-entrypoint.sh \
  && mkdir -p /data/uploads

EXPOSE 5000
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
