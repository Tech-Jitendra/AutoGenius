FROM node:22-alpine AS base
WORKDIR /srv/app

# Build context: repository root. Build with: docker build -f apps/api/Dockerfile .

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/constants/package.json packages/constants/
COPY packages/validation/package.json packages/validation/
RUN npm ci --workspace @autogenius/api --include-workspace-root=false || npm install

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm run build -w @autogenius/types -w @autogenius/constants -w @autogenius/validation \
 && npm run build -w @autogenius/api

FROM base AS prod
ENV NODE_ENV=production
COPY --from=deps /srv/app/node_modules ./node_modules
COPY --from=build /srv/app/packages ./packages
COPY --from=build /srv/app/apps/api/dist ./apps/api/dist
COPY --from=build /srv/app/apps/api/package.json ./apps/api/package.json
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
