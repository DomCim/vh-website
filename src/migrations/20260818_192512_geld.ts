import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_newsletter_subscribers_status" AS ENUM('offen', 'bestaetigt', 'abgemeldet');
  CREATE TYPE "public"."enum_newsletter_subscribers_locale" AS ENUM('de', 'fr', 'en');
  CREATE TABLE "newsletter_subscribers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"status" "enum_newsletter_subscribers_status" DEFAULT 'offen' NOT NULL,
  	"locale" "enum_newsletter_subscribers_locale" DEFAULT 'de',
  	"token" varchar,
  	"confirmed_at" timestamp(3) with time zone,
  	"unsubscribed_at" timestamp(3) with time zone,
  	"source" varchar,
  	"last_mail_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "outgoing_invoices_reminders" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"level" numeric,
  	"sent_at" timestamp(3) with time zone,
  	"late_fee" numeric
  );
  
  ALTER TABLE "testimonials" ADD COLUMN "pending" boolean DEFAULT false;
  ALTER TABLE "testimonials" ADD COLUMN "submitted_email" varchar;
  ALTER TABLE "testimonials" ADD COLUMN "order_number" varchar;
  ALTER TABLE "orders" ADD COLUMN "review_requested_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamp(3) with time zone;
  ALTER TABLE "quotes" ADD COLUMN "sent_at" timestamp(3) with time zone;
  ALTER TABLE "quotes" ADD COLUMN "last_follow_up_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "newsletter_subscribers_id" integer;
  ALTER TABLE "outgoing_invoices_reminders" ADD CONSTRAINT "outgoing_invoices_reminders_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."outgoing_invoices"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsletter_subscribers_email_idx" ON "newsletter_subscribers" USING btree ("email");
  CREATE INDEX "newsletter_subscribers_token_idx" ON "newsletter_subscribers" USING btree ("token");
  CREATE INDEX "newsletter_subscribers_updated_at_idx" ON "newsletter_subscribers" USING btree ("updated_at");
  CREATE INDEX "newsletter_subscribers_created_at_idx" ON "newsletter_subscribers" USING btree ("created_at");
  CREATE INDEX "outgoing_invoices_reminders_order_idx" ON "outgoing_invoices_reminders" USING btree ("_order");
  CREATE INDEX "outgoing_invoices_reminders_parent_id_idx" ON "outgoing_invoices_reminders" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_newsletter_subscribers_fk" FOREIGN KEY ("newsletter_subscribers_id") REFERENCES "public"."newsletter_subscribers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_newsletter_subscribers_id_idx" ON "payload_locked_documents_rels" USING btree ("newsletter_subscribers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "newsletter_subscribers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "outgoing_invoices_reminders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "newsletter_subscribers" CASCADE;
  DROP TABLE "outgoing_invoices_reminders" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_newsletter_subscribers_fk";
  
  DROP INDEX "payload_locked_documents_rels_newsletter_subscribers_id_idx";
  ALTER TABLE "testimonials" DROP COLUMN "pending";
  ALTER TABLE "testimonials" DROP COLUMN "submitted_email";
  ALTER TABLE "testimonials" DROP COLUMN "order_number";
  ALTER TABLE "orders" DROP COLUMN "review_requested_at";
  ALTER TABLE "orders" DROP COLUMN "shipped_at";
  ALTER TABLE "quotes" DROP COLUMN "sent_at";
  ALTER TABLE "quotes" DROP COLUMN "last_follow_up_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "newsletter_subscribers_id";
  DROP TYPE "public"."enum_newsletter_subscribers_status";
  DROP TYPE "public"."enum_newsletter_subscribers_locale";`)
}
