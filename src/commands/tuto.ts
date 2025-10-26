import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, InteractionContextType, ApplicationIntegrationType, ContainerBuilder, TextDisplayBuilder,SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { BotCommand } from '../types/discord.d';

/**
 * @type {BotCommand}
 * @description Defines the Discord bot command '/tuto'. This command provides users with
 * tutorials on various procedures within the server, such as getting membership,
 * verifying their account, or finding their Discord user ID.
 */
const command: BotCommand = {
    data: new SlashCommandBuilder()
        .setName('tuto')
        .setDescription('Affiche des tutoriels pour diverses fonctionnalités.')
        .setContexts([InteractionContextType.Guild])
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .addSubcommand(subcommand =>
            subcommand
                .setName('adhesion')
                .setDescription("Affiche le tutoriel pour obtenir le rôle d'adhérent."))
        .addSubcommand(subcommand =>
            subcommand
                .setName('verification')
                .setDescription('Affiche le tutoriel pour vérifier votre compte.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('userid')
                .setDescription('Affiche le tutoriel pour trouver votre ID utilisateur Discord.')),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Cette commande ne peut être utilisée que sur un serveur.', flags: MessageFlags.Ephemeral });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        const separator = new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Large)
            .setDivider(true);

        switch (subcommand) {
            case 'adhesion': {
                const adhesionContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('### 🎓 Tutoriel d\'adhésion'),
                        new TextDisplayBuilder().setContent("Pour devenir un membre adhérent et obtenir le rôle, suivez ces étapes :"),
                        new TextDisplayBuilder().setContent("**1. Visitez notre site web**\nRendez-vous sur le site de l'association pour prendre votre adhésion. -> https://aaeeg.fr/adhesion"),
                        new TextDisplayBuilder().setContent("**2. Connectez-vous avec votre compte Discord**\nPour simplifier l'ajout de votre rôle sur Discord depuis le site, connectez-vous avec votre compte Discord."),
                        new TextDisplayBuilder().setContent("**3. Choisissez votre pack et remplissez les informations**\n⚠️ Rappel : L'association ne récupère pas de bénéfice sur l'ajout additionnel par Helloasso. ⚠️​"),
                        new TextDisplayBuilder().setContent("**4. Votre rôle sur Discord**\nVérifiez si vous avez reçu le rôle. Ça peut prendre quelques minutes.​"),
                    )
                    .addSeparatorComponents([separator])
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("### ❓ Problèmes courants"),
                        new TextDisplayBuilder().setContent("**1. Je n'ai pas reçu de rôle**\nAssurez-vous que votre compte Discord est bien lié à votre compte sur le site. -> https://aaeeg.fr/user/account"),
                        new TextDisplayBuilder().setContent("**2. Mettez à jour vos rôles**\nUne fois votre compte Discord est bien lié à votre compte sur le site, revenez sur Discord et utilisez la commande `/update` pour que le bot vous attribue automatiquement votre rôle."),
                    );

                await interaction.reply({ components: [adhesionContainer], flags: MessageFlags.IsComponentsV2 });
                break;
            }

            case 'verification': {
                const verificationContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('### ✅ Tutoriel de vérification'),
                        new TextDisplayBuilder().setContent("Pour vérifier votre compte et accéder à plus de salons, suivez ces étapes :"),
                        new TextDisplayBuilder().setContent("**1. Visitez notre site web**\nVisitez notre site web et cliquez sur login pour vous connecter.-> https://aaeeg.fr/"),
                        new TextDisplayBuilder().setContent("**2. Connectez-vous avec votre compte Discord**\nPour simplifier l'ajout de votre rôle sur Discord depuis le site, connectez-vous avec votre compte Discord."),
                        new TextDisplayBuilder().setContent("**3. Vérifiez-vous**\nSuivez les étapes en rentrant votre **mail professionnel** et en rentrant le code que vous allez recevoir. -> https://aaeeg.fr/verify​"),
                        new TextDisplayBuilder().setContent("> La vérification vous permet d'être identifié en tant que militaire et de voir plus de salons sur Discord.")
                    )
                    .addSeparatorComponents([separator])
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("### ❓ Problèmes courants"),
                        new TextDisplayBuilder().setContent("**1. Je n'ai pas reçu de rôle**\nAssurez-vous que votre compte Discord est bien lié à votre compte sur le site. -> https://aaeeg.fr/user/account"),
                        new TextDisplayBuilder().setContent("**2. Mettez à jour vos rôles**\nUne fois votre compte Discord est bien lié à votre compte sur le site, revenez sur Discord et utilisez la commande `/update` pour que le bot vous attribue automatiquement votre rôle."),
                    );

                await interaction.reply({ components: [verificationContainer], flags: MessageFlags.IsComponentsV2});
                break;
            }

            case 'userid': {
                const userIdContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('### 📌 Comment Trouver Votre ID Unique de Compte'),
                        new TextDisplayBuilder().setContent("Votre ID utilisateur est un identifiant unique. Voici comment le trouver :"),
                        new TextDisplayBuilder().setContent("**1. Rendez-vous sur notre site web**\nConnectez-vous à votre compte. -> https://aaeeg.fr/login"),
                        new TextDisplayBuilder().setContent("**2. Accédez aux Paramètres Généraux**\nCliquez sur votre photo de `profil/avatar (en haut à droite)` puis sélectionnez l'option `Profile`.\nOu rendez-vous directement sur votre profil. -> https://aaeeg.fr/user"),
                        new TextDisplayBuilder().setContent("**3. Localisez l'ID Unique**\nDans la section `Infos de compte`, vous verrez une longue chaîne de caractères à côté de `ID: `"),
                        new TextDisplayBuilder().setContent("**4. Copiez votre ID**\nCopiez cette chaîne de caractères `(par exemple : 16b713b3-db2e-42d5-bd2a-881acf5cd9b8)`."),

                    )
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent("> Cet ID est parfois nécessaire pour l'aide dans les tickets. ⚠️ Ne le partagez pas publiquement. ⚠️"));

                await interaction.reply({ components: [userIdContainer], flags: MessageFlags.IsComponentsV2});
                break;
            }

            default:
                await interaction.reply({ content: 'Sous-commande non reconnue.', flags: MessageFlags.Ephemeral });
        }
    }

};

export default command;