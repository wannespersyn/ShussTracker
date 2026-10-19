CREATE TYPE "public"."crew_plan" AS ENUM('free', 'founding', 'pro');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('new', 'under_review', 'planned', 'in_progress', 'done', 'declined');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('bug', 'idea', 'other');--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"group_id" uuid,
	"type" "feedback_type" NOT NULL,
	"text" text NOT NULL,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_vote" (
	"feedback_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_vote_feedback_id_user_id_pk" PRIMARY KEY("feedback_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "plan" "crew_plan" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "pro_until" timestamp;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_vote" ADD CONSTRAINT "feedback_vote_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_vote" ADD CONSTRAINT "feedback_vote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Every crew that exists at v2 launch becomes a Founding Crew: Pro free for a year.
UPDATE "group" SET "plan" = 'founding', "pro_until" = now() + interval '1 year';
