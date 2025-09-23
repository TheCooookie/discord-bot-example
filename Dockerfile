FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile

COPY . .

RUN npm install --only=dev
RUN npm run build

CMD ["pnpm", "start"]