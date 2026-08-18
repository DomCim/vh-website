import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_contacts_role" AS ENUM('lieferant', 'kunde', 'beides');
  CREATE TYPE "public"."enum_expenses_category" AS ENUM('material', 'werkzeug', 'fremdleistung', 'fahrzeug', 'miete', 'versicherung', 'buero', 'werbung', 'reise', 'gebuehren', 'sonstiges');
  CREATE TYPE "public"."enum_expenses_payment_method" AS ENUM('ueberweisung', 'karte', 'bar', 'lastschrift', 'paypal');
  CREATE TYPE "public"."enum_expenses_extraction_status" AS ENUM('ungeprueft', 'bestaetigt', 'fehler');
  CREATE TYPE "public"."enum_outgoing_invoices_status" AS ENUM('entwurf', 'gestellt', 'bezahlt', 'storniert');
  CREATE TYPE "public"."enum_inventory_items_type" AS ENUM('material', 'werkzeug', 'maschine', 'fertigware', 'sonstiges');
  CREATE TYPE "public"."enum_stocktakes_status" AS ENUM('offen', 'abgeschlossen');
  CREATE TYPE "public"."enum_users_role" AS ENUM('redaktion', 'inhaber');
  CREATE TABLE "contacts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_contacts_role" DEFAULT 'beides',
  	"email" varchar,
  	"phone" varchar,
  	"line1" varchar,
  	"postal_code" varchar,
  	"city" varchar,
  	"country" varchar DEFAULT 'Frankreich',
  	"vat_id" varchar,
  	"siret" varchar,
  	"default_category" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "expenses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"document_id" integer,
  	"title" varchar,
  	"supplier_id" integer,
  	"supplier_name" varchar,
  	"invoice_number" varchar,
  	"invoice_date" timestamp(3) with time zone NOT NULL,
  	"net_amount" numeric,
  	"vat_rate" numeric,
  	"vat_amount" numeric,
  	"gross_amount" numeric NOT NULL,
  	"category" "enum_expenses_category" DEFAULT 'sonstiges' NOT NULL,
  	"payment_method" "enum_expenses_payment_method",
  	"paid" boolean DEFAULT true,
  	"deductible" boolean DEFAULT true,
  	"notes" varchar,
  	"extraction_status" "enum_expenses_extraction_status",
  	"extraction_confidence" numeric,
  	"extraction_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "outgoing_invoices_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"quantity" numeric DEFAULT 1 NOT NULL,
  	"unit" varchar DEFAULT 'Stück',
  	"unit_price" numeric NOT NULL,
  	"vat_rate" numeric DEFAULT 20 NOT NULL
  );
  
  CREATE TABLE "outgoing_invoices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"invoice_number" varchar,
  	"status" "enum_outgoing_invoices_status" DEFAULT 'entwurf' NOT NULL,
  	"customer_id" integer,
  	"customer_name" varchar,
  	"customer_address" varchar,
  	"issue_date" timestamp(3) with time zone,
  	"due_date" timestamp(3) with time zone,
  	"paid_date" timestamp(3) with time zone,
  	"subtotal" numeric,
  	"vat_total" numeric,
  	"total" numeric,
  	"reverse_charge" boolean DEFAULT false,
  	"note" varchar,
  	"project_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inventory_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"type" "enum_inventory_items_type" DEFAULT 'material' NOT NULL,
  	"quantity" numeric DEFAULT 0 NOT NULL,
  	"unit" varchar DEFAULT 'Stück',
  	"min_quantity" numeric,
  	"unit_value" numeric,
  	"location" varchar,
  	"purchase_date" timestamp(3) with time zone,
  	"purchase_value" numeric,
  	"supplier_id" integer,
  	"product_id" integer,
  	"photo_id" integer,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "stocktakes_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item_id" integer NOT NULL,
  	"expected" numeric,
  	"counted" numeric NOT NULL,
  	"unit_value" numeric,
  	"note" varchar
  );
  
  CREATE TABLE "stocktakes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"status" "enum_stocktakes_status" DEFAULT 'offen' NOT NULL,
  	"total_value" numeric,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "counters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"last_number" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'redaktion' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contacts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "expenses_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "outgoing_invoices_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inventory_items_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "stocktakes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "counters_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "company_legal_name" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "company_legal_form" varchar DEFAULT 'SAS';
  ALTER TABLE "site_settings" ADD COLUMN "company_share_capital" numeric;
  ALTER TABLE "site_settings" ADD COLUMN "company_rcs_number" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "company_rcs_city" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "company_address" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "company_payment_terms" varchar DEFAULT '30 Tage netto';
  ALTER TABLE "site_settings" ADD COLUMN "company_late_payment_note" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "company_mediator" varchar;
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_document_id_media_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_contacts_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "outgoing_invoices_items" ADD CONSTRAINT "outgoing_invoices_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."outgoing_invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "outgoing_invoices" ADD CONSTRAINT "outgoing_invoices_customer_id_contacts_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "outgoing_invoices" ADD CONSTRAINT "outgoing_invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplier_id_contacts_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stocktakes_lines" ADD CONSTRAINT "stocktakes_lines_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stocktakes_lines" ADD CONSTRAINT "stocktakes_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."stocktakes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "contacts_name_idx" ON "contacts" USING btree ("name");
  CREATE INDEX "contacts_updated_at_idx" ON "contacts" USING btree ("updated_at");
  CREATE INDEX "contacts_created_at_idx" ON "contacts" USING btree ("created_at");
  CREATE INDEX "expenses_document_idx" ON "expenses" USING btree ("document_id");
  CREATE INDEX "expenses_supplier_idx" ON "expenses" USING btree ("supplier_id");
  CREATE INDEX "expenses_updated_at_idx" ON "expenses" USING btree ("updated_at");
  CREATE INDEX "expenses_created_at_idx" ON "expenses" USING btree ("created_at");
  CREATE INDEX "outgoing_invoices_items_order_idx" ON "outgoing_invoices_items" USING btree ("_order");
  CREATE INDEX "outgoing_invoices_items_parent_id_idx" ON "outgoing_invoices_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "outgoing_invoices_invoice_number_idx" ON "outgoing_invoices" USING btree ("invoice_number");
  CREATE INDEX "outgoing_invoices_customer_idx" ON "outgoing_invoices" USING btree ("customer_id");
  CREATE INDEX "outgoing_invoices_project_idx" ON "outgoing_invoices" USING btree ("project_id");
  CREATE INDEX "outgoing_invoices_updated_at_idx" ON "outgoing_invoices" USING btree ("updated_at");
  CREATE INDEX "outgoing_invoices_created_at_idx" ON "outgoing_invoices" USING btree ("created_at");
  CREATE INDEX "inventory_items_name_idx" ON "inventory_items" USING btree ("name");
  CREATE INDEX "inventory_items_supplier_idx" ON "inventory_items" USING btree ("supplier_id");
  CREATE INDEX "inventory_items_product_idx" ON "inventory_items" USING btree ("product_id");
  CREATE INDEX "inventory_items_photo_idx" ON "inventory_items" USING btree ("photo_id");
  CREATE INDEX "inventory_items_updated_at_idx" ON "inventory_items" USING btree ("updated_at");
  CREATE INDEX "inventory_items_created_at_idx" ON "inventory_items" USING btree ("created_at");
  CREATE INDEX "stocktakes_lines_order_idx" ON "stocktakes_lines" USING btree ("_order");
  CREATE INDEX "stocktakes_lines_parent_id_idx" ON "stocktakes_lines" USING btree ("_parent_id");
  CREATE INDEX "stocktakes_lines_item_idx" ON "stocktakes_lines" USING btree ("item_id");
  CREATE INDEX "stocktakes_updated_at_idx" ON "stocktakes" USING btree ("updated_at");
  CREATE INDEX "stocktakes_created_at_idx" ON "stocktakes" USING btree ("created_at");
  CREATE UNIQUE INDEX "counters_key_idx" ON "counters" USING btree ("key");
  CREATE INDEX "counters_updated_at_idx" ON "counters" USING btree ("updated_at");
  CREATE INDEX "counters_created_at_idx" ON "counters" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contacts_fk" FOREIGN KEY ("contacts_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_expenses_fk" FOREIGN KEY ("expenses_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_outgoing_invoices_fk" FOREIGN KEY ("outgoing_invoices_id") REFERENCES "public"."outgoing_invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inventory_items_fk" FOREIGN KEY ("inventory_items_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stocktakes_fk" FOREIGN KEY ("stocktakes_id") REFERENCES "public"."stocktakes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_counters_fk" FOREIGN KEY ("counters_id") REFERENCES "public"."counters"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_contacts_id_idx" ON "payload_locked_documents_rels" USING btree ("contacts_id");
  CREATE INDEX "payload_locked_documents_rels_expenses_id_idx" ON "payload_locked_documents_rels" USING btree ("expenses_id");
  CREATE INDEX "payload_locked_documents_rels_outgoing_invoices_id_idx" ON "payload_locked_documents_rels" USING btree ("outgoing_invoices_id");
  CREATE INDEX "payload_locked_documents_rels_inventory_items_id_idx" ON "payload_locked_documents_rels" USING btree ("inventory_items_id");
  CREATE INDEX "payload_locked_documents_rels_stocktakes_id_idx" ON "payload_locked_documents_rels" USING btree ("stocktakes_id");
  CREATE INDEX "payload_locked_documents_rels_counters_id_idx" ON "payload_locked_documents_rels" USING btree ("counters_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "contacts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "expenses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "outgoing_invoices_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "outgoing_invoices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inventory_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "stocktakes_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "stocktakes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "counters" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "contacts" CASCADE;
  DROP TABLE "expenses" CASCADE;
  DROP TABLE "outgoing_invoices_items" CASCADE;
  DROP TABLE "outgoing_invoices" CASCADE;
  DROP TABLE "inventory_items" CASCADE;
  DROP TABLE "stocktakes_lines" CASCADE;
  DROP TABLE "stocktakes" CASCADE;
  DROP TABLE "counters" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_contacts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_expenses_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_outgoing_invoices_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_inventory_items_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_stocktakes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_counters_fk";
  
  DROP INDEX "payload_locked_documents_rels_contacts_id_idx";
  DROP INDEX "payload_locked_documents_rels_expenses_id_idx";
  DROP INDEX "payload_locked_documents_rels_outgoing_invoices_id_idx";
  DROP INDEX "payload_locked_documents_rels_inventory_items_id_idx";
  DROP INDEX "payload_locked_documents_rels_stocktakes_id_idx";
  DROP INDEX "payload_locked_documents_rels_counters_id_idx";
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contacts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "expenses_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "outgoing_invoices_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "inventory_items_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "stocktakes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "counters_id";
  ALTER TABLE "site_settings" DROP COLUMN "company_legal_name";
  ALTER TABLE "site_settings" DROP COLUMN "company_legal_form";
  ALTER TABLE "site_settings" DROP COLUMN "company_share_capital";
  ALTER TABLE "site_settings" DROP COLUMN "company_rcs_number";
  ALTER TABLE "site_settings" DROP COLUMN "company_rcs_city";
  ALTER TABLE "site_settings" DROP COLUMN "company_address";
  ALTER TABLE "site_settings" DROP COLUMN "company_payment_terms";
  ALTER TABLE "site_settings" DROP COLUMN "company_late_payment_note";
  ALTER TABLE "site_settings" DROP COLUMN "company_mediator";
  DROP TYPE "public"."enum_contacts_role";
  DROP TYPE "public"."enum_expenses_category";
  DROP TYPE "public"."enum_expenses_payment_method";
  DROP TYPE "public"."enum_expenses_extraction_status";
  DROP TYPE "public"."enum_outgoing_invoices_status";
  DROP TYPE "public"."enum_inventory_items_type";
  DROP TYPE "public"."enum_stocktakes_status";
  DROP TYPE "public"."enum_users_role";`)
}
