// Must stay the first import: modules below read process.env as soon as they load.
import 'dotenv/config';
import { Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import redisClient, { testRedisConnection } from './data/redis';
import { BotCommand, BotComponent } from './types/discord';
import { loadCommands, loadComponents } from './loaders/commandLoader';
import { loadInitializers } from './loaders/pluginLoader';
import taskRunner from './utils/task';
import { componentKey } from './utils/customId';

const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.error("Error: DISCORD_TOKEN is not set in the .env file.");
    process.exit(1);
}
// Slash commands only need Guilds. Add intents when a feature needs their events;
// privileged ones (GuildMembers, GuildPresences, MessageContent) must also be enabled in the Developer Portal.
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});
client.commands = new Collection<string, BotCommand>();
client.components = new Collection<string, BotComponent>();

// Registers the loaded slash commands with Discord on every start.
// GUILD_ID set: one server, updates instantly. Empty: global, can take up to an hour.
client.once(Events.ClientReady, async c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);

    const guildId = process.env.GUILD_ID;
    const body = client.commands.map(command => command.data.toJSON());
    try {
        await (guildId ? c.application.commands.set(body, guildId) : c.application.commands.set(body));
        console.log(`[DEPLOY] Registered ${body.length} command(s) ${guildId ? `for guild ${guildId}` : 'globally'}.`);
    } catch (error) {
        // Not fatal: commands registered on a previous start keep working.
        console.error('[DEPLOY][ERROR] Failed to register commands:', error);
    }
});

// Routes slash commands, autocomplete, buttons, select menus and modals, and tells the user if one fails.
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isAutocomplete()) {
        try {
            await client.commands.get(interaction.commandName)?.autocomplete?.(interaction);
        } catch (error) {
            console.error(`Error in autocomplete for ${interaction.commandName}:`, error);
        }
        return;
    }

    let name: string;
    let run: (() => Promise<void>) | undefined;
    if (interaction.isChatInputCommand()) {
        name = interaction.commandName;
        const command = client.commands.get(name);
        run = command && (() => command.execute(interaction));
    } else if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        name = componentKey(interaction.customId);
        const component = client.components.get(name);
        run = component && (() => component.execute(interaction));
    } else {
        return;
    }

    if (!run) {
        console.error(`No handler found for ${name}.`);
        await interaction.reply({ content: 'Nothing handles this anymore.', flags: MessageFlags.Ephemeral }).catch(console.error);
        return;
    }

    try {
        await run();
    } catch (error) {
        console.error(`Error executing ${name}:`, error);
        // The reply can fail too (e.g. expired interaction); left uncaught it would crash the bot.
        const reply = { content: 'There was an error executing this!', flags: MessageFlags.Ephemeral } as const;
        await (interaction.replied || interaction.deferred ? interaction.followUp(reply) : interaction.reply(reply)).catch(console.error);
    }
});

// Without a listener, a client 'error' event throws and kills the process.
client.on(Events.Error, error => console.error('[Client] Error:', error));
// Log a forgotten await/catch instead of crashing on it.
process.on('unhandledRejection', reason => console.error('[Process] Unhandled promise rejection:', reason));

// Docker stop and Ctrl+C: close connections so the bot goes offline at once instead of timing out.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, async () => {
        console.log(`${signal} received, shutting down.`);
        taskRunner.stopAllTasks();
        await client.destroy();
        await redisClient?.quit();
        process.exit(0);
    });
}

/**
 * Checks Redis, loads commands, components, plugins and tasks, then logs in.
 * Exits the process if any step fails.
 * Using Postgres? Add `connectToDatabase()` from ./data/database here.
 */
async function initializeApp() {
    try {
        await testRedisConnection();
        await loadCommands(client);
        await loadComponents(client);
        await loadInitializers(client, 'plugins', 'PLUGINS');
        await loadInitializers(client, 'tasks', 'TASKS');
        await client.login(token);
    } catch (error) {
        console.error("Failed to initialize bot:", error);
        process.exit(1);
    }
}

initializeApp();
