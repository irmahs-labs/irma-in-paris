import { Pool } from "pg";
import type { PoolClient } from "pg";

/** Runs `work` in one transaction: every write lands, or none does. */
export const inTransaction = async <T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");

    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const connect = (databaseUrl: string) =>
  new Pool({ connectionString: databaseUrl });
