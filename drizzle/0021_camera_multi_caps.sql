ALTER TABLE "camera_throw" ADD COLUMN "found" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_throw" ADD COLUMN "spots" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_throw" ADD COLUMN "gone" jsonb DEFAULT '[]'::jsonb NOT NULL;