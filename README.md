# discord-bot-exemple

A small TypeScript starter for a [discord.js v14](https://discord.js.org/docs/packages/discord.js/main) bot. Copy it, add your commands, run it.

## After you copy this

1. Rename `name` (and `description`) in `package.json`.
2. Fill in `.env` (see Setup).
3. Keep `/announce` and its button as a reference, or delete `src/commands/announce.ts` and `src/components/announce.ts`.

Needs Node 26+ and pnpm (the version is pinned in `package.json`).

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

**Postgres?** Set `DATABASE_URL` and call `connectToDatabase()` from `src/data/database.ts` in `initializeApp()` in `src/bot.ts`. Query with the exported `pg` pool and always pass values as parameters: `pool.query('SELECT * FROM t WHERE guild_id = $1', [guildId])`. Want an ORM? Swap in Drizzle or Prisma.

**Many Discord calls at once?** `processInBatches` in `src/utils/batch.ts` helps stay under the rate limits.

## Scaling

The bot is built for many servers. Commands register globally when `GUILD_ID` is empty, and it uses `shards: 'auto'`: discord.js opens as many shards (gateway connections) as Discord asks for, all in one process. Discord requires sharding from 2,500 servers; this handles it with no code change, and one process copes with a few tens of thousands of servers.

Past that, move to one process per shard with discord.js's `ShardingManager`. Then:

- **Register commands from one place:** only shard 0, or a separate deploy script. Today every `ClientReady` would send them.
- **Run tasks once:** only on shard 0, or behind a Redis lock. Otherwise each process runs them.
- **Counts are per shard:** `client.guilds.cache.size` only sees that shard's servers. Use `client.shard.fetchClientValues('guilds.cache.size')` for totals.
- **Share state through Redis:** memory is per process.

Store anything per server (settings, counters) by guild id, e.g. Redis key `guild:<id>:settings`, so it works the same at any size.

## Checks

```bash
pnpm typecheck
pnpm test
```

GitHub Actions runs both, plus the build, on every push (`.github/workflows/ci.yml`). Dependabot opens weekly PRs to keep dependencies current (`.github/dependabot.yml`).

## Production

```bash
pnpm run build
pnpm start
```

Or with Docker, which also starts Redis:

```bash
docker compose up -d --build
```
