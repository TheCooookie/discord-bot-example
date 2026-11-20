import { Pool } from 'pg';

// Example Postgres pool. Not used yet: call connectToDatabase() from bot.ts to enable it.
// The pool opens connections on first use, so importing this file connects to nothing.
// Always pass values as parameters, never in the SQL string:
//   await pool.query('SELECT * FROM guild_settings WHERE guild_id = $1', [guildId]);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Checks the database connection. Throws if it fails, so the bot does not start without it. */
export async function connectToDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('[Postgres] DATABASE_URL is not set.');
  await pool.query('SELECT 1');
  console.log('[Postgres] Connection established.');
}

export default pool;
