ALTER TABLE "camera_session" ADD COLUMN "kind" text DEFAULT 'test' NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_session" ADD COLUMN "logger_id" uuid;--> statement-breakpoint
ALTER TABLE "camera_session" ADD COLUMN "armed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_session" ADD COLUMN "arm_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_throw" ADD COLUMN "label" jsonb;--> statement-breakpoint
ALTER TABLE "camera_throw" ADD COLUMN "label_how" text;--> statement-breakpoint
ALTER TABLE "camera_session" ADD CONSTRAINT "camera_session_logger_id_user_id_fk" FOREIGN KEY ("logger_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;