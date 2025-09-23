import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'discord.js';

type PluginInitializer = (client: Client) => void | Promise<void>;

/**
 * @async
 * @function loadPlugins
 * @description Discovers, loads, and initializes all plugin files from the '../plugins' directory.
 * Each file in this directory is expected to be a plugin with a `default` export that is a
 * function adhering to the `PluginInitializer` type. These functions are then called with the
 * Discord.js client instance, allowing plugins to set up event listeners, commands, or other functionalities.
 * @param {Client} client The Discord.js client instance that will be passed to each plugin's initializer.
 * @returns {Promise<void>} A Promise that resolves once all eligible plugin files have been processed,
 * regardless of whether their initialization was successful or encountered an error.
 */
export async function loadPlugins(client: Client): Promise<void> {
    const pluginsPath = path.join(__dirname, '..', 'plugins');
    console.log(`[PLUGINS] Looking for plugins in: ${pluginsPath}`);

    if (!fs.existsSync(pluginsPath)) {
        console.warn(`[PLUGINS] Directory not found: ${pluginsPath}. No plugins will be loaded.`);
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
                console.log(`[PLUGINS] Initialized plugin: ${file}`);
            } else {
                console.warn(`[PLUGINS][WARN] The plugin at ${filePath} does not have a valid default export function.`);
            }
        } catch (error) {
            console.error(`[PLUGINS][ERROR] Failed to load or initialize plugin at ${filePath}:`, error);
        }
    }
}