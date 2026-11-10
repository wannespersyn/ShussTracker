CREATE TABLE "camera_zone_fix" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"fix" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "camera_zone_fix" ADD CONSTRAINT "camera_zone_fix_session_id_camera_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."camera_session"("id") ON DELETE cascade ON UPDATE no action;