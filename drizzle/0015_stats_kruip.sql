-- Beta-3 mat logger columns (jokers, ad fundum, knocked-out mamas) were added to
-- the schema without a migration; IF NOT EXISTS keeps this safe on a DB that
-- already got them via `drizzle-kit push`.
ALTER TYPE "public"."field_hit" ADD VALUE IF NOT EXISTS 'mama_out';--> statement-breakpoint
ALTER TABLE "game_round" ADD COLUMN IF NOT EXISTS "joker_team_id" uuid;--> statement-breakpoint
ALTER TABLE "game_round" ADD COLUMN IF NOT EXISTS "all_drink" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_round" ADD CONSTRAINT "game_round_joker_team_id_game_team_id_fk" FOREIGN KEY ("joker_team_id") REFERENCES "public"."game_team"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
-- Stats v3: kruipen (per team: lost without drinking anything).
ALTER TABLE "game_team" ADD COLUMN IF NOT EXISTS "kruip" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill from games already logged with the mat logger.
UPDATE "game_team" gt SET "kruip" = true
WHERE gt.final_rank IS DISTINCT FROM 1
  AND EXISTS (SELECT 1 FROM "game_round" r WHERE r.game_id = gt.game_id)
  AND NOT EXISTS (
    SELECT 1 FROM "game_round" r
    JOIN "game_round_team" rt ON rt.round_id = r.id AND rt.game_team_id = gt.id
    WHERE r.complete AND (r.all_drink OR (r.joker_team_id IS NULL AND (rt.sips > 0 OR rt.mama)))
  );
