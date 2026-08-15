CREATE TYPE "public"."tournament_bracket" AS ENUM('winners', 'losers', 'grand_final', 'round_robin');--> statement-breakpoint
CREATE TYPE "public"."tournament_format" AS ENUM('single_elim', 'double_elim', 'round_robin');--> statement-breakpoint
CREATE TYPE "public"."tournament_match_slot" AS ENUM('a', 'b');--> statement-breakpoint
ALTER TABLE "tournament_match" DROP CONSTRAINT "tournament_match_tournament_id_round_slot_unique";--> statement-breakpoint
ALTER TABLE "tournament_match" ADD COLUMN "bracket" "tournament_bracket" DEFAULT 'winners' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD COLUMN "winner_next_match_id" uuid;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD COLUMN "winner_next_slot" "tournament_match_slot";--> statement-breakpoint
ALTER TABLE "tournament_match" ADD COLUMN "loser_next_match_id" uuid;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD COLUMN "loser_next_slot" "tournament_match_slot";--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "format" "tournament_format" DEFAULT 'single_elim' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD CONSTRAINT "tournament_match_winner_next_match_id_tournament_match_id_fk" FOREIGN KEY ("winner_next_match_id") REFERENCES "public"."tournament_match"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD CONSTRAINT "tournament_match_loser_next_match_id_tournament_match_id_fk" FOREIGN KEY ("loser_next_match_id") REFERENCES "public"."tournament_match"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD CONSTRAINT "tournament_match_tournament_id_bracket_round_slot_unique" UNIQUE("tournament_id","bracket","round","slot");