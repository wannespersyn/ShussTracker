CREATE TYPE "public"."rotation_mode" AS ENUM('americano', 'mexicano');--> statement-breakpoint
CREATE TABLE "rotation_game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rotation_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"idx" integer NOT NULL,
	"a1" uuid NOT NULL,
	"a2" uuid NOT NULL,
	"b1" uuid NOT NULL,
	"b2" uuid NOT NULL,
	"game_id" uuid,
	CONSTRAINT "rotation_game_rotation_id_round_idx_unique" UNIQUE("rotation_id","round","idx")
);
--> statement-breakpoint
CREATE TABLE "rotation_player" (
	"rotation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "rotation_player_rotation_id_user_id_pk" PRIMARY KEY("rotation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "rotation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mode" "rotation_mode" NOT NULL,
	"mats" integer DEFAULT 1 NOT NULL,
	"rounds" integer NOT NULL,
	"status" "tournament_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rotation_game" ADD CONSTRAINT "rotation_game_rotation_id_rotation_id_fk" FOREIGN KEY ("rotation_id") REFERENCES "public"."rotation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_game" ADD CONSTRAINT "rotation_game_a1_user_id_fk" FOREIGN KEY ("a1") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_game" ADD CONSTRAINT "rotation_game_a2_user_id_fk" FOREIGN KEY ("a2") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_game" ADD CONSTRAINT "rotation_game_b1_user_id_fk" FOREIGN KEY ("b1") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_game" ADD CONSTRAINT "rotation_game_b2_user_id_fk" FOREIGN KEY ("b2") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_game" ADD CONSTRAINT "rotation_game_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_player" ADD CONSTRAINT "rotation_player_rotation_id_rotation_id_fk" FOREIGN KEY ("rotation_id") REFERENCES "public"."rotation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_player" ADD CONSTRAINT "rotation_player_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation" ADD CONSTRAINT "rotation_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation" ADD CONSTRAINT "rotation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;