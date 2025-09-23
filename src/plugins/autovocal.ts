import {
    VoiceState,
    GuildMember,
    ChannelType,
    PermissionsBitField,
    EmbedBuilder,
    Client,
    Interaction,
    VoiceChannel,
    CategoryChannel,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    OverwriteResolvable,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} from 'discord.js';
import redisClient from '../data/redis';
import { cleanupOrphanedChannels } from '../tasks/cleanupOrphanedChannels';

export interface TempChannelData {
    id: string;
    ownerId: string;
    whitelist: string[];
    createdAt: number;
}

export const TEMP_VOICE_PREFIX = 'tempVoice:';
const AUTO_VOICE_CHANNELS_KEY = 'autoVoiceChannel';
const AUTO_VOICE_ADMIN_ROLES_KEY = 'adminAutoVoiceChannel';


/**
 * @async
 * @function createTemporaryChannelOnJoin
 * @description Handles the creation of a new temporary voice channel when a user joins a designated "creation" channel.
 * The new channel is moved to the same category as the creation channel, and the user is moved into it.
 * Permissions are set up for the owner, and a configuration message with buttons is sent.
 * @param {VoiceState} newState The new voice state of the member.
 * @param {Client} client The Discord client instance.
 * @returns {Promise<void>}
 */
async function createTemporaryChannelOnJoin(
    newState: VoiceState,
    client: Client
): Promise<void> {
    if (!newState.channelId || !newState.member || !newState.guild || newState.member.user.bot) {
        return;
    }

    if (newState.channelId === newState.guild.afkChannelId) return;

    const triggerChannelsString = await redisClient.get(AUTO_VOICE_CHANNELS_KEY);
    if (!triggerChannelsString) {
        console.debug(`[AutoVoice] ${AUTO_VOICE_CHANNELS_KEY} key not set in Redis or is empty.`);
        return;
    }

    let triggerChannelIds: string[];
    try {
        triggerChannelIds = JSON.parse(triggerChannelsString);
        if (!Array.isArray(triggerChannelIds) || !triggerChannelIds.every(id => typeof id === 'string')) {
            console.error(`[AutoVoice] Invalid format for ${AUTO_VOICE_CHANNELS_KEY} in Redis. Expected a JSON array of strings.`);
            return;
        }
    } catch (e) {
        console.error(`[AutoVoice] Error parsing ${AUTO_VOICE_CHANNELS_KEY} from Redis:`, e);
        return;
    }

    if (!triggerChannelIds.includes(newState.channelId)) {
        return;
    }

    const member = newState.member as GuildMember;
    const guild = newState.guild;

    const joinedCreatorChannel = guild.channels.cache.get(newState.channelId) as VoiceChannel | undefined;
    if (!joinedCreatorChannel || joinedCreatorChannel.type !== ChannelType.GuildVoice) {
        console.error(`[AutoVoice] Joined trigger channel ${newState.channelId} not found or not a voice channel.`);
        return;
    }

    const category = joinedCreatorChannel.parent as CategoryChannel | null;
    if (!category) {
        console.error(`[AutoVoice] Trigger channel ${joinedCreatorChannel.name} (${joinedCreatorChannel.id}) is not in a category.`);
        return;
    }

    try {
        const newChannelName = `Salon de ${member.displayName}`;
        const newVoiceChannel = await guild.channels.create({
            name: newChannelName,
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect],
                },
                {
                    id: member.id, // Channel Owner
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.Connect,
                        PermissionsBitField.Flags.Speak,
                        PermissionsBitField.Flags.Stream,
                        PermissionsBitField.Flags.MuteMembers,
                        PermissionsBitField.Flags.DeafenMembers,
                        PermissionsBitField.Flags.ManageChannels,
                        PermissionsBitField.Flags.UseVAD,
                    ],
                },
                {
                    id: client.user!.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ManageChannels],
                }
            ],
        });

        await member.voice.setChannel(newVoiceChannel);

        const channelData: TempChannelData = {
            id: newVoiceChannel.id,
            ownerId: member.id,
            whitelist: [member.id],
            createdAt: Date.now(),
        };
        await redisClient.set(`${TEMP_VOICE_PREFIX}${newVoiceChannel.id}`, JSON.stringify(channelData));

        const openButton = new ButtonBuilder()
            .setCustomId(`autovocal_open_${newVoiceChannel.id}`)
            .setLabel('Ouvert')
            .setStyle(ButtonStyle.Primary) // Active button
            .setDisabled(true); // Initially open, so disable this button

        const closeButton = new ButtonBuilder()
            .setCustomId(`autovocal_close_${newVoiceChannel.id}`)
            .setLabel('Fermé')
            .setStyle(ButtonStyle.Secondary) // Inactive button
            .setDisabled(false);

        const privateButton = new ButtonBuilder()
            .setCustomId(`autovocal_private_${newVoiceChannel.id}`)
            .setLabel('Privé')
            .setStyle(ButtonStyle.Secondary) // Inactive button
            .setDisabled(false);

        const whitelistAddButton = new ButtonBuilder()
            .setCustomId(`autovocal_whitelist_add_${newVoiceChannel.id}`)
            .setLabel('Ajouter à la Whitelist')
            .setStyle(ButtonStyle.Secondary);

        const whitelistRemoveButton = new ButtonBuilder()
            .setCustomId(`autovocal_whitelist_remove_${newVoiceChannel.id}`)
            .setLabel('Retirer de la Whitelist')
            .setStyle(ButtonStyle.Secondary);

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(openButton, closeButton, privateButton);
        const whitelistActionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(whitelistAddButton, whitelistRemoveButton);

        const whitelistMembers = await Promise.all(
            channelData.whitelist.map(async (userId) => {
                try {
                    const member = await guild.members.fetch(userId);
                    return member.toString(); // Returns <@USER_ID>
                } catch {
                    return `ID: ${userId}`; // Fallback if member not found
                }
            })
        );

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('Configuration du salon')
            .setAuthor({ name: member.displayName, iconURL: member.user.displayAvatarURL() || undefined })
            .setDescription("Voici l'espace de configuration de votre salon vocal temporaire. Utilisez les boutons ci-dessous pour gérer l'accès.")
            .addFields(
                { name: 'Ouvert', value: 'Ouvre le salon à tout le monde.', inline: true },
                { name: 'Fermé', value: 'Ferme le salon (connexion pour propriétaire/liste blanche, visible par tous).', inline: true },
                { name: 'Privé', value: 'Rend le salon privé (visible et accessible uniquement par propriétaire/liste blanche et rôles admin).', inline: true },
                { name: 'Liste Blanche Actuelle', value: whitelistMembers.length > 0 ? whitelistMembers.join('\n') : 'Aucun utilisateur pour le moment.' }
            )
            .setFooter({ text: `Salon créé le` })
            .setTimestamp();

        try {
            await newVoiceChannel.send({ embeds: [embed], components: [actionRow, whitelistActionRow] });
        } catch (sendError) {
            console.warn(`[AutoVoice] Failed to send configuration embed to voice channel ${newVoiceChannel.name} (${newVoiceChannel.id}). This might be due to "Text Chat in Voice Channels" not being active, or missing permissions. Error:`, sendError);
        }

    } catch (error) {
        console.error('[AutoVoice] Error creating temporary channel or sending message:', error);
    }
}

