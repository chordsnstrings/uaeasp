ALTER TABLE "analytics_events" ADD COLUMN "visitor_id" text;--> statement-breakpoint
CREATE INDEX "analytics_events_session_created_idx" ON "analytics_events" USING btree ("session_id","created_at");