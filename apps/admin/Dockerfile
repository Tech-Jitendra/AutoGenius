FROM node:22-alpine AS base
WORKDIR /srv/app

# Build context: repository root. Build with: docker build -f apps/admin/Dockerfile .

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/admin/package.json apps/admin/
COPY packages/types/package.json packages/types/
COPY packages/constants/package.json packages/constants/
COPY packages/validation/package.json packages/validation/
RUN npm ci --workspace @autogenius/admin --include-workspace-root=false || npm install

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/admin ./apps/admin
RUN npm run build -w @autogenius/types -w @autogenius/constants -w @autogenius/validation \
 && npm run build -w @autogenius/admin

FROM base AS prod
ENV NODE_ENV=production
COPY --from=deps /srv/app/node_modules ./node_modules
COPY --from=build /srv/app/packages ./packages
COPY --from=build /srv/app/apps/admin ./apps/admin
EXPOSE 3002
CMD ["npm", "run", "start", "-w", "@autogenius/admin", "--", "-p", "3002"]
