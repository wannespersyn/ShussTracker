ALTER TABLE "feedback" ADD COLUMN "feature" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "beta_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "beta_joined_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "beta_disabled" text[] DEFAULT '{}'::text[] NOT NULL;