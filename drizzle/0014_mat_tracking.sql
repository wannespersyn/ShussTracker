CREATE TABLE "cap_move" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"throw_id" uuid NOT NULL,
	"cap_no" integer NOT NULL,
	"cap_owner_id" uuid NOT NULL,
	"is_thrown_cap" boolean NOT NULL,
	"from_x" integer,
	"from_y" integer,
	"from_spot" text NOT NULL,
	"to_x" integer,
	"to_y" integer,
	"to_spot" text NOT NULL,
	"to_counts_for" uuid
);
--> statement-breakpoint
CREATE TABLE "game_round_team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"game_team_id" uuid NOT NULL,
	"sips" integer DEFAULT 0 NOT NULL,
	"mama" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_round" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"complete" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_throw" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"game_team_player_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"kind" text NOT NULL,
	"skip_reason" text,
	"cap_no" integer
);
--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "mat_a1_corner" text;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "ended_by" text;--> statement-breakpoint
ALTER TABLE "cap_move" ADD CONSTRAINT "cap_move_throw_id_game_throw_id_fk" FOREIGN KEY ("throw_id") REFERENCES "public"."game_throw"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cap_move" ADD CONSTRAINT "cap_move_cap_owner_id_game_team_player_id_fk" FOREIGN KEY ("cap_owner_id") REFERENCES "public"."game_team_player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cap_move" ADD CONSTRAINT "cap_move_to_counts_for_game_team_id_fk" FOREIGN KEY ("to_counts_for") REFERENCES "public"."game_team"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_round_team" ADD CONSTRAINT "game_round_team_round_id_game_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_round_team" ADD CONSTRAINT "game_round_team_game_team_id_game_team_id_fk" FOREIGN KEY ("game_team_id") REFERENCES "public"."game_team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_round" ADD CONSTRAINT "game_round_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_throw" ADD CONSTRAINT "game_throw_round_id_game_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_throw" ADD CONSTRAINT "game_throw_game_team_player_id_game_team_player_id_fk" FOREIGN KEY ("game_team_player_id") REFERENCES "public"."game_team_player"("id") ON DELETE cascade ON UPDATE no action;