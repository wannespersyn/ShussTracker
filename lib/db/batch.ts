import { db, isLocalDatabase } from "@/lib/db";

type Statement = PromiseLike<unknown>;

/** Runs a set of insert/update/delete statements atomically, regardless of
 * which driver `db` is. Against Neon (prod) there's no interactive
 * transaction over HTTP, so the statements go out as a single `.batch`
 * round-trip; against local Postgres (dev) they run inside a real
 * transaction. `build` receives the executor to construct every statement
 * against — a `tx` locally, `db` itself against Neon — so the local path is
 * a genuine transaction with rollback on failure, not just sequential
 * awaits. */
export async function runAtomic<T extends Statement>(build: (executor: typeof db) => T[]): Promise<void> {
  if (isLocalDatabase) {
    await db.transaction(async (tx) => {
      for (const statement of build(tx as unknown as typeof db)) {
        await statement;
      }
    });
  } else {
    const statements = build(db);
    await (db as unknown as { batch: (statements: T[]) => Promise<unknown> }).batch(statements);
  }
}
