ALTER TABLE "camera_session" ADD COLUMN "share_images" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_session" ADD COLUMN "empty_url" text;--> statement-breakpoint
ALTER TABLE "camera_throw" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "camera_throw" ADD COLUMN "detector" text;