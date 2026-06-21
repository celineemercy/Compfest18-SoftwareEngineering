FROM node:22-alpine

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --workspace apps/api

# Copy API source and Prisma schema
COPY apps/api apps/api

EXPOSE 3000

# Run pending migrations then start the dev server
CMD sh -c "npx --prefix apps/api prisma migrate deploy && npm run dev:api"
