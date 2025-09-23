import { Client } from 'discord.js';
import sequelize from '../data/database';
import { DataTypes, Model } from 'sequelize';
import taskRunner from '../utils/task';
import config from '../config';
import { logToChannel } from '../utils/logToChannel'

/**
 * @class UpdateQueue
 * @augments {Model}
 * @description Represents an entry in the update queue for user verification or account association.
 * This model stores pending actions related to user accounts that need to be processed.
 */
class User extends Model {
    declare id: string;
    declare tier: string | null;
}
User.init({
    id: { type: DataTypes.UUID, primaryKey: true },
    tier: { type: DataTypes.STRING, allowNull: true },
}, { sequelize, tableName: 'User', timestamps: false });

class UpdateQueue extends Model {
    declare id: number;
    declare userId: string;
    declare type: 'VERIFICATION' | 'ASSOCIATION';
    declare data?: string;
}
UpdateQueue.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.UUID, allowNull: true },
    type: { type: DataTypes.ENUM('VERIFICATION', 'ASSOCIATION'), allowNull: false },
    data: { type: DataTypes.TEXT, allowNull: true },
}, {
    sequelize,
    tableName: 'UpdateQueue',
    timestamps: false,
});

class Account extends Model {
    declare userId: string;
    declare provider: string;
    declare providerAccountId: string;
}
Account.init({
    userId: { type: DataTypes.UUID, allowNull: false },
    provider: { type: DataTypes.TEXT, allowNull: false },
    providerAccountId: { type: DataTypes.TEXT, allowNull: false },
}, {
    sequelize,
    tableName: 'Account',
    timestamps: false,
});

UpdateQueue.hasMany(Account, { foreignKey: 'userId', sourceKey: 'userId', as: 'linkedAccounts' });
Account.belongsTo(UpdateQueue, { foreignKey: 'userId', targetKey: 'userId' });

const MEMBERSHIP_ROLE_ID = config.MEMBERSHIP_ROLE_ID;
const VERIFICATION_ROLE_ID = config.VERIFICATION_ROLE_ID;
const PATREON_ROLE_ID = config.PATREON_ROLE_ID;
const SPONSOR_ROLE_ID = config.SPONSOR_ROLE_ID;
const GUILD_ID = config.GUILD_ID!;

/**
 * Checks the `UpdateQueue` for pending Discord-related account updates
 * (verification or association) and applies the corresponding Discord roles.
 *
 * It fetches updates that are linked to a 'discord' account, then iterates
 * through them to add the appropriate role (VERIFICATION or MEMBERSHIP) to
 * the Discord member. Successful updates are removed from the queue.
 *
 * @param {Client} discordClient The Discord client instance, used to fetch guild and member data.
 * @returns {Promise<void>} A promise that resolves when all applicable updates have been processed or attempted.
 */
async function checkUpdateQueueForDiscordAccounts(discordClient: Client) {
    const updates = await UpdateQueue.findAll({
        where: { type: ['VERIFICATION', 'ASSOCIATION'] },
        include: [{
            model: Account,
            as: 'linkedAccounts',
            where: { provider: 'discord' },
            required: true
        }]
    });

    if (updates.length === 0) {
        return;
    }

    for (const update of updates as any[]) {
        const discordAccount = update.linkedAccounts[0];
        const discordUserId = discordAccount.providerAccountId;

        try {
            const guild = await discordClient.guilds.fetch(GUILD_ID);
            const member = await guild.members.fetch(discordUserId);

            switch (update.type) {
                case 'VERIFICATION':
                    await member.roles.add(VERIFICATION_ROLE_ID);
                    console.log(`[GiveRoleTask] Gave VERIFICATION role to Discord user ${discordUserId}`);
                    await logToChannel(discordClient, {
                        title: 'Role Given',
                        description: `Gave **VERIFICATION** role to <@${discordUserId}> (\`${discordUserId}\`).`,
                        color: 0x00ccff
                    });
                    break;
                case 'ASSOCIATION': {
                    // Fetch the user from the database
                    const user = await User.findOne({ where: { id: update.userId } });
                    if (!user || !user.tier) {
                        console.warn(`[GiveRoleTask] No user or tier found for userId ${update.userId}`);
                        await logToChannel(discordClient, {
                            title: 'Role Assignment Failed',
                            description: `No user or tier found for userId \`${update.userId}\`.`,
                            color: 0xffa500
                        });
                        break;
                    }
                    const tier = user.tier.toUpperCase();
                    let roleId: string | undefined;
                    switch (tier) {
                        case 'MEMBERSHIP':
                            roleId = MEMBERSHIP_ROLE_ID;
                            break;
                        case 'PATREON':
                            roleId = PATREON_ROLE_ID;
                            break;
                        case 'SPONSOR':
                            roleId = SPONSOR_ROLE_ID;
                            break;
                        default:
                            console.warn(`[GiveRoleTask] Unknown tier: ${user.tier} for userId ${update.userId}`);
                            await logToChannel(discordClient, {
                                title: 'Unknown Tier',
                                description: `Unknown tier: \`${user.tier}\` for userId \`${update.userId}\`.`,
                                color: 0xffa500
                        });
                            break;
                    }
                    if (roleId) {
                        await member.roles.add(roleId);
                        console.log(`[GiveRoleTask] Gave ${tier} role to Discord user ${discordUserId}`);
                        await logToChannel(discordClient, {
                            title: 'Role Given',
                            description: `Gave **${tier}** role to <@${discordUserId}> (\`${discordUserId}\`).`,
                            color: 0x00ccff
                        });
                    }
                    break;
                }
                default:
                    console.warn(`[GiveRoleTask] Unknown update type: ${update.type} for Discord user ${discordUserId}`);
                    await logToChannel(discordClient, {
                        title: 'Unknown Update Type',
                        description: `Unknown update type: \`${update.type}\` for Discord user <@${discordUserId}> (\`${discordUserId}\`).`,
                        color: 0xffa500
                    });
                    break;
            }

            await update.destroy();
        } catch (err) {
            console.error(`[GiveRoleTask] Failed to give role to Discord user ${discordUserId}:`, err);
            await logToChannel(discordClient, {
                title: 'Role Assignment Error',
                description: `Failed to give role to <@${discordUserId}> (\`${discordUserId}\`): ${err}`,
                color: 0xff0000
            });
        }
    }
}

/**
 * Sets up a scheduled task to periodically check the update queue for Discord role assignments.
 * This function is intended to be called during the bot's initialization phase.
 *
 * @param {Client} client The Discord client instance.
 * @returns {void}
 */
export default function (client: Client) {
    // Run every 1 min (60 * 1000 ms)
    taskRunner.scheduleTask(
        'checkUpdateQueueForDiscordAccounts',
        60 * 1000,
        () => checkUpdateQueueForDiscordAccounts(client),
        true
    );
}