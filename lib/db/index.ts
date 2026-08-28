import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";

const databaseUrl = process.env.DATABASE_URL!;
export const isLocalDatabase = /localhost|127\.0\.0\.1/.test(databaseUrl);

export const db = isLocalDatabase
  ? drizzlePg(new Pool({ connectionString: databaseUrl }), { schema })
  : drizzleNeon(neon(databaseUrl), { schema });
