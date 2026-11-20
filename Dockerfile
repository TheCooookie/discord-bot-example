FROM node:26-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Installs the pnpm version pinned in package.json "packageManager" (Node 25+ ships no corepack).
RUN npm install -g "$(node -p "require('./package.json').packageManager")"
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build && pnpm prune --prod

USER node

# node directly, not pnpm, so stop signals reach the bot. Env comes from docker-compose, not .env.
CMD ["node", "dist/bot.js"]
