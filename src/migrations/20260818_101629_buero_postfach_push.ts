import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_quotes_status" AS ENUM('entwurf', 'versendet', 'angenommen', 'abgelehnt');
  CREATE TYPE "public"."enum_jobs_status" AS ENUM('geplant', 'inFertigung', 'fertig', 'geliefert', 'abgebrochen');
  CREATE TYPE "public"."enum_jobs_source" AS ENUM('shop', 'angebot', 'manuell');
  CREATE TYPE "public"."enum_mail_log_status" AS ENUM('gesendet', 'fehler', 'ohneVersand');
  CREATE TYPE "public"."enum_mail_log_kind" AS ENUM('bestellung', 'fertigung', 'versand', 'anfrage', 'zugangscode', 'postfach', 'sonstiges');
  ALTER TYPE "public"."enum_contacts_role" ADD VALUE 'dienstleister' BEFORE 'beides';
  CREATE TABLE "products_bill_of_materials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item_id" integer NOT NULL,
  	"quantity" numeric NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "products_service_providers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"contact_id" integer NOT NULL,
  	"service" varchar NOT NULL,
  	"cost" numeric,
  	"lead_time" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "quotes_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"quantity" numeric DEFAULT 1 NOT NULL,
  	"unit" varchar DEFAULT 'Stück',
  	"unit_price" numeric NOT NULL,
  	"vat_rate" numeric DEFAULT 20 NOT NULL
  );
  
  CREATE TABLE "quotes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"quote_number" varchar,
  	"status" "enum_quotes_status" DEFAULT 'entwurf' NOT NULL,
  	"title" varchar,
  	"customer_id" integer,
  	"customer_name" varchar,
  	"customer_address" varchar,
  	"issue_date" timestamp(3) with time zone,
  	"valid_until" timestamp(3) with time zone,
  	"subtotal" numeric,
  	"vat_total" numeric,
  	"total" numeric,
  	"production_time" varchar,
  	"note" varchar,
  	"inquiry_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "jobs_positions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"quantity" numeric DEFAULT 1,
  	"price" numeric
  );
  
  CREATE TABLE "jobs_material" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item_id" integer NOT NULL,
  	"quantity" numeric NOT NULL
  );
  
  CREATE TABLE "jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"job_number" varchar,
  	"status" "enum_jobs_status" DEFAULT 'geplant' NOT NULL,
  	"title" varchar NOT NULL,
  	"source" "enum_jobs_source" DEFAULT 'manuell' NOT NULL,
  	"customer_name" varchar,
  	"contact_id" integer,
  	"start_date" timestamp(3) with time zone,
  	"due_date" timestamp(3) with time zone,
  	"material_gebucht" boolean DEFAULT false,
  	"notes" varchar,
  	"order_id" integer,
  	"quote_id" integer,
  	"invoice_id" integer,
  	"project_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mail_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"to" varchar NOT NULL,
  	"from" varchar,
  	"subject" varchar NOT NULL,
  	"status" "enum_mail_log_status" DEFAULT 'gesendet' NOT NULL,
  	"kind" "enum_mail_log_kind" DEFAULT 'sonstiges',
  	"error" varchar,
  	"attachments" varchar,
  	"order_id" integer,
  	"inquiry_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "push_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"endpoint" varchar NOT NULL,
  	"p256dh" varchar NOT NULL,
  	"auth" varchar NOT NULL,
  	"label" varchar,
  	"user_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "integrations_mailboxes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"address" varchar NOT NULL,
  	"is_default" boolean DEFAULT false,
  	"imap_host" varchar NOT NULL,
  	"imap_port" numeric DEFAULT 993,
  	"imap_secure" boolean DEFAULT true,
  	"user" varchar NOT NULL,
  	"pass" varchar NOT NULL,
  	"sent_mailbox" varchar DEFAULT 'Sent',
  	"trash_mailbox" varchar DEFAULT 'Trash',
  	"smtp_host" varchar,
  	"smtp_port" numeric,
  	"smtp_user" varchar,
  	"smtp_pass" varchar
  );
  
  ALTER TABLE "outgoing_invoices" ADD COLUMN "quote_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "quotes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "jobs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mail_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_subscriptions_id" integer;
  ALTER TABLE "integrations" ADD COLUMN "push_public_key" varchar;
  ALTER TABLE "integrations" ADD COLUMN "push_private_key" varchar;
  ALTER TABLE "integrations" ADD COLUMN "push_subject" varchar DEFAULT 'mailto:info@vincent-hellmann.com';
  ALTER TABLE "integrations" ADD COLUMN "anthropic_api_key" varchar;
  ALTER TABLE "integrations" ADD COLUMN "anthropic_model" varchar DEFAULT 'claude-opus-5';
  ALTER TABLE "products_bill_of_materials" ADD CONSTRAINT "products_bill_of_materials_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_bill_of_materials" ADD CONSTRAINT "products_bill_of_materials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_service_providers" ADD CONSTRAINT "products_service_providers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_service_providers" ADD CONSTRAINT "products_service_providers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes_items" ADD CONSTRAINT "quotes_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_contacts_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs_positions" ADD CONSTRAINT "jobs_positions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "jobs_material" ADD CONSTRAINT "jobs_material_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs_material" ADD CONSTRAINT "jobs_material_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_invoice_id_outgoing_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."outgoing_invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mail_log" ADD CONSTRAINT "mail_log_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mail_log" ADD CONSTRAINT "mail_log_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "integrations_mailboxes" ADD CONSTRAINT "integrations_mailboxes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_bill_of_materials_order_idx" ON "products_bill_of_materials" USING btree ("_order");
  CREATE INDEX "products_bill_of_materials_parent_id_idx" ON "products_bill_of_materials" USING btree ("_parent_id");
  CREATE INDEX "products_bill_of_materials_item_idx" ON "products_bill_of_materials" USING btree ("item_id");
  CREATE INDEX "products_service_providers_order_idx" ON "products_service_providers" USING btree ("_order");
  CREATE INDEX "products_service_providers_parent_id_idx" ON "products_service_providers" USING btree ("_parent_id");
  CREATE INDEX "products_service_providers_contact_idx" ON "products_service_providers" USING btree ("contact_id");
  CREATE INDEX "quotes_items_order_idx" ON "quotes_items" USING btree ("_order");
  CREATE INDEX "quotes_items_parent_id_idx" ON "quotes_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "quotes_quote_number_idx" ON "quotes" USING btree ("quote_number");
  CREATE INDEX "quotes_customer_idx" ON "quotes" USING btree ("customer_id");
  CREATE INDEX "quotes_inquiry_idx" ON "quotes" USING btree ("inquiry_id");
  CREATE INDEX "quotes_updated_at_idx" ON "quotes" USING btree ("updated_at");
  CREATE INDEX "quotes_created_at_idx" ON "quotes" USING btree ("created_at");
  CREATE INDEX "jobs_positions_order_idx" ON "jobs_positions" USING btree ("_order");
  CREATE INDEX "jobs_positions_parent_id_idx" ON "jobs_positions" USING btree ("_parent_id");
  CREATE INDEX "jobs_material_order_idx" ON "jobs_material" USING btree ("_order");
  CREATE INDEX "jobs_material_parent_id_idx" ON "jobs_material" USING btree ("_parent_id");
  CREATE INDEX "jobs_material_item_idx" ON "jobs_material" USING btree ("item_id");
  CREATE UNIQUE INDEX "jobs_job_number_idx" ON "jobs" USING btree ("job_number");
  CREATE INDEX "jobs_contact_idx" ON "jobs" USING btree ("contact_id");
  CREATE INDEX "jobs_order_idx" ON "jobs" USING btree ("order_id");
  CREATE INDEX "jobs_quote_idx" ON "jobs" USING btree ("quote_id");
  CREATE INDEX "jobs_invoice_idx" ON "jobs" USING btree ("invoice_id");
  CREATE INDEX "jobs_project_idx" ON "jobs" USING btree ("project_id");
  CREATE INDEX "jobs_updated_at_idx" ON "jobs" USING btree ("updated_at");
  CREATE INDEX "jobs_created_at_idx" ON "jobs" USING btree ("created_at");
  CREATE INDEX "mail_log_to_idx" ON "mail_log" USING btree ("to");
  CREATE INDEX "mail_log_status_idx" ON "mail_log" USING btree ("status");
  CREATE INDEX "mail_log_kind_idx" ON "mail_log" USING btree ("kind");
  CREATE INDEX "mail_log_order_idx" ON "mail_log" USING btree ("order_id");
  CREATE INDEX "mail_log_inquiry_idx" ON "mail_log" USING btree ("inquiry_id");
  CREATE INDEX "mail_log_updated_at_idx" ON "mail_log" USING btree ("updated_at");
  CREATE INDEX "mail_log_created_at_idx" ON "mail_log" USING btree ("created_at");
  CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
  CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");
  CREATE INDEX "push_subscriptions_updated_at_idx" ON "push_subscriptions" USING btree ("updated_at");
  CREATE INDEX "push_subscriptions_created_at_idx" ON "push_subscriptions" USING btree ("created_at");
  CREATE INDEX "integrations_mailboxes_order_idx" ON "integrations_mailboxes" USING btree ("_order");
  CREATE INDEX "integrations_mailboxes_parent_id_idx" ON "integrations_mailboxes" USING btree ("_parent_id");
  ALTER TABLE "outgoing_invoices" ADD CONSTRAINT "outgoing_invoices_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quotes_fk" FOREIGN KEY ("quotes_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_jobs_fk" FOREIGN KEY ("jobs_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mail_log_fk" FOREIGN KEY ("mail_log_id") REFERENCES "public"."mail_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk" FOREIGN KEY ("push_subscriptions_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "outgoing_invoices_quote_idx" ON "outgoing_invoices" USING btree ("quote_id");
  CREATE INDEX "payload_locked_documents_rels_quotes_id_idx" ON "payload_locked_documents_rels" USING btree ("quotes_id");
  CREATE INDEX "payload_locked_documents_rels_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("jobs_id");
  CREATE INDEX "payload_locked_documents_rels_mail_log_id_idx" ON "payload_locked_documents_rels" USING btree ("mail_log_id");
  CREATE INDEX "payload_locked_documents_rels_push_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("push_subscriptions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_bill_of_materials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_service_providers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quotes_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quotes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "jobs_positions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "jobs_material" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "jobs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mail_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "push_subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "integrations_mailboxes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products_bill_of_materials" CASCADE;
  DROP TABLE "products_service_providers" CASCADE;
  DROP TABLE "quotes_items" CASCADE;
  DROP TABLE "quotes" CASCADE;
  DROP TABLE "jobs_positions" CASCADE;
  DROP TABLE "jobs_material" CASCADE;
  DROP TABLE "jobs" CASCADE;
  DROP TABLE "mail_log" CASCADE;
  DROP TABLE "push_subscriptions" CASCADE;
  DROP TABLE "integrations_mailboxes" CASCADE;
  ALTER TABLE "outgoing_invoices" DROP CONSTRAINT "outgoing_invoices_quote_id_quotes_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_quotes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_jobs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mail_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk";
  
  ALTER TABLE "contacts" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "contacts" ALTER COLUMN "role" SET DEFAULT 'beides'::text;
  DROP TYPE "public"."enum_contacts_role";
  CREATE TYPE "public"."enum_contacts_role" AS ENUM('lieferant', 'kunde', 'beides');
  ALTER TABLE "contacts" ALTER COLUMN "role" SET DEFAULT 'beides'::"public"."enum_contacts_role";
  ALTER TABLE "contacts" ALTER COLUMN "role" SET DATA TYPE "public"."enum_contacts_role" USING "role"::"public"."enum_contacts_role";
  DROP INDEX "outgoing_invoices_quote_idx";
  DROP INDEX "payload_locked_documents_rels_quotes_id_idx";
  DROP INDEX "payload_locked_documents_rels_jobs_id_idx";
  DROP INDEX "payload_locked_documents_rels_mail_log_id_idx";
  DROP INDEX "payload_locked_documents_rels_push_subscriptions_id_idx";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "quote_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "quotes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "jobs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mail_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "push_subscriptions_id";
  ALTER TABLE "integrations" DROP COLUMN "push_public_key";
  ALTER TABLE "integrations" DROP COLUMN "push_private_key";
  ALTER TABLE "integrations" DROP COLUMN "push_subject";
  ALTER TABLE "integrations" DROP COLUMN "anthropic_api_key";
  ALTER TABLE "integrations" DROP COLUMN "anthropic_model";
  DROP TYPE "public"."enum_quotes_status";
  DROP TYPE "public"."enum_jobs_status";
  DROP TYPE "public"."enum_jobs_source";
  DROP TYPE "public"."enum_mail_log_status";
  DROP TYPE "public"."enum_mail_log_kind";`)
}
