CREATE TABLE "agent_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text DEFAULT 'weekly' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"metrics" jsonb NOT NULL,
	"narrative_md" text,
	"recommendations" jsonb,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent" text NOT NULL,
	"kind" text NOT NULL,
	"task_id" uuid,
	"status" text DEFAULT 'running' NOT NULL,
	"items_in" integer DEFAULT 0 NOT NULL,
	"items_out" integer DEFAULT 0 NOT NULL,
	"ai_tokens" integer DEFAULT 0 NOT NULL,
	"cost_millicents" integer DEFAULT 0 NOT NULL,
	"summary" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body_md" text NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"agent_generated" boolean DEFAULT true NOT NULL,
	"approved_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"status" text NOT NULL,
	"step_index" integer,
	"subject" text,
	"body_text" text NOT NULL,
	"body_html" text,
	"from_email" text,
	"to_email" text,
	"message_id" text,
	"in_reply_to" text,
	"provider_message_id" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"error" text,
	"ai_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid,
	"contact_id" uuid,
	"agent" text DEFAULT 'conversationalist' NOT NULL,
	"campaign" text DEFAULT 'default' NOT NULL,
	"to_email" text NOT NULL,
	"subject" text,
	"status" text DEFAULT 'active' NOT NULL,
	"step_index" integer DEFAULT 0 NOT NULL,
	"next_action_at" timestamp with time zone,
	"last_outbound_at" timestamp with time zone,
	"last_inbound_at" timestamp with time zone,
	"lead_id" uuid,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_threads_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "prospect_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" text,
	"is_role_account" boolean DEFAULT false NOT NULL,
	"verification" text DEFAULT 'unknown' NOT NULL,
	"verified_at" timestamp with time zone,
	"source_url" text,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"domain" text,
	"place_id" text,
	"phone" text,
	"address" text,
	"city" text,
	"emirate" text,
	"sector" text,
	"size_hint" text,
	"mandate_wave" text,
	"score" integer,
	"score_reason" text,
	"status" text DEFAULT 'discovered' NOT NULL,
	"source" text DEFAULT 'places' NOT NULL,
	"raw" jsonb,
	"lead_id" uuid,
	"last_crawled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phrase" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"last_position" integer,
	"last_checked_at" timestamp with time zone,
	"has_gap" boolean DEFAULT false NOT NULL,
	"covered_by_path" text,
	"source" text DEFAULT 'seed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"domain" text,
	"reason" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visibility_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"domain" text,
	"title" text,
	"snippet" text,
	"query" text,
	"status" text DEFAULT 'discovered' NOT NULL,
	"draft" text,
	"notes" text,
	"meta" jsonb,
	"actioned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_thread_id_outreach_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."outreach_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_threads" ADD CONSTRAINT "outreach_threads_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_threads" ADD CONSTRAINT "outreach_threads_contact_id_prospect_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."prospect_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_threads" ADD CONSTRAINT "outreach_threads_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_contacts" ADD CONSTRAINT "prospect_contacts_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_reports_period_idx" ON "agent_reports" USING btree ("kind","period_start");--> statement-breakpoint
CREATE INDEX "agent_runs_agent_started_idx" ON "agent_runs" USING btree ("agent","started_at");--> statement-breakpoint
CREATE INDEX "agent_tasks_claim_idx" ON "agent_tasks" USING btree ("status","run_after","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_tasks_dedupe_idx" ON "agent_tasks" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_slug_locale_idx" ON "articles" USING btree ("slug","locale");--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "outreach_messages_thread_idx" ON "outreach_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "outreach_messages_status_idx" ON "outreach_messages" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "outreach_threads_next_action_idx" ON "outreach_threads" USING btree ("status","next_action_at");--> statement-breakpoint
CREATE INDEX "outreach_threads_email_idx" ON "outreach_threads" USING btree ("to_email");--> statement-breakpoint
CREATE UNIQUE INDEX "prospect_contacts_email_idx" ON "prospect_contacts" USING btree ("prospect_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_domain_idx" ON "prospects" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_place_idx" ON "prospects" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "prospects_status_score_idx" ON "prospects" USING btree ("status","score");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_keywords_phrase_idx" ON "seo_keywords" USING btree ("phrase","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "suppressions_email_idx" ON "suppressions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "suppressions_domain_idx" ON "suppressions" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "visibility_targets_url_idx" ON "visibility_targets" USING btree ("kind","url");--> statement-breakpoint
CREATE INDEX "visibility_targets_status_idx" ON "visibility_targets" USING btree ("status");