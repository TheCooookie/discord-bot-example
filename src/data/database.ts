import { Sequelize } from 'sequelize';

// Example Postgres connection. Not used yet: call connectToDatabase() from bot.ts to enable it.
const sequelize = new Sequelize(process.env.DATABASE_URL as string, {
  dialect: 'postgres',
  logging: false,
});

/** Checks the database connection and logs the result. */
export const connectToDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('[Postgresql] Connection has been established successfully.');
  } catch (error) {
    console.error('[Postgresql] Unable to connect to the database:', error);
  }
};

export default sequelize;
