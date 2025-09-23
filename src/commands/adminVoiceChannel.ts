import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, ChannelType, Role, MessageFlags, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import { BotCommand } from '../types/discord.d';
import redis from '../data/redis';

const ERROR_COLOR = 0xFF0000;
const SUCCESS_COLOR = 0x00FF00;

const AUTO_VC_KEY = 'autoVoiceChannel';
const ADMIN_VC_ROLE_KEY = 'adminAutoVoiceChannel';
/**
 * @async
 * @function handleChannelSubcommand
 * @description Handles the creation or deletion of voice channels that trigger the creation of
 * temporary private voice channels. It updates the Redis store with the current list of channels.
 * @param {ChatInputCommandInteraction} interaction The interaction object from Discord.
 * @param {'create' | 'delete'} action The action to perform: 'create' or 'delete'.
 * @param {string} channelId The ID of the voice channel to add or remove.
 */
const command: BotCommand = {
    data: new SlashCommandBuilder()
        .setName('adminvoicechannel')
        .setDescription('Manage auto private voice channels and their admin roles.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setContexts([InteractionContextType.Guild])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Adds a voice channel to the list of auto private channel creators.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The voice channel to add as an auto-creation trigger.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildVoice)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Removes a voice channel from the list of auto private channel creators.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The voice channel to remove as an auto-creation trigger.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildVoice)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('addadmin')
                .setDescription('Adds a role that can manage auto private voice channels.')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to designate as an admin for auto voice channels.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('removeadmin')
                .setDescription('Removes a role from managing auto private voice channels.')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to remove from being an admin for auto voice channels.')
                        .setRequired(true))),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'create' || subcommand === 'delete') {
                const targetChannel = interaction.options.getChannel('channel', true);
                if (targetChannel.type !== ChannelType.GuildVoice) {
                     await interaction.reply({ content: 'Please select a valid voice channel.', flags: MessageFlags.Ephemeral });
                     return;
                }
                await handleChannelSubcommand(interaction, subcommand, targetChannel.id);
            } else if (subcommand === 'addadmin' || subcommand === 'removeadmin') {
                const targetRole = interaction.options.getRole('role', true) as Role;
                await handleRoleSubcommand(interaction, subcommand, targetRole.id);
            }
        } catch (error) {
            console.error(`Error executing adminvoicechannel/${subcommand}:`, error);
            const errorEmbed = new EmbedBuilder()
                .setColor(ERROR_COLOR)
                .setTitle('Command Error')
                .setDescription('An unexpected error occurred. Please check the console.');
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
    }
};

async function handleChannelSubcommand(interaction: ChatInputCommandInteraction, action: 'create' | 'delete', channelId: string) {
    let currentChannels: string[] = JSON.parse(await redis.get(AUTO_VC_KEY) || '[]');
    const embed = new EmbedBuilder();

    if (action === 'create') {
        if (currentChannels.includes(channelId)) {
            embed.setColor(ERROR_COLOR).setTitle('Already Exists').setDescription(`<#${channelId}> is already an auto voice channel creator.`);
        } else {
            currentChannels.push(channelId);
            await redis.set(AUTO_VC_KEY, JSON.stringify(currentChannels));
            embed.setColor(SUCCESS_COLOR).setTitle('Channel Added').setDescription(`<#${channelId}> has been added as an auto voice channel creator.`);
        }
    } else { // delete
        if (!currentChannels.includes(channelId)) {
            embed.setColor(ERROR_COLOR).setTitle('Not Found').setDescription(`<#${channelId}> is not registered as an auto voice channel creator.`);
        } else {
            currentChannels = currentChannels.filter(id => id !== channelId);
            await redis.set(AUTO_VC_KEY, JSON.stringify(currentChannels));
            embed.setColor(SUCCESS_COLOR).setTitle('Channel Removed').setDescription(`<#${channelId}> has been removed from auto voice channel creators.`);
        }
    }
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleRoleSubcommand(interaction: ChatInputCommandInteraction, action: 'addadmin' | 'removeadmin', roleId: string) {
    let currentAdminRoles: string[] = JSON.parse(await redis.get(ADMIN_VC_ROLE_KEY) || '[]');
    const embed = new EmbedBuilder();

    if (action === 'addadmin') {
        if (currentAdminRoles.includes(roleId)) {
            embed.setColor(ERROR_COLOR).setTitle('Already Exists').setDescription(`<@&${roleId}> is already an admin for auto voice channels.`);
        } else {
            currentAdminRoles.push(roleId);
            await redis.set(ADMIN_VC_ROLE_KEY, JSON.stringify(currentAdminRoles));
            embed.setColor(SUCCESS_COLOR).setTitle('Admin Role Added').setDescription(`<@&${roleId}> has been added as an admin for auto voice channels.`);
        }
    } else { // removeadmin
        if (!currentAdminRoles.includes(roleId)) {
            embed.setColor(ERROR_COLOR).setTitle('Not Found').setDescription(`<@&${roleId}> is not registered as an admin for auto voice channels.`);
        } else {
            currentAdminRoles = currentAdminRoles.filter(id => id !== roleId);
            await redis.set(ADMIN_VC_ROLE_KEY, JSON.stringify(currentAdminRoles));
            embed.setColor(SUCCESS_COLOR).setTitle('Admin Role Removed').setDescription(`<@&${roleId}> has been removed as an admin for auto voice channels.`);
        }
    }
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export default command;