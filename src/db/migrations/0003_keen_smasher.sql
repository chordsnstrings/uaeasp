CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"name" text,
	"path" text NOT NULL,
	"locale" text,
	"session_id" text NOT NULL,
	"referrer_host" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"device" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_type_created_idx" ON "analytics_events" USING btree ("type","created_at");