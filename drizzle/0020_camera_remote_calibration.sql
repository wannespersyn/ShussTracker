ALTER TABLE "camera_session" ADD COLUMN "phase" text DEFAULT 'calibrating' NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_session" ADD COLUMN "snapshot" text;--> statement-breakpoint
ALTER TABLE "camera_session" ADD COLUMN "snap_w" integer;--> statement-breakpoint
ALTER TABLE "camera_session" ADD COLUMN "snap_h" integer;--> statement-breakpoint
ALTER TABLE "camera_session" ADD COLUMN "snap_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_session" ADD COLUMN "snap_request" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_session" ADD COLUMN "corners" jsonb;