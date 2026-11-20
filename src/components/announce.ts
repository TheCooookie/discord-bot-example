import { MessageFlags } from 'discord.js';
import { BotComponent } from '../types/discord';

/** Handles the "Got it" button posted by /announce (customId 'announce:ack'). */
const component: BotComponent = {
    customId: 'announce',
    async execute(interaction) {
        await interaction.reply({ content: '👍 Thanks for reading!', flags: MessageFlags.Ephemeral });
    },
};

export default component;
