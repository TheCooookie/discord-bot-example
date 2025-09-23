import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, InteractionContextType, ApplicationIntegrationType, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, ThumbnailBuilder, SectionBuilder } from 'discord.js';
import { BotCommand } from '../types/discord.d';
import sequelize from '../data/database';
import { DataTypes, Model } from 'sequelize';
import config from '../config';

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

/**
 * @type {BotCommand}
 * @description Defines the Discord bot command '/admininfo'. This command allows
 * authorized server members (those with `ManageRoles` permission) to retrieve and
 * display detailed information about a specified user, including their Discord
 * details and their corresponding data from the connected database.
 */
const command: BotCommand = {
    data: new SlashCommandBuilder()
        .setName('admininfo')
        .setDescription('Infor from user.')
        .setContexts([InteractionContextType.Guild])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption(option =>
            option.setName('user')
                .setDescription("Le nom d'utilisateur qui souhaite voir les informations.")
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
            await interaction.reply({ content: 'Utilisateur non trouvé dans la base de données.', flags: MessageFlags.Ephemeral });
            return;
        }
        const user = await User.findOne({ where: { id: account.userId } });
        if (!user) {
            await interaction.reply({ content: 'Utilisateur non trouvé dans la base de données.', flags: MessageFlags.Ephemeral });
            return;
        }

        const headerText = new TextDisplayBuilder()
            .setContent('### Profil de ' + member.user.username)


        const thumbnail = new ThumbnailBuilder()
            .setURL(member.user.displayAvatarURL({ size: 512, extension: 'png' }))

        const headerContent = new TextDisplayBuilder()
            .setContent(`**ID:** ${member.id}\n` +
                 `**Créé le:** ${member.user.createdAt.toLocaleDateString()}\n`+
                `**Rejoint le:** ${member.joinedAt ? member.joinedAt.toLocaleDateString() : 'N/A'}\n`)

        const headSection = new SectionBuilder()
            .addTextDisplayComponents([headerText])
            .addTextDisplayComponents([headerContent])
            .setThumbnailAccessory(thumbnail)

        const separator = new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Large)
            .setDivider(true);


        const membershipRole = interaction.guild.roles.cache.get(MEMBERSHIP_ROLE_ID);
        const patreonRole = interaction.guild.roles.cache.get(PATREON_ROLE_ID);
        const sponsorRole = interaction.guild.roles.cache.get(SPONSOR_ROLE_ID);

        let tierRoleName = 'None';
        if (membershipRole && member.roles.cache.has(MEMBERSHIP_ROLE_ID)) {
            tierRoleName = membershipRole.name;
        } else if (patreonRole && member.roles.cache.has(PATREON_ROLE_ID)) {
            tierRoleName = patreonRole.name;
        } else if (sponsorRole && member.roles.cache.has(SPONSOR_ROLE_ID)) {
            tierRoleName = sponsorRole.name;
        }

        const profileContainer = new ContainerBuilder()
            .addSectionComponents([headSection])
            .addSeparatorComponents([separator])
            .addTextDisplayComponents([new TextDisplayBuilder().setContent('### Informations Discord')])
            .addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`**Vérifié:** ${member.roles.cache.has(VERIFICATION_ROLE_ID) ? 'Oui' : 'Non'}`),
                new TextDisplayBuilder().setContent(`**Rôle de adhésion:** ${tierRoleName}`),
                new TextDisplayBuilder().setContent(`**Rôles:** ${member.roles.cache.map(role => role.name).join(', ') || 'Aucune'}`),
            ])
            .addSeparatorComponents([separator])
            .addTextDisplayComponents([new TextDisplayBuilder().setContent('### Informations Système')])
            .addTextDisplayComponents([
                new TextDisplayBuilder().setContent(`**UUID:** ${user.id}`),
                new TextDisplayBuilder().setContent(`**Vérification expire le:** ${user.verificationExpires ? user.verificationExpires.toLocaleDateString() : 'N/A'}`),
                new TextDisplayBuilder().setContent(`**Rôle de adhésion:** ${user.tier ? user.tier.toUpperCase() : 'N/A'}`)])


        await interaction.reply({components: [profileContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral});

    }
};


export default command;