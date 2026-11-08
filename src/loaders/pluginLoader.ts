import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'discord.js';

type Initializer = (client: Client) => void | Promise<void>;

/**
 * Loads every file in src/<folder> (e.g. 'plugins', 'tasks') and calls its default export with the client.
 * Bad files are logged and skipped.
 */
export async function loadInitializers(client: Client, folder: string, label: string): Promise<void> {
    const dirPath = path.join(__dirname, '..', folder);
    console.log(`[${label}] Looking in: ${dirPath}`);

    if (!fs.existsSync(dirPath)) {
        console.warn(`[${label}] Directory not found: ${dirPath}. Nothing will be loaded.`);
        return;
    }

    const files = fs.readdirSync(dirPath)
        .filter(file => (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts'));

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
            const module = await import(filePath);
            const initialize: Initializer | undefined = module.default;

            if (typeof initialize === 'function') {
                await initialize(client);
                console.log(`[${label}] Initialized: ${file}`);
            } else {
                console.warn(`[${label}][WARN] ${filePath} does not have a valid default export function.`);
            }
        } catch (error) {
            console.error(`[${label}][ERROR] Failed to load or initialize ${filePath}:`, error);
        }
    }
}
