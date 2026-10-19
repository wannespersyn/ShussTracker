-- Migrations 0010 + 0011 (push notifications, per-device language) for when you'd rather paste SQL than
-- run `drizzle-kit migrate`. Safe to re-run.
BEGIN;
CREATE TABLE IF NOT EXISTS "push_subscription" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."user"("id") ON DELETE cascade,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'b089c8dc4451158a8f36771a38325bb90d0e1573f4727e7bb354388f8a4bff2a', 1792342680135 WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1792342680135);
ALTER TABLE "push_subscription" ADD COLUMN IF NOT EXISTS "locale" text DEFAULT 'en' NOT NULL;
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT '2600faf28c934e9fa2f4ee4470202a5c3a1fc91a84252244c0549b820108316e', 1792411314388 WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1792411314388);
COMMIT;