async function cleanupEmptyTemporaryChannel(oldState: VoiceState): Promise<void> {
    if (!oldState.channelId || !oldState.guild) {
        return;
    }

    const channelId = oldState.channelId;
    const redisKey = `${TEMP_VOICE_PREFIX}${channelId}`;
    const channelDataString = await redisClient.get(redisKey);

    if (!channelDataString) {
        return;
    }

    const voiceChannel = oldState.guild.channels.cache.get(channelId) as VoiceChannel | undefined;

    if (voiceChannel && voiceChannel.members.size === 0) {
        try {
            await voiceChannel.delete('AutoVoice: Channel empty.');
            await redisClient.del(redisKey);
        } catch (error) {
            console.error(`[AutoVoice] Error deleting temporary channel ${channelId}:`, error);
        }
    } else if (!voiceChannel) {
        console.log(`[AutoVoice] Temporary voice channel ${channelId} not found in cache. Cleaning up Redis.`);
        await redisClient.del(redisKey);
    }
}

async function getAdminRolesFromRedis(): Promise<string[]> {
    const adminRolesString = await redisClient.get(AUTO_VOICE_ADMIN_ROLES_KEY);
    if (!adminRolesString) {
        console.debug(`[AutoVoice] ${AUTO_VOICE_ADMIN_ROLES_KEY} key not set in Redis or is empty.`);
        return [];
    }
    try {
        const roleIds = JSON.parse(adminRolesString);
        if (Array.isArray(roleIds) && roleIds.every(id => typeof id === 'string')) {
            return roleIds;
        }
        console.error(`[AutoVoice] Invalid format for ${AUTO_VOICE_ADMIN_ROLES_KEY} in Redis. Expected a JSON array of strings.`);
        return [];
    } catch (e) {
        console.error(`[AutoVoice] Error parsing ${AUTO_VOICE_ADMIN_ROLES_KEY} from Redis:`, e);
        return [];
    }
}

