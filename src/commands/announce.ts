import {
    ActionRowBuilder,
    AutocompleteInteraction,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    InteractionContextType,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { BotCommand } from '../types/discord';

const COLORS: Record<string, number> = { Blue: 0x0099FF, Green: 0x57F287, Yellow: 0xFEE75C, Red: 0xED4245 };

/**
 * /announce: posts an embed with a "Got it" button.
 * Shows options, autocomplete, a permission gate and a button (handled in src/components/announce.ts).
 */
const command: BotCommand = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Post an announcement with a "Got it" button.')
        .setContexts([InteractionContextType.Guild])
        // Only members who can manage messages see this command. Server admins can change it in Integrations.
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option => option
            .setName('text')
            .setDescription('What to announce')
            .setRequired(true)
            .setMaxLength(2000))
        .addStringOption(option => option
            .setName('color')
            .setDescription('Embed color')
            .setAutocomplete(true)),

    async autocomplete(interaction: AutocompleteInteraction) {
        const typed = interaction.options.getFocused().toLowerCase();
        const matches = Object.keys(COLORS).filter(name => name.toLowerCase().startsWith(typed));
        await interaction.respond(matches.map(name => ({ name, value: name })));
    },

    async execute(interaction: ChatInputCommandInteraction) {
        // Autocomplete only suggests: the user can still type anything, so fall back to blue.
        const color = COLORS[interaction.options.getString('color') ?? ''] ?? COLORS.Blue;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('📢 Announcement')
            .setDescription(interaction.options.getString('text', true))
            .setFooter({ text: `From ${interaction.user.username}` });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('announce:ack').setLabel('Got it').setStyle(ButtonStyle.Primary),
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};

export default command;
