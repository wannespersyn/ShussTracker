ALTER TABLE "rotation_player" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "rotation_player" ADD COLUMN "joined_round" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "rotation" ADD COLUMN "tiebreaks" text DEFAULT 'pct,wins,mama,elo' NOT NULL;