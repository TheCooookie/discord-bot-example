import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import { BotCommand } from '../types/discord.d';
/**
 * @type {BotCommand}
 * @description Defines the Discord bot command '/ping'. This command is a simple
 * utility to check the bot's responsiveness and display its latency.
 */
const command: BotCommand = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong! (Guild Only)')
        .setContexts([InteractionContextType.Guild])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall]),
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🏓 Pong!')
            .setDescription(`Latency is ${Date.now() - interaction.createdTimestamp}ms.`);

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};

export default command;