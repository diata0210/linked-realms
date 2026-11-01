# G1 local test image. No external services or private repository inputs.
FROM node:26.12.1-alpine3.24
RUN npm install -g pnpm@11.3.0
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node . .
RUN pnpm install --frozen-lockfile --filter @linked-realms/map-server...
ENV NODE_ENV=development
CMD ["node", "packages/map-server/src/main.ts"]
