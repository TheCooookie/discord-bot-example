import { Client, EmbedBuilder, ColorResolvable, TextChannel, NewsChannel } from 'discord.js';
import config from '../config';

export async function logToChannel(
  client: Client,
  options: { title?: string; description: string; color?: ColorResolvable }
) {
  try {
    const channel = await client.channels.fetch(config.LOG_CHANNEL_ID);
    if (
      !channel ||
      !channel.isTextBased() ||
      (typeof (channel as TextChannel | NewsChannel).send !== 'function')
    ) return;

    const embed = new EmbedBuilder()
      .setDescription(options.description)
      .setColor(options.color || 0x2b2d31)
      .setTimestamp();

    if (options.title) embed.setTitle(options.title);

    await (channel as TextChannel | NewsChannel).send({ embeds: [embed] });
  } catch (err) {
    console.warn('[LogToChannel] Failed to send log embed:', err);
  }
}