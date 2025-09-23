import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, ChannelType, Role, MessageFlags, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import { BotCommand } from '../types/discord.d';
import sequelize from '../data/database';
import { DataTypes, Model } from 'sequelize';
import config from '../config';
import { logToChannel } from '../utils/logToChannel'; // <-- Add this import

const ERROR_COLOR = 0xFF0000;
const SUCCESS_COLOR = 0x00FF00;

class User extends Model {
    declare id: string;
    declare verificationExpires: Date | null;
    declare tier: string | null;
}
User.init({
    id: { type: DataTypes.UUID, primaryKey: true },
    verificationExpires: { type: DataTypes.DATE, allowNull: true },
    tier: { type: DataTypes.STRING, allowNull: true },
}, { sequelize, tableName: 'User', timestamps: false });

class Account extends Model {
    declare userId: string;
    declare provider: string;
    declare providerAccountId: string;
}
Account.init({
    userId: { type: DataTypes.UUID, allowNull: false },
    provider: { type: DataTypes.TEXT, allowNull: false },
    providerAccountId: { type: DataTypes.TEXT, allowNull: false },
}, { sequelize, tableName: 'Account', timestamps: false });

const VERIFICATION_ROLE_ID = config.VERIFICATION_ROLE_ID;
const MEMBERSHIP_ROLE_ID = config.MEMBERSHIP_ROLE_ID;
const PATREON_ROLE_ID = config.PATREON_ROLE_ID;
const SPONSOR_ROLE_ID = config.SPONSOR_ROLE_ID;

const TIER_ROLE_MAP: Record<string, { id: string, label: string }> = {
    MEMBERSHIP: { id: MEMBERSHIP_ROLE_ID, label: 'Membership' },
    PATREON: { id: PATREON_ROLE_ID, label: 'Patreon' },
    SPONSOR: { id: SPONSOR_ROLE_ID, label: 'Sponsor' },
};

const updateCooldown = new Map<string, number>();
const COOLDOWN_SECONDS = 60;

/**
 * @type {BotCommand}
 * @description Defines the Discord bot command '/update'. This command allows a user to update their roles
 * based on their verification and membership status in the connected database.
 */
const command: BotCommand = {
    data: new SlashCommandBuilder()
        .setName('update')
        .setDescription('Update user roles.')
        .setContexts([InteractionContextType.Guild])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall]),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Cette commande ne peut être utilisée que sur un serveur.', flags: MessageFlags.Ephemeral });
            return;
        }

        const now = Date.now();
        const lastUsed = updateCooldown.get(interaction.user.id) || 0;
        if (now - lastUsed < COOLDOWN_SECONDS * 1000) {
            const secondsLeft = Math.ceil((COOLDOWN_SECONDS * 1000 - (now - lastUsed)) / 1000);
            const timerEmbed = new EmbedBuilder()
                .setColor(ERROR_COLOR)
                .setDescription(`⏳ S'il vous plaît, attendez ${secondsLeft} secondes avant d'utiliser à nouveau cette commande.`);
            await interaction.reply({ embeds: [timerEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        updateCooldown.set(interaction.user.id, now);

        let member = await interaction.guild.members.fetch(interaction.user.id);

        const account = await Account.findOne({ where: { provider: 'discord', providerAccountId: interaction.user.id } });
        if (!account) {
            console.warn(`[UpdateCommand] User ${interaction.user.id} not found in database (Account).`);
            await logToChannel(interaction.client, {
                title: 'Échec de la mise à jour',
                description: `Utilisateur <@${interaction.user.id}> (\`${interaction.user.id}\`) introuvable dans la base de données (Account).`,
                color: ERROR_COLOR
            });
            const errorAccountEmbed = new EmbedBuilder()
                .setColor(ERROR_COLOR)
                .setTitle('Update ERROR')
                .setDescription("Votre compte AAEEG n'est pas connecté avec votre compte Discord. Si vous avez déjà un compte, veuillez contacter un administrateur par ticket.");
            await interaction.reply({ embeds: [errorAccountEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        const user = await User.findOne({ where: { id: account.userId } });
        if (!user) {
            console.warn(`[UpdateCommand] User ${interaction.user.id} not found in database (User).`);
            await logToChannel(interaction.client, {
                title: 'Échec de la mise à jour',
                description: `Utilisateur <@${interaction.user.id}> (\`${interaction.user.id}\`) introuvable dans la base de données (User).`,
                color: ERROR_COLOR
            });
                        const errorAccountEmbed = new EmbedBuilder()
                .setColor(ERROR_COLOR)
                .setTitle('Update ERROR')
                .setDescription("Vous ne possédez pas de compte AAEEG. Si vous avez déjà un compte, veuillez contacter un administrateur par ticket.");
            await interaction.reply({ content: 'Utilisateur non trouvé dans la base de données.', flags: MessageFlags.Ephemeral });
            return;
        }

        let addedRoles: string[] = [];

        if (user.verificationExpires && new Date(user.verificationExpires) > new Date()) {
            if (!member.roles.cache.has(VERIFICATION_ROLE_ID)) {
                await member.roles.add(VERIFICATION_ROLE_ID);
                addedRoles.push('Verified');
                console.log(`[UpdateCommand] Gave Verified role to ${interaction.user.tag} (${interaction.user.id})`);
                await logToChannel(interaction.client, {
                    title: 'Rôle donné',
                    description: `A attribué le rôle **Vérifié** à <@${interaction.user.id}> (\`${interaction.user.id}\`).`,
                    color: SUCCESS_COLOR
                });
            }
        }

        if (user.tier) {
            const tierKey = user.tier.toUpperCase();
            const roleInfo = TIER_ROLE_MAP[tierKey];
            if (roleInfo && !member.roles.cache.has(roleInfo.id)) {
                await member.roles.add(roleInfo.id);
                addedRoles.push(roleInfo.label);
                console.log(`[UpdateCommand] Gave ${roleInfo.label} role to ${interaction.user.tag} (${interaction.user.id})`);
                await logToChannel(interaction.client, {
                    title: 'Rôle donné',
                    description: `A donné **${roleInfo.label}** rôle de <@${interaction.user.id}> (\`${interaction.user.id}\`).`,
                    color: SUCCESS_COLOR
                });
            }
        }

        if (addedRoles.length > 0) {
            const addRoleEmbed = new EmbedBuilder()
                .setColor(SUCCESS_COLOR)
                .setTitle('Update')
                .setDescription(`Rôles mis à jour : ${addedRoles.join(', ')}.`);
            await interaction.reply({ embeds: [addRoleEmbed], flags: MessageFlags.Ephemeral });
        } else {
            console.log(`[UpdateCommand] No roles updated for ${interaction.user.tag} (${interaction.user.id})`);
            await logToChannel(interaction.client, {
                title: 'Aucun rôle mis à jour',
                description: `Aucun rôle n'a été mis à jour pour <@${interaction.user.id}> (\`${interaction.user.id}\`).`,
                color: ERROR_COLOR
            });
            const errorAddRoleEmbed = new EmbedBuilder()
                .setColor(ERROR_COLOR)
                .setTitle('Update')
                .setDescription("Aucun rôle n'a été mis à jour (l'utilisateur peut déjà avoir les rôles ou ne pas être éligible).");
            await interaction.reply({ embeds: [errorAddRoleEmbed], flags: MessageFlags.Ephemeral });
        }

    }
};


export default command;