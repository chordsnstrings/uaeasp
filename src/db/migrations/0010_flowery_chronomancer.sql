ALTER TABLE "seo_keywords" ADD COLUMN "impressions" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "seo_keywords" ADD COLUMN "clicks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "seo_keywords" ADD COLUMN "ranking_path" text;