import { Client } from 'discord.js';
import { BotCommand, BotComponent } from '../types/discord';
import { listModules } from './pluginLoader';

/** Imports every file in src/<folder> and returns the default exports that pass `isValid`. Bad files are logged and skipped. */
async function loadValid<T>(folder: string, label: string, isValid: (value: any) => value is T, shape: string): Promise<T[]> {
    const loaded: T[] = [];
    for (const filePath of listModules(folder, label)) {
        try {
            // require, not import(): tsx keeps import() as ESM, which rejects Windows paths like C:\...
            const module = require(filePath);
            const value = module.default || module;
            if (isValid(value)) {
                loaded.push(value);
            } else {
                console.warn(`[${label}][WARN] ${filePath} must default-export ${shape}.`);
            }
        } catch (error) {
            console.error(`[${label}][ERROR] Failed to load ${filePath}:`, error);
        }
    }
    return loaded;
}

/** Loads every file in src/commands into `client.commands`. */
export async function loadCommands(client: Client) {
    const commands = await loadValid('commands', 'CMDS',
        (c): c is BotCommand => !!c?.data && typeof c.execute === 'function',
        'a "data" property and an "execute" function');
    for (const command of commands) {
        if (client.commands.has(command.data.name)) {
            console.warn(`[CMDS][WARN] Duplicate command name '${command.data.name}'. It will be overwritten.`);
        }
        client.commands.set(command.data.name, command);
        console.log(`[CMDS] Loaded command: ${command.data.name}`);
    }
}

/** Loads every file in src/components into `client.components`. */
export async function loadComponents(client: Client) {
    const components = await loadValid('components', 'COMPONENTS',
        (c): c is BotComponent => typeof c?.customId === 'string' && typeof c.execute === 'function',
        'a "customId" string and an "execute" function');
    for (const component of components) {
        if (client.components.has(component.customId)) {
            console.warn(`[COMPONENTS][WARN] Duplicate customId '${component.customId}'. It will be overwritten.`);
        }
        client.components.set(component.customId, component);
        console.log(`[COMPONENTS] Loaded component: ${component.customId}`);
    }
}