const OWNER_PERMISSIONS = [
    PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak, PermissionsBitField.Flags.Stream,
    PermissionsBitField.Flags.MoveMembers, PermissionsBitField.Flags.MuteMembers,
    PermissionsBitField.Flags.DeafenMembers, PermissionsBitField.Flags.ManageChannels,
    PermissionsBitField.Flags.UseVAD,
];

const BOT_PERMISSIONS = [
    PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ManageChannels,
];

export default async function initializeAutoVocalPlugin(client: Client): Promise<void> { // Make async
    if (client.isReady()) {
        await cleanupOrphanedChannels(client);
    } else {
        client.once(Events.ClientReady, async (readyClient) => {
            await cleanupOrphanedChannels(readyClient);
        });
    }
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (newState.channelId && newState.channelId !== oldState.channelId) {
            await createTemporaryChannelOnJoin(newState, client);
        }
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
            await cleanupEmptyTemporaryChannel(oldState);
        }
    });

    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        if (!interaction.guild || !client.user) return;

        if (interaction.isButton() && interaction.customId.startsWith('autovocal_')) {
            const parts = interaction.customId.split('_');
        if (parts.length < 3) { // Expects autovocal_action_channelId
            console.warn(`[AutoVoice] Received malformed customId: ${interaction.customId}`);
            return;
        }

        const action = parts[1];
        const channelId = parts[2];

            if (action === 'whitelist') { // e.g., autovocal_whitelist_add_channelId or autovocal_whitelist_remove_channelId
                const subAction = parts[2]; // add
                const actualChannelId = parts[3];

                if (subAction === 'add') {
                    const tempChannelKey = `${TEMP_VOICE_PREFIX}${actualChannelId}`;
                    const channelDataString = await redisClient.get(tempChannelKey);
                    if (!channelDataString) {
                        await interaction.reply({ content: "Les données de ce salon temporaire sont introuvables.", flags: MessageFlags.Ephemeral });
                        return;
                    }
                    const channelData: TempChannelData = JSON.parse(channelDataString);
                    if (interaction.user.id !== channelData.ownerId) {
                        await interaction.reply({ content: "Vous n'êtes pas le propriétaire de ce salon.", flags: MessageFlags.Ephemeral });
                        return;
                    }

                    const modal = new ModalBuilder()
                        .setCustomId(`autovocal_whitelist_modal_submit_${actualChannelId}`)
                        .setTitle("Ajouter à la Whitelist");

                    const userIdInput = new TextInputBuilder()
                        .setCustomId('userIdToAdd')
                        .setLabel("Pseudo ou ID de l'utilisateur")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder("Ex: NomUtilisateur ou 123456789012345678");

                    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(userIdInput);
                    modal.addComponents(firstActionRow);
                    await interaction.showModal(modal);
                } else if (subAction === 'remove') {
                    const tempChannelKey = `${TEMP_VOICE_PREFIX}${actualChannelId}`;
                    const channelDataString = await redisClient.get(tempChannelKey);
                    if (!channelDataString) {
                        await interaction.reply({ content: "Les données de ce salon temporaire sont introuvables.", flags: MessageFlags.Ephemeral });
                        return;
                    }
                    const channelData: TempChannelData = JSON.parse(channelDataString);
                    if (interaction.user.id !== channelData.ownerId) {
                        await interaction.reply({ content: "Vous n'êtes pas le propriétaire de ce salon.", flags: MessageFlags.Ephemeral });
                        return;
                    }

                    const modal = new ModalBuilder()
                        .setCustomId(`autovocal_whitelist_remove_modal_submit_${actualChannelId}`)
                        .setTitle("Retirer de la Whitelist");

                    const userIdInput = new TextInputBuilder()
                        .setCustomId('userIdToRemove')
                        .setLabel("Pseudo ou ID de l'utilisateur à retirer")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder("Ex: NomUtilisateur ou 123456789012345678");
                    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(userIdInput);
                    modal.addComponents(firstActionRow);
                    await interaction.showModal(modal);
                }
                return; // Handled whitelist action
            }

        const tempChannelKey = `${TEMP_VOICE_PREFIX}${channelId}`;
        const channelDataString = await redisClient.get(tempChannelKey);

        if (!channelDataString) {
            await interaction.reply({ content: "Ce salon temporaire n'existe plus ou ses données sont introuvables.", flags: MessageFlags.Ephemeral });
            return;
        }

        let channelData: TempChannelData;
        try {
            channelData = JSON.parse(channelDataString);
        } catch (e) {
            console.error(`[AutoVoice] Error parsing TempChannelData for ${channelId} from Redis:`, e);
            await interaction.reply({ content: "Erreur lors de la récupération des données du salon.", flags: MessageFlags.Ephemeral });
            return;
        }

        if (interaction.user.id !== channelData.ownerId) {
            await interaction.reply({ content: "Vous n'êtes pas le propriétaire de ce salon.", flags: MessageFlags.Ephemeral });
            return;
        }

        const voiceChannel = interaction.guild.channels.cache.get(channelId) as VoiceChannel | undefined;
        if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
            await interaction.reply({ content: "Le salon vocal est introuvable ou n'est plus un salon vocal.", flags: MessageFlags.Ephemeral });
            await redisClient.del(tempChannelKey);
            return;
        }

        const guildId = interaction.guild.id;
        const ownerId = channelData.ownerId;
        const botId = client.user.id;

        const newPermissionOverwrites: OverwriteResolvable[] = [
            { id: ownerId, allow: OWNER_PERMISSIONS },
            { id: botId, allow: BOT_PERMISSIONS },
        ];

        for (const whitelistedUserId of channelData.whitelist) {
            if (whitelistedUserId !== ownerId) { // Owner permissions are handled by OWNER_PERMISSIONS
                newPermissionOverwrites.push({
                    id: whitelistedUserId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect],
                });
            }
        }

        let replyMessage = "";
        let openDisabled = false;
        let closeDisabled = false;
        let privateDisabled = false;

        if (action === 'open') {
            newPermissionOverwrites.push({
                id: guildId, // @everyone
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect],
            });
            replyMessage = "Le salon est maintenant ouvert à tous.";
            openDisabled = true;
        } else if (action === 'close') {
            newPermissionOverwrites.push({
                id: guildId, // @everyone
                allow: [PermissionsBitField.Flags.ViewChannel],
                deny: [PermissionsBitField.Flags.Connect],
            });
            replyMessage = "Le salon est maintenant fermé (visible par tous, connexion pour propriétaire/liste blanche).";
            closeDisabled = true;
        } else if (action === 'private') {
            newPermissionOverwrites.push({
                id: guildId, // @everyone
                deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect],
            });
            const adminRoleIds = await getAdminRolesFromRedis();
            for (const roleId of adminRoleIds) {
                newPermissionOverwrites.push({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect] });
            }
            replyMessage = "Le salon est maintenant privé (visible et accessible uniquement par propriétaire/liste blanche et rôles admin).";
            privateDisabled = true;
        } else {
            console.warn(`[AutoVoice] Unknown action: ${action} for channel ${channelId}`);
            return; 
        }

        try {
            await voiceChannel.edit({ permissionOverwrites: newPermissionOverwrites });

            // Update the original message with new button states
            const updatedOpenButton = new ButtonBuilder()
                .setCustomId(`autovocal_open_${channelId}`)
                .setLabel('Ouvert')
                .setStyle(openDisabled ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(openDisabled);

            const updatedCloseButton = new ButtonBuilder()
                .setCustomId(`autovocal_close_${channelId}`)
                .setLabel('Fermé')
                .setStyle(closeDisabled ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(closeDisabled);

            const updatedPrivateButton = new ButtonBuilder()
                .setCustomId(`autovocal_private_${channelId}`)
                .setLabel('Privé')
                .setStyle(privateDisabled ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(privateDisabled);

            const updatedActionRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(updatedOpenButton, updatedCloseButton, updatedPrivateButton);

            // The whitelist button row (the second row) remains unchanged.
            // interaction.message.components contains ActionRow instances, not ActionRowBuilder instances.
            // These ActionRow instances can be used directly in message.edit().
            if (interaction.message.components.length < 2) {
                console.error("[AutoVoice] Critical error: Expected at least two action rows in the message, but found less. Cannot update whitelist button row.");
                await interaction.reply({ content: 'Une erreur interne est survenue lors de la mise à jour des boutons.', flags: MessageFlags.Ephemeral });
                return;
            }
            const whitelistButtonRow = interaction.message.components[1];

            await interaction.message.edit({ components: [updatedActionRow, whitelistButtonRow] });
            await interaction.reply({ content: replyMessage, flags: MessageFlags.Ephemeral });

        } catch (editError) {
            console.error(`[AutoVoice] Error updating permissions for channel ${voiceChannel.name} (${channelId}):`, editError);
            await interaction.reply({ content: 'Échec de la mise à jour des permissions du salon.', flags: MessageFlags.Ephemeral });
        }
    // }); // Incorrectly closed here
        } else if (interaction.isModalSubmit() && interaction.customId.startsWith('autovocal_whitelist_modal_submit_')) {
            const channelId = interaction.customId.substring('autovocal_whitelist_modal_submit_'.length);

            const tempChannelKey = `${TEMP_VOICE_PREFIX}${channelId}`;
            const channelDataString = await redisClient.get(tempChannelKey);

            if (!channelDataString) { //
                await interaction.reply({ content: "Les données de ce salon temporaire sont introuvables pour traiter cette soumission.", flags: MessageFlags.Ephemeral });
                return;
            }

            let channelData: TempChannelData;
            try {
                channelData = JSON.parse(channelDataString);
            } catch (e) {
                console.error(`[AutoVoice] Error parsing TempChannelData for modal submit ${channelId} from Redis:`, e);
                await interaction.reply({ content: "Erreur lors de la récupération des données du salon.", flags: MessageFlags.Ephemeral });
                return;
            }

            if (interaction.user.id !== channelData.ownerId) {
                await interaction.reply({ content: "Vous n'êtes pas le propriétaire de ce salon pour effectuer cette action.", flags: MessageFlags.Ephemeral });
                return;
            }

            const userInput = interaction.fields.getTextInputValue('userIdToAdd').trim();
            let memberToAdd: GuildMember | null = null;
            let resolvedUserId: string | null = null;

            // Try to resolve by User ID first
            if (/^\d{17,19}$/.test(userInput)) {
                resolvedUserId = userInput;
                memberToAdd = await interaction.guild.members.fetch(resolvedUserId).catch(() => null);
            } else {
                // Try to resolve by username (case-insensitive)
                // Fetch up to 2 members to detect ambiguity.
                const fetchedMembers = await interaction.guild.members.fetch({ query: userInput, limit: 2 });
                
                // Filter for exact username match, case-insensitive
                const matchingMembers = fetchedMembers.filter(m => m.user.username.toLowerCase() === userInput.toLowerCase());

                if (matchingMembers.size === 1) {
                    memberToAdd = matchingMembers.first()!;
                } else if (matchingMembers.size > 1) {
                    await interaction.reply({ content: `Plusieurs utilisateurs trouvés pour "${userInput}". Veuillez utiliser l'ID de l'utilisateur pour plus de précision.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                // If matchingMembers.size is 0, memberToAdd remains null and will be handled below.
            }

            if (!memberToAdd) {
                await interaction.reply({ content: `L'utilisateur "${userInput}" n'a pas été trouvé. Veuillez vérifier le pseudo ou l'ID.`, flags: MessageFlags.Ephemeral });
                return;
            }

            resolvedUserId = memberToAdd.id;

            if (channelData.whitelist.includes(resolvedUserId)) {
                await interaction.reply({ content: "Cet utilisateur est déjà dans la whitelist.", flags: MessageFlags.Ephemeral });
                return;
            }

            channelData.whitelist.push(resolvedUserId);
            await redisClient.set(tempChannelKey, JSON.stringify(channelData));

            const voiceChannel = interaction.guild.channels.cache.get(channelId) as VoiceChannel | undefined;
            if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice) {
                try {
                    await voiceChannel.permissionOverwrites.edit(resolvedUserId, {
                        ViewChannel: true,
                        Connect: true,
                    });
                    // Update embed
                    const newWhitelistMembers = await Promise.all(
                        channelData.whitelist.map(async (userId) => {
                            try {
                                const member = await interaction.guild!.members.fetch(userId);
                                return member.toString();
                            } catch { return `ID: ${userId}`; }
                        })
                    );
                    if (interaction.message && interaction.message.embeds.length > 0) {
                        const existingFields = interaction.message.embeds[0].fields.slice(0, -1);
                        const newWhitelistField = { name: 'Liste Blanche Actuelle', value: newWhitelistMembers.length > 0 ? newWhitelistMembers.join('\n') : 'Aucun utilisateur pour le moment.' };
                        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                            .setFields(...existingFields, newWhitelistField);
                        await interaction.message.edit({ embeds: [updatedEmbed] });
                    } else {
                        console.warn('[AutoVoice] Could not update embed for whitelist add: interaction.message or embeds not found.');
                    }
                    await interaction.reply({ content: `L'utilisateur ${memberToAdd.toString()} a été ajouté à la whitelist.`, flags: MessageFlags.Ephemeral });
                } catch (permError) {
                    console.error(`[AutoVoice] Error setting permissions for whitelisted user ${resolvedUserId} on channel ${channelId}:`, permError);
                    await interaction.reply({ content: "Utilisateur ajouté à la liste blanche, mais une erreur est survenue lors de la mise à jour des permissions du salon.", flags: MessageFlags.Ephemeral });
                }
            } else {
                await interaction.reply({ content: "Utilisateur ajouté à la liste blanche, mais le salon vocal est introuvable pour mettre à jour les permissions.", flags: MessageFlags.Ephemeral });
            }
        } else if (interaction.isModalSubmit() && interaction.customId.startsWith('autovocal_whitelist_remove_modal_submit_')) {
            const channelId = interaction.customId.substring('autovocal_whitelist_remove_modal_submit_'.length);
            const tempChannelKey = `${TEMP_VOICE_PREFIX}${channelId}`;
            const channelDataString = await redisClient.get(tempChannelKey);

            if (!channelDataString) {
                await interaction.reply({ content: "Les données de ce salon temporaire sont introuvables.", flags: MessageFlags.Ephemeral });
                return;
            }

            let channelData: TempChannelData;
            try {
                channelData = JSON.parse(channelDataString);
            } catch (e) {
                console.error(`[AutoVoice] Error parsing TempChannelData for modal submit (remove) ${channelId} from Redis:`, e);
                await interaction.reply({ content: "Erreur lors de la récupération des données du salon.", flags: MessageFlags.Ephemeral });
                return;
            }

            if (interaction.user.id !== channelData.ownerId) {
                await interaction.reply({ content: "Vous n'êtes pas le propriétaire de ce salon pour effectuer cette action.", flags: MessageFlags.Ephemeral });
                return;
            }

            const userInput = interaction.fields.getTextInputValue('userIdToRemove').trim();
            let memberToRemove: GuildMember | null = null;
            let resolvedUserIdToRemove: string | null = null;

            if (/^\d{17,19}$/.test(userInput)) {
                resolvedUserIdToRemove = userInput;
                memberToRemove = await interaction.guild.members.fetch(resolvedUserIdToRemove).catch(() => null);
            } else {
                const fetchedMembers = await interaction.guild.members.fetch({ query: userInput, limit: 2 });
                const matchingMembers = fetchedMembers.filter(m => m.user.username.toLowerCase() === userInput.toLowerCase());
                if (matchingMembers.size === 1) {
                    memberToRemove = matchingMembers.first()!;
                } else if (matchingMembers.size > 1) {
                    await interaction.reply({ content: `Plusieurs utilisateurs trouvés pour "${userInput}". Veuillez utiliser l'ID pour retirer.`, flags: MessageFlags.Ephemeral });
                    return;
                }
            }

            if (!memberToRemove) {
                await interaction.reply({ content: `L'utilisateur "${userInput}" n'a pas été trouvé.`, flags: MessageFlags.Ephemeral });
                return;
            }
            resolvedUserIdToRemove = memberToRemove.id;

            if (resolvedUserIdToRemove === channelData.ownerId) {
                await interaction.reply({ content: "Vous ne pouvez pas vous retirer vous-même de la whitelist.", flags: MessageFlags.Ephemeral });
                return;
            }

            if (!channelData.whitelist.includes(resolvedUserIdToRemove)) {
                await interaction.reply({ content: "Cet utilisateur n'est pas dans la whitelist.", flags: MessageFlags.Ephemeral });
                return;
            }

            channelData.whitelist = channelData.whitelist.filter(id => id !== resolvedUserIdToRemove);
            await redisClient.set(tempChannelKey, JSON.stringify(channelData));

            const voiceChannel = interaction.guild.channels.cache.get(channelId) as VoiceChannel | undefined;
            if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice) {
                await voiceChannel.permissionOverwrites.delete(resolvedUserIdToRemove, 'Removed from AutoVoice whitelist by owner.');
            }
            // Update embed
            const newWhitelistMembers = await Promise.all(
                channelData.whitelist.map(async (userId) => {
                    try {
                        const member = await interaction.guild!.members.fetch(userId);
                        return member.toString();
                    } catch { return `ID: ${userId}`; }
                })
            );
            if (interaction.message && interaction.message.embeds.length > 0) {
                const existingFields = interaction.message.embeds[0].fields.slice(0, -1);
                const newWhitelistField = { name: 'Liste Blanche Actuelle', value: newWhitelistMembers.length > 0 ? newWhitelistMembers.join('\n') : 'Aucun utilisateur pour le moment.' };
                const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setFields(...existingFields, newWhitelistField);
                await interaction.message.edit({ embeds: [updatedEmbed] });
            } else {
                console.warn('[AutoVoice] Could not update embed for whitelist remove: interaction.message or embeds not found.');
            }
            await interaction.reply({ content: `L'utilisateur ${memberToRemove.toString()} a été retiré de la whitelist.`, flags: MessageFlags.Ephemeral });
        }
    });

    console.log('[PLUGINS] AutoVocal Plugin initialized and listening for voice state updates.');
}