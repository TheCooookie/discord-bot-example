/**
 * Runs `handler` on `items`, `batchSize` at a time, waiting `delayMs` between batches.
 * Useful to stay under Discord rate limits.
 */
export async function processInBatches<T>(
    items: T[],
    batchSize: number,
    delayMs: number,
    handler: (item: T) => Promise<void>
) {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map(handler));
        if (i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}
