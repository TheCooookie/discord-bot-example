import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'discord.js';
import { BotCommand } from '../types/discord';

/** Loads every file in src/commands into `client.commands`. Bad files are logged and skipped. */
export async function loadCommands(client: Client) {
    const commandsPath = path.join(__dirname, '..', 'commands');
    console.log(`[CMDS] Looking for commands in: ${commandsPath}`);

    if (!fs.existsSync(commandsPath)) {
        console.warn(`[CMDS] Directory not found: ${commandsPath}. No commands will be loaded.`);
        return;
    }

    const commandFiles = fs.readdirSync(commandsPath)
        .filter(file => (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const commandModule = await import(filePath);
            const command: BotCommand | undefined = commandModule.default || commandModule;

            if (command && command.data && typeof command.execute === 'function') {
                if (client.commands.has(command.data.name)) {
                    console.warn(`[CMDS][WARN] Duplicate command name '${command.data.name}' from ${file}. It will be overwritten.`);
                }
                client.commands.set(command.data.name, command);
                console.log(`[CMDS] Loaded command: ${command.data.name} from ${file}`);
            } else {
                console.warn(`[CMDS][WARN] The command at ${filePath} is missing a required "data" property or "execute" function.`);
            }
        } catch (error) {
            console.error(`[CMDS][ERROR] Failed to load command at ${filePath}:`, error);
        }
    }
}
