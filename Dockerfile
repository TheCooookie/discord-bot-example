FROM node:24-alpine

# Installs the pnpm version pinned in package.json "packageManager".
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build && pnpm prune --prod

USER node

# node directly, not pnpm, so stop signals reach the bot.
CMD ["node", "dist/bot.js"]
