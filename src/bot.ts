import 'dotenv/config'; // must stay first: later imports (e.g. data/redis) read process.env when loaded
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

client.once(Events.ClientReady, async c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);

    // Register the loaded slash commands with Discord on every start (replaces the old deploy script).
    // With GUILD_ID: guild commands, which update instantly. Without: global commands.
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

/**
 * Event handler for interaction creation, specifically for chat input commands (slash commands).
 * It attempts to find and execute the corresponding command.
 * @param {ChatInputCommandInteraction} interaction The interaction object received from Discord.
 */ 
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
        // The reply itself can fail (e.g. interaction expired); an uncaught rejection here would kill the process.
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error executing this command!', flags: MessageFlags.Ephemeral }).catch(console.error);
        } else {
            await interaction.reply({ content: 'There was an error executing this command!', flags: MessageFlags.Ephemeral }).catch(console.error);
        }
    }
});

/**
 * Asynchronously initializes the application by:
 * 1. Testing the connection to Redis (add connectToDatabase() from ./data/database here if you use Postgres).
 * 2. Loading Discord slash commands.
 * 3. Loading bot plugins.
 * 4. Loading scheduled tasks.
 * 5. Logging the bot into Discord.
 * If any step fails, it logs an error and exits the process.
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