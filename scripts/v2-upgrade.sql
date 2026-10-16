-- Shussapp v2 upgrade — run ONCE in the Neon SQL editor (or psql) before
-- deploying the redesign-v2 branch. Safe to re-run: every step is guarded.
--
-- Why not `drizzle-kit migrate`? Production has 0004–0006 applied but not
-- recorded in drizzle.__drizzle_migrations (they were pushed), so migrate
-- would try to re-create the rivalry table and abort. This script applies
-- 0007–0009 idempotently and then records 0004–0009, after which
-- `drizzle-kit migrate` works normally again for future migrations.

BEGIN;

-- 0007 game photo
ALTER TABLE "game" ADD COLUMN IF NOT EXISTS "photo_url" text;

-- 0008 crew plans + feedback
DO $$ BEGIN
  CREATE TYPE "public"."crew_plan" AS ENUM('free', 'founding', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "public"."feedback_status" AS ENUM('new', 'under_review', 'planned', 'in_progress', 'done', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "public"."feedback_type" AS ENUM('bug', 'idea', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "public"."user"("id") ON DELETE set null,
  "group_id" uuid REFERENCES "public"."group"("id") ON DELETE set null,
  "type" "feedback_type" NOT NULL,
  "text" text NOT NULL,
  "status" "feedback_status" DEFAULT 'new' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "feedback_vote" (
  "feedback_id" uuid NOT NULL REFERENCES "public"."feedback"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "public"."user"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "feedback_vote_feedback_id_user_id_pk" PRIMARY KEY("feedback_id","user_id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'group' AND column_name = 'plan') THEN
    ALTER TABLE "group" ADD COLUMN "plan" "crew_plan" DEFAULT 'free' NOT NULL;
    ALTER TABLE "group" ADD COLUMN "pro_until" timestamp;
    -- Every crew that exists at v2 launch becomes a Founding Crew: Pro free for a year.
    UPDATE "group" SET "plan" = 'founding', "pro_until" = now() + interval '1 year';
  END IF;
END $$;

-- 0009 events & rivalries removed (both empty)
ALTER TABLE "game" DROP COLUMN IF EXISTS "event_id";
ALTER TABLE "tournament" DROP COLUMN IF EXISTS "event_id";
DROP TABLE IF EXISTS "rivalry";
DROP TABLE IF EXISTS "event";

-- Record 0004–0009 so `drizzle-kit migrate` lines up from here on.
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'e0660776ca478a683d064808b102f1aec1d8d63196ea797214b22a05ec45d4e5', 1787846844036 WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1787846844036); -- 0004_salty_rictor
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'b01d6d6826800a21347844accc74db30d72a6f8da1e09fceb4c3bc010e166dd5', 1787848039781 WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1787848039781); -- 0005_confused_zaladane
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT 'cc4e06518faec73430d69983ab9c75d5d02084ee37795a1cf2a85697d93d1ca5', 1787848728952 WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1787848728952); -- 0006_woozy_natasha_romanoff
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT '3306671f6678dfaa92e6082b64389439710e07566866b801cf741596d2caf6c5', 1792177947143 WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1792177947143); -- 0007_game_photo
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT '2793fce55473c2fe1ccc01510282ba9f6622012e3231531b2a5818a4d0f96d1e', 1792178470267 WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1792178470267); -- 0008_plans_feedback
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT '0728a766f1e87af6b0c27b4dc0c2caf1b283a3ad90b85c777e8a427126d1d60f', 1792178958563 WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1792178958563); -- 0009_drop_events_rivalries

COMMIT;
