ALTER TABLE "providers" ADD COLUMN "contacts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "category" text;