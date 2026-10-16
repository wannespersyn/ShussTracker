-- v2: events and rivalries are gone (both tables were empty in production).
ALTER TABLE "game" DROP CONSTRAINT IF EXISTS "game_event_id_event_id_fk";--> statement-breakpoint
ALTER TABLE "tournament" DROP CONSTRAINT IF EXISTS "tournament_event_id_event_id_fk";--> statement-breakpoint
ALTER TABLE "game" DROP COLUMN IF EXISTS "event_id";--> statement-breakpoint
ALTER TABLE "tournament" DROP COLUMN IF EXISTS "event_id";--> statement-breakpoint
DROP TABLE IF EXISTS "rivalry";--> statement-breakpoint
DROP TABLE IF EXISTS "event";
