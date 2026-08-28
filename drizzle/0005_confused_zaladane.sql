CREATE TABLE "rivalry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"a_player1_id" uuid NOT NULL,
	"a_player2_id" uuid,
	"b_player1_id" uuid NOT NULL,
	"b_player2_id" uuid
);
--> statement-breakpoint
ALTER TABLE "rivalry" ADD CONSTRAINT "rivalry_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rivalry" ADD CONSTRAINT "rivalry_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rivalry" ADD CONSTRAINT "rivalry_a_player1_id_user_id_fk" FOREIGN KEY ("a_player1_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rivalry" ADD CONSTRAINT "rivalry_a_player2_id_user_id_fk" FOREIGN KEY ("a_player2_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rivalry" ADD CONSTRAINT "rivalry_b_player1_id_user_id_fk" FOREIGN KEY ("b_player1_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rivalry" ADD CONSTRAINT "rivalry_b_player2_id_user_id_fk" FOREIGN KEY ("b_player2_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;