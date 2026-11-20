import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'discord.js';

type Initializer = (client: Client) => void | Promise<void>;

/** Paths of the loadable .ts/.js files in src/<folder>, or [] (with a warning) if the folder is missing. */
export function listModules(folder: string, label: string): string[] {
    const dirPath = path.join(__dirname, '..', folder);
    console.log(`[${label}] Looking in: ${dirPath}`);

    if (!fs.existsSync(dirPath)) {
        console.warn(`[${label}] Directory not found: ${dirPath}. Nothing will be loaded.`);
        return [];
    }

    return fs.readdirSync(dirPath)
        .filter(file => /\.(ts|js)$/.test(file) && !file.endsWith('.d.ts') && !/\.test\.(ts|js)$/.test(file))
        .map(file => path.join(dirPath, file));
}

/**
 * Loads every file in src/<folder> (e.g. 'plugins', 'tasks') and calls its default export with the client.
 * Bad files are logged and skipped.
 */
export async function loadInitializers(client: Client, folder: string, label: string): Promise<void> {
    for (const filePath of listModules(folder, label)) {
        const file = path.basename(filePath);
        try {
            // require, not import(): tsx keeps import() as ESM, which rejects Windows paths like C:\...
            const module = require(filePath);
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
