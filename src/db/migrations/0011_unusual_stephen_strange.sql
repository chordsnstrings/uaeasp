ALTER TABLE "outreach_messages" ADD COLUMN "track_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD COLUMN "open_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD COLUMN "first_click_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD COLUMN "click_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_track_token_unique" UNIQUE("track_token");