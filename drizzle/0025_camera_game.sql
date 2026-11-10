CREATE TABLE "camera_game" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "camera_game" ADD CONSTRAINT "camera_game_session_id_camera_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."camera_session"("id") ON DELETE cascade ON UPDATE no action;