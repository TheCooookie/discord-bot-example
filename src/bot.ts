// Must stay the first import: modules below read process.env as soon as they load.
import 'dotenv/config';
import { Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { testRedisConnection } from './data/redis';
import { BotCommand } from './types/discord';
import { loadCommands } from './loaders/commandLoader';
import { loadInitializers } from './loaders/pluginLoader';

const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.error("Error: DISCORD_TOKEN is not set in the .env file.");
    process.exit(1);
}
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
    ],
});
client.commands = new Collection<string, BotCommand>();

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

// Runs the matching slash command and tells the user if it fails.
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        await interaction.reply({ content: `Command not found.`, flags: MessageFlags.Ephemeral }).catch(console.error);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        // The reply can fail too (e.g. expired interaction); left uncaught it would crash the bot.
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error executing this command!', flags: MessageFlags.Ephemeral }).catch(console.error);
        } else {
            await interaction.reply({ content: 'There was an error executing this command!', flags: MessageFlags.Ephemeral }).catch(console.error);
        }
    }
});

/**
 * Checks Redis, loads commands, plugins and tasks, then logs in.
 * Exits the process if any step fails.
 * Using Postgres? Add `connectToDatabase()` from ./data/database here.
 */
async function initializeApp() {
    try {
        await testRedisConnection();
        await loadCommands(client);
        await loadInitializers(client, 'plugins', 'PLUGINS');
        await loadInitializers(client, 'tasks', 'TASKS');
        await client.login(token);
    } catch (error) {
        console.error("Failed to initialize bot:", error);
        process.exit(1);
    }
}

initializeApp();
