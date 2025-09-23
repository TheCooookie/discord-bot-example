/**
 * Processes an array of items in batches with an optional delay between batches.
 * This is useful for rate-limiting operations or managing resource consumption.
 * * @template T The type of items in the array.
 * @param {T[]} items The array of items to process.
 * @param {number} batchSize The maximum number of items to process in a single batch.
 * @param {number} delayMs The delay in milliseconds to wait after processing each batch (except the last one).
 * @param {(item: T) => Promise<void>} handler The asynchronous function to call for each item.
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