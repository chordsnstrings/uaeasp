CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'sns' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "webhook_events_received_idx" ON "webhook_events" USING btree ("received_at");