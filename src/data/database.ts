import { Sequelize } from 'sequelize';

// Example Postgres connection. Not used yet: call connectToDatabase() from bot.ts to enable it.
const sequelize = new Sequelize(process.env.DATABASE_URL as string, {
  dialect: 'postgres',
  logging: false,
});

/** Checks the database connection. Throws if it fails, so the bot does not start without it. */
export const connectToDatabase = async () => {
  await sequelize.authenticate();
  console.log('[Postgresql] Connection has been established successfully.');
};

export default sequelize;
