# discord-bot-exemple

A small TypeScript starter for a [discord.js v14](https://discord.js.org/docs/packages/discord.js/main) bot. Copy it, add your commands, run it.

## Setup

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.exemple` to `.env` and fill it in:

   | Variable | Required | What it is |
   |---|---|---|
   | `DISCORD_TOKEN` | yes | Bot token from the [Developer Portal](https://discord.com/developers/applications) |
   | `GUILD_ID` | no | Server id for instant command updates. Empty: commands register globally (up to an hour) |
   | `REDIS_HOST` | no | Redis host. Empty: the bot runs without Redis. Set: the bot pings it at startup and stops if it is unreachable |
   | `REDIS_PORT`, `REDIS_PASSWORD` | no | Redis port (default 6379) and password, if any |
   | `DATABASE_URL` | no | Postgres URL, only if you enable the database (see below) |

3. Start the dev server (restarts on file changes):

   ```bash
   pnpm run dev
   ```

Slash commands are registered with Discord automatically every time the bot starts.

## Adding things

Every file in these folders is loaded on start. A broken file is logged and skipped. Files ending in `.test.ts` are ignored.

**A command:** `src/commands/<name>.ts`, default-export a `BotCommand`. `ping.ts` is the minimal one; `announce.ts` shows options, autocomplete, a permission gate and a button.

**A button, select menu or modal:** `src/components/<name>.ts`, default-export a `BotComponent`. It handles every `customId` equal to its own or starting with `<customId>:`, so `announce` handles `announce:ack` (see `src/components/announce.ts`). Put extra data after the colon, e.g. `poll:vote:42`.

**A plugin** (event listeners): `src/plugins/<name>.ts`.

```ts
import { Client, Events } from 'discord.js';

export default (client: Client) => {
    client.on(Events.GuildCreate, guild => console.log(`Joined ${guild.name}`));
};
```

**A task** (runs on an interval): `src/tasks/<name>.ts`.

```ts
import { Client } from 'discord.js';
import taskRunner from '../utils/task';

export default (client: Client) => {
    taskRunner.scheduleTask('heartbeat', 60_000, () => console.log(`${client.guilds.cache.size} servers`));
};
```

**Need more events?** The bot only asks for the `Guilds` intent. Add intents in `src/bot.ts`. Privileged ones (`GuildMembers`, `GuildPresences`, `MessageContent`) must also be switched on in the Developer Portal under Bot → Privileged Gateway Intents.

**Postgres?** Set `DATABASE_URL` and call `connectToDatabase()` from `src/data/database.ts` in `initializeApp()` in `src/bot.ts`.

**Many Discord calls at once?** `processInBatches` in `src/utils/batch.ts` helps stay under the rate limits.

## Checks

```bash
pnpm typecheck
pnpm test
```

GitHub Actions runs both, plus the build, on every push (`.github/workflows/ci.yml`).

## Production

```bash
pnpm run build
pnpm start
```

Or with Docker, which also starts Redis:

```bash
docker compose up -d --build
```
