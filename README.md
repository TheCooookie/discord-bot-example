# Starter

Look at the [DiscordJS documentation](https://discord.js.org/docs/packages/discord.js/14.22.1).

## Setup

The bot uses the privileged **Server Members Intent**. Enable it in the [Discord Developer Portal](https://discord.com/developers/applications) under Bot → Privileged Gateway Intents, or the bot exits at login with "Used disallowed intents".

Make sure to install the dependencies:

```bash
# npm
pnpm install
```

## Development Server


Start the development server on:

```bash
# npm
pnpm run dev
```

## Production

Deploy commands when building for production:

Set `DISCORD_TOKEN`, `CLIENT_ID` and `GUILD_ID` in your `.env` file (see `.env.exemple`).

```bash
# npm
pnpm run deploy
```

Build the application when building for production:

```bash
# pnpm
pnpm run build
```
