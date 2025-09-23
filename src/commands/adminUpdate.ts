import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
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

/**
 * @type {BotCommand}
 * @description Defines the Discord bot command '/adminupdate'. This command allows
 * authorized server members (those with `ManageRoles` permission) to manually trigger
 * a role update for any specified user based on their verification and membership status
 * in the connected database.
 */
const command: BotCommand = {
    data: new SlashCommandBuilder()
        .setName('adminupdate')
        .setDescription('Update user roles.')
        .setContexts([InteractionContextType.Guild])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption(option =>
            option.setName('user')
                .setDescription("Le nom d'utilisateur dont vous souhaitez mettre à jour les rôles.")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Cette commande ne peut être utilisée que sur un serveur.', flags: MessageFlags.Ephemeral });
            return;
        }

        let member = await interaction.guild.members.fetch(interaction.options.getUser('user')!.id);

        const account = await Account.findOne({ where: { provider: 'discord', providerAccountId: member.user.id } });
        if (!account) {
            console.warn(`[AdminUpdateCommand] User ${member.user.id} not found in database (Account).`);
            await logToChannel(interaction.client, {
                title: 'Admin Update Failed',
                description: `Utilisateur <@${member.user.id}> (\`${member.user.id}\`) introuvable dans la base de données (Account).`,
                color: ERROR_COLOR
            });
            await interaction.reply({ content: 'Utilisateur non trouvé dans la base de données.', flags: MessageFlags.Ephemeral });
            return;
        }
        const user = await User.findOne({ where: { id: account.userId } });
        if (!user) {
            console.warn(`[AdminUpdateCommand] User ${member.user.id} not found in database (User).`);
            await logToChannel(interaction.client, {
                title: 'Admin Update Failed',
                description: `Utilisateur <@${member.user.id}> (\`${member.user.id}\`) introuvable dans la base de données (User).`,
                color: ERROR_COLOR
            });
            await interaction.reply({ content: 'Utilisateur non trouvé dans la base de données.', flags: MessageFlags.Ephemeral });
            return;
        }

        let addedRoles: string[] = [];

        if (user.verificationExpires && new Date(user.verificationExpires) > new Date()) {
            if (!member.roles.cache.has(VERIFICATION_ROLE_ID)) {
                await member.roles.add(VERIFICATION_ROLE_ID);
                addedRoles.push('Verified');
                console.log(`[AdminUpdateCommand] Gave Verified role to ${member.user.tag} (${member.user.id})`);
                await logToChannel(interaction.client, {
                    title: 'Rôle donné',
                    description: `A attribué le rôle **Vérifié** à <@${member.user.id}> (\`${member.user.id}\`).`,
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
                console.log(`[AdminUpdateCommand] Gave ${roleInfo.label} role to ${member.user.tag} (${member.user.id})`);
                await logToChannel(interaction.client, {
                    title: 'Rôle donné',
                    description: `A attribué le rôle **${roleInfo.label}** à <@${member.user.id}> (\`${member.user.id}\`).`,
                    color: SUCCESS_COLOR
                });
            }
        }

        if (addedRoles.length > 0) {
            await interaction.reply({ content: `Rôles mis à jour : ${addedRoles.join(', ')}.`, flags: MessageFlags.Ephemeral });
        } else {
            console.log(`[AdminUpdateCommand] No roles updated for ${member.user.tag} (${member.user.id})`);
            await logToChannel(interaction.client, {
                title: 'Aucun rôle mis à jour',
                description: `Aucun rôle n'a été mis à jour pour <@${member.user.id}> (\`${member.user.id}\`).`,
                color: ERROR_COLOR
            });
            await interaction.reply({ content: "Aucun rôle n'a été mis à jour (l'utilisateur peut déjà avoir les rôles ou ne pas être éligible).", flags: MessageFlags.Ephemeral });
        }

    }
};


export default command;