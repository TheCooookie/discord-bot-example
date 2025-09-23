import { Client, EmbedBuilder } from 'discord.js';
import sequelize from '../data/database';
import { DataTypes, Model, Op } from 'sequelize';
import taskRunner from '../utils/task';
import { processInBatches } from '../utils/batch';
import config from '../config';
import { logToChannel } from '../utils/logToChannel';

class User extends Model {
    declare id: string;
    declare verificationExpires: Date;
}
User.init({
    id: { type: DataTypes.UUID, primaryKey: true },
    verificationExpires: { type: DataTypes.DATE, allowNull: true },
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
const GUILD_ID = config.GUILD_ID;

function toDateOnly(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * @async
 * @function checkVerificationTask
 * @description A scheduled task that checks for expiring user verifications.
 * It removes the `VERIFICATION_ROLE_ID` from members whose verification has expired,
 * and sends notifications for verifications expiring in 30 days.
 * @param {Client} discordClient The Discord client instance.
 * @returns {Promise<void>} A promise that resolves when all applicable users have been processed.
 */
async function checkVerificationTask(discordClient: Client) {
    const today = toDateOnly(new Date());

    const users = await User.findAll({
        where: {
            verificationExpires: { [Op.ne]: null }
        }
    });

    await processInBatches(users, 50, 5000, async user => {
        const expDate = toDateOnly(new Date(user.verificationExpires));
        const diffDays = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const account = await Account.findOne({
            where: { userId: user.id, provider: 'discord' }
        });
        if (!account) return;

        try {
            const guild = await discordClient.guilds.fetch(GUILD_ID);
            const member = await guild.members.fetch(account.providerAccountId);

            if (diffDays === 1) {
                if (member.roles.cache.has(VERIFICATION_ROLE_ID)) {
                    await member.roles.remove(VERIFICATION_ROLE_ID);
                    console.log(`[CheckVerification] Removed verified role from ${member.user.tag} (expired)`);
                    await logToChannel(discordClient, {
                        title: 'Verification Expired',
                        description: `Removed verified role from **${member.user.tag}** (\`${member.id}\`) - verification expired.`,
                        color: 0xff0000
                    });
                }
                return;
            }

            if (diffDays === 31) {
                try {
                    const embed = new EmbedBuilder()
                            .setTitle('La vérification sur le serveur AAE ESPORT & GAMING va expirer.')
                            .setDescription(
                                'Votre vérification expire dans 30 jours.\n' +
                                'Pour continuer à bénéficier de votre rôle Vérifé, vous pouvez vous re-verifier sur:\n' +
                                'https://aaeeg.fr/user/verify'
                            )
                            .setThumbnail('https://i.imgur.com/wkxEhKp.png')
                            .setColor('Red')
                            .setTimestamp();
                    //await member.send({ embeds: [embed] });
                    console.log(`[CheckVerification] Notified ${member.user.tag} about expiring verification.`);
                    await logToChannel(discordClient, {
                        title: 'Verification Expiring Soon',
                        description: `Notified **${member.user.tag}** (\`${member.id}\`) about verification expiring in 30 days.`,
                        color: 0xffa500
                    });
                } catch (e) {
                    console.warn(`[CheckVerification] Could not DM ${member.user.tag}.`);
                    await logToChannel(discordClient, {
                        title: 'DM Failed',
                        description: `Could not DM **${member.user.tag}** (\`${member.id}\`) about expiring verification.`,
                        color: 0xffa500
                    });
                }
            }
            
        } catch (err) {
            console.warn(`[CheckVerification] Could not process user ${user.id}:`);
        }
    });
}

/**
 * @function default
 * @description Schedules the `checkVerificationTask` to run periodically.
 * This function is the main export for setting up the verification check task.
 * @param {Client} client The Discord client instance to pass to the task function.
 * @returns {void}
 */
export default function (client: Client) {
    // Run every 24 hours (24 * 60 * 60 * 1000 ms)
    taskRunner.scheduleTask(
        'checkVerificationTask',
        24 * 60 * 60 * 1000,
        () => checkVerificationTask(client),
        true
    );
};