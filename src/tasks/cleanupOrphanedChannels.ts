import { Client, VoiceChannel, ChannelType } from 'discord.js';
import redisClient from '../data/redis';
import { TEMP_VOICE_PREFIX } from '../plugins/autovocal';
import { processInBatches } from '../utils/batch';
import taskRunner from '../utils/task';

/**
 * Cleans up all temporary voice channels created by autovocal.
 * For each channel registered in Redis (key: tempVoice:<channelId>):
 *   - If the channel exists on Discord and is empty, delete the channel and then delete the Redis key.
 *   - If the channel does not exist, just delete the Redis key.
 */
export async function cleanupOrphanedChannels(client: Client): Promise<void> {
    const keys = await redisClient.keys(`${TEMP_VOICE_PREFIX}*`);
    if (!keys.length) {
        console.log('[AutoVoice] No temporary voice channels found in Redis.');
        return;
    }

    await processInBatches(keys, 25, 2000, async key => {
        const channelId = key.substring(TEMP_VOICE_PREFIX.length);

        let foundChannel: VoiceChannel | null = null;
        for (const guild of client.guilds.cache.values()) {
            try {
                const channel = await guild.channels.fetch(channelId);
                if (channel && channel.type === ChannelType.GuildVoice) {
                    foundChannel = channel as VoiceChannel;
                    if (foundChannel) {
                        if (foundChannel.members.size === 0) {
                            try {
                                await foundChannel.delete('AutoVoice: Empty temporary channel cleanup.');
                                console.log(`[AutoVoice] Deleted empty temporary channel ${foundChannel.name} (${channelId})`);
                            } catch (err) {
                                console.warn(`[AutoVoice] Failed to delete channel ${channelId}:`, err);
                            }
                            await redisClient.del(key);
                            console.log(`[AutoVoice] Deleted Redis key for channel ${channelId}`);
                        } else {
                            console.log(`[AutoVoice] Channel ${channelId} is not empty, skipping deletion.`);
                        }
                    } else {
                        await redisClient.del(key);
                        console.log(`[AutoVoice] Deleted orphaned Redis key for non-existent channel ${channelId}`);
                    }
                    break;
                }
            } catch {
                // Channel not found in this guild, continue
            }
        }
        

    });

    console.log('[AutoVoice] Cleanup of orphaned/empty temporary channels complete.');
}

export default function (client: Client) {
    // Run every 24 hours (24 * 60 * 60 * 1000 ms)
    taskRunner.scheduleTask(
        'cleanupOrphanedChannels',
        24 * 60 * 60 * 1000,
        () => cleanupOrphanedChannels(client),
        true
    );
};
