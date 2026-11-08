import { Sequelize } from 'sequelize';

// Env vars are loaded by `import 'dotenv/config'` at the top of bot.ts.

const sequelize = new Sequelize(process.env.DATABASE_URL as string, {
  dialect: 'postgres',
  logging: false,
});

export const connectToDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('[Postgresql] Connection has been established successfully.');
  } catch (error) {
    console.error('[Postgresql] Unable to connect to the database:', error);
  }
};

export default sequelize;