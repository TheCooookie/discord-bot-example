import { Client, Collection, Events, Partials, GatewayIntentBits, MessageFlags } from 'discord.js';
import dotenv from 'dotenv';
import { testRedisConnection } from './data/data';
import { BotCommand } from './types/discord';
import { loadCommands } from './loaders/commandLoader';
import { loadPlugins } from './loaders/pluginLoader';
import { loadTasks } from './loaders/taskLoader';

dotenv.config();

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

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
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
 * 1. Testing connections to Redis and the database.
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
        await loadPlugins(client);
        await loadTasks(client);
        client.login(token);
    } catch (error) {
        console.error("Failed to initialize bot:", error);
        process.exit(1);
    }
}

initializeApp();