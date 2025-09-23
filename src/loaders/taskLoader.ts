import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'discord.js';

type PluginInitializer = (client: Client) => void | Promise<void>;

/**
 * @async
 * @function loadTasks
 * @description Asynchronously loads and initializes all task files (plugins) from the '../tasks' directory.
 * Each task file is expected to have a default export that is a function of type `PluginInitializer`.
 * @param {Client} client The Discord.js client instance to pass to each task's initializer.
 * @returns {Promise<void>} A promise that resolves once all tasks have been attempted to load.
 */
export async function loadTasks(client: Client): Promise<void> {
    const pluginsPath = path.join(__dirname, '..', 'tasks');
    console.log(`[TASKS] Looking for taksks in: ${pluginsPath}`);

    if (!fs.existsSync(pluginsPath)) {
        console.warn(`[TASKS] Directory not found: ${pluginsPath}. No taksks will be loaded.`);
        return;
    }

    const pluginFiles = fs.readdirSync(pluginsPath)
        .filter(file => (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts'));

    for (const file of pluginFiles) {
        const filePath = path.join(pluginsPath, file);
        try {
            const pluginModule = await import(filePath);
            const initialize: PluginInitializer | undefined = pluginModule.default;

            if (typeof initialize === 'function') {
                await initialize(client); // Await in case the plugin init is async
                console.log(`[TASKS] Initialized taks: ${file}`);
            } else {
                console.warn(`[TASKS][WARN] The taks at ${filePath} does not have a valid default export function.`);
            }
        } catch (error) {
            console.error(`[TASKS][ERROR] Failed to load or initialize taks at ${filePath}:`, error);
        }
    }
}