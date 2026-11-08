FROM node:24-alpine

RUN npm install -g pnpm@12.18.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build && pnpm prune --prod

USER node

CMD ["pnpm", "start"]
