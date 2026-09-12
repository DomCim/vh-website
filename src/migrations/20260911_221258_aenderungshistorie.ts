import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum__orders_v_version_status" AS ENUM('pending', 'paid', 'inProduction', 'shipped', 'cancelled');
  CREATE TYPE "public"."enum__orders_v_version_rueckgabe_grund" AS ENUM('storno', 'widerruf', 'reklamation');
  CREATE TYPE "public"."enum__orders_v_version_rueckgabe_status" AS ENUM('offen', 'wareZurueck', 'erstattet', 'abgelehnt');
  CREATE TYPE "public"."enum__orders_v_version_delivery_method" AS ENUM('shipping', 'pickup');
  CREATE TYPE "public"."enum__orders_v_version_payment_provider" AS ENUM('paypal', 'rechnung', 'stripe');
  CREATE TYPE "public"."enum__expenses_v_version_category" AS ENUM('material', 'werkzeug', 'fremdleistung', 'fahrzeug', 'miete', 'versicherung', 'buero', 'werbung', 'reise', 'gebuehren', 'sonstiges');
  CREATE TYPE "public"."enum__expenses_v_version_payment_method" AS ENUM('ueberweisung', 'karte', 'bar', 'lastschrift', 'paypal');
  CREATE TYPE "public"."enum__expenses_v_version_turnus" AS ENUM('nein', 'monatlich', 'vierteljaehrlich', 'jaehrlich');
  CREATE TYPE "public"."enum__expenses_v_version_extraction_status" AS ENUM('ungeprueft', 'bestaetigt', 'fehler');
  CREATE TYPE "public"."enum__quotes_v_version_status" AS ENUM('entwurf', 'versendet', 'angenommen', 'abgelehnt');
  CREATE TYPE "public"."enum__quotes_v_version_discount_kind" AS ENUM('kein', 'prozent', 'betrag');
  CREATE TYPE "public"."enum__quotes_v_version_accepted_via" AS ENUM('portal', 'buero');
  CREATE TYPE "public"."enum__outgoing_invoices_v_version_stufe" AS ENUM('vollstaendig', 'anzahlung', 'zwischen', 'schluss');
  CREATE TYPE "public"."enum__outgoing_invoices_v_version_status" AS ENUM('entwurf', 'gestellt', 'bezahlt', 'storniert');
  CREATE TYPE "public"."enum__outgoing_invoices_v_version_business_type" AS ENUM('lieferung', 'dienstleistung', 'gemischt');
  CREATE TYPE "public"."enum__outgoing_invoices_v_version_discount_kind" AS ENUM('kein', 'prozent', 'betrag');
  CREATE TYPE "public"."enum__outgoing_invoices_v_version_steuerfall" AS ENUM('inland', 'ig_lieferung', 'reverse_charge');
  ALTER TYPE "public"."enum_appointments_quelle" ADD VALUE 'mcp';
  CREATE TABLE "_orders_v_version_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"title_snapshot" varchar NOT NULL,
  	"variant_title" varchar,
  	"variant_id" varchar,
  	"color" varchar,
  	"quantity" numeric NOT NULL,
  	"unit_price" numeric NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_orders_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_order_number" varchar NOT NULL,
  	"version_absender" jsonb,
  	"version_pdf_ablage" varchar,
  	"version_status" "enum__orders_v_version_status" DEFAULT 'pending' NOT NULL,
  	"version_rueckgabe_grund" "enum__orders_v_version_rueckgabe_grund",
  	"version_rueckgabe_status" "enum__orders_v_version_rueckgabe_status",
  	"version_rueckgabe_betrag" numeric,
  	"version_rueckgabe_angefragt_am" timestamp(3) with time zone,
  	"version_rueckgabe_ware_zurueck_am" timestamp(3) with time zone,
  	"version_rueckgabe_erstattet_am" timestamp(3) with time zone,
  	"version_rueckgabe_notiz" varchar,
  	"version_expected_ready" varchar,
  	"version_tracking_number" varchar,
  	"version_tracking_url" varchar,
  	"version_access_token" varchar,
  	"version_subtotal" numeric NOT NULL,
  	"version_discount" numeric DEFAULT 0,
  	"version_shipping_total" numeric DEFAULT 0,
  	"version_total" numeric NOT NULL,
  	"version_delivery_method" "enum__orders_v_version_delivery_method" DEFAULT 'shipping' NOT NULL,
  	"version_promotion_title" varchar,
  	"version_customer_name" varchar NOT NULL,
  	"version_customer_email" varchar NOT NULL,
  	"version_customer_phone" varchar,
  	"version_shipping_address_line1" varchar,
  	"version_shipping_address_line2" varchar,
  	"version_shipping_address_postal_code" varchar,
  	"version_shipping_address_city" varchar,
  	"version_shipping_address_country" varchar DEFAULT 'Deutschland',
  	"version_shipping_address_country_code" varchar,
  	"version_payment_provider" "enum__orders_v_version_payment_provider" DEFAULT 'paypal',
  	"version_stripe_session_id" varchar,
  	"version_stripe_payment_intent_id" varchar,
  	"version_paypal_order_id" varchar,
  	"version_paypal_capture_id" varchar,
  	"version_review_requested_at" timestamp(3) with time zone,
  	"version_shipped_at" timestamp(3) with time zone,
  	"version_consent_terms_at" timestamp(3) with time zone,
  	"version_consent_waiver" boolean,
  	"version_consent_digital_at" timestamp(3) with time zone,
  	"version_customer_note" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_expenses_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_document_id" integer,
  	"version_title" varchar,
  	"version_supplier_id" integer,
  	"version_supplier_name" varchar,
  	"version_invoice_number" varchar,
  	"version_invoice_date" timestamp(3) with time zone NOT NULL,
  	"version_due_date" timestamp(3) with time zone,
  	"version_net_amount" numeric,
  	"version_vat_rate" numeric,
  	"version_vat_amount" numeric,
  	"version_gross_amount" numeric NOT NULL,
  	"version_category" "enum__expenses_v_version_category" DEFAULT 'sonstiges' NOT NULL,
  	"version_payment_method" "enum__expenses_v_version_payment_method",
  	"version_paid" boolean DEFAULT true,
  	"version_turnus" "enum__expenses_v_version_turnus" DEFAULT 'nein',
  	"version_reminder_sent_at" timestamp(3) with time zone,
  	"version_quelle_mail" varchar,
  	"version_deductible" boolean DEFAULT true,
  	"version_notes" varchar,
  	"version_extraction_status" "enum__expenses_v_version_extraction_status",
  	"version_extraction_confidence" numeric,
  	"version_extraction_note" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_quotes_v_version_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"product_id" integer,
  	"quantity" numeric DEFAULT 1 NOT NULL,
  	"unit" varchar DEFAULT 'Stück',
  	"unit_price" numeric NOT NULL,
  	"vat_rate" numeric DEFAULT 20 NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_quotes_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_quote_number" varchar,
  	"version_absender" jsonb,
  	"version_pdf_ablage" varchar,
  	"version_status" "enum__quotes_v_version_status" DEFAULT 'entwurf' NOT NULL,
  	"version_title" varchar,
  	"version_customer_id" integer,
  	"version_customer_name" varchar,
  	"version_customer_address" varchar,
  	"version_sent_at" timestamp(3) with time zone,
  	"version_last_follow_up_at" timestamp(3) with time zone,
  	"version_issue_date" timestamp(3) with time zone,
  	"version_valid_until" timestamp(3) with time zone,
  	"version_discount_kind" "enum__quotes_v_version_discount_kind" DEFAULT 'kein',
  	"version_discount_value" numeric,
  	"version_discount_reason" varchar,
  	"version_subtotal" numeric,
  	"version_discount_total" numeric,
  	"version_net_total" numeric,
  	"version_vat_total" numeric,
  	"version_total" numeric,
  	"version_revision" numeric DEFAULT 1,
  	"version_revised_at" timestamp(3) with time zone,
  	"version_accepted_at" timestamp(3) with time zone,
  	"version_accepted_via" "enum__quotes_v_version_accepted_via",
  	"version_accepted_name" varchar,
  	"version_production_time" varchar,
  	"version_note" varchar,
  	"version_inquiry_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_outgoing_invoices_v_version_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"auftrag_position" varchar,
  	"product_id" integer,
  	"quantity" numeric DEFAULT 1 NOT NULL,
  	"unit" varchar DEFAULT 'Stück',
  	"unit_price" numeric NOT NULL,
  	"vat_rate" numeric DEFAULT 20 NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_outgoing_invoices_v_version_reminders" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"level" numeric,
  	"sent_at" timestamp(3) with time zone,
  	"late_fee" numeric,
  	"frist_bis" timestamp(3) with time zone,
  	"pdf_ablage" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_outgoing_invoices_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_invoice_number" varchar,
  	"version_absender" jsonb,
  	"version_pdf_ablage" varchar,
  	"version_stufe" "enum__outgoing_invoices_v_version_stufe" DEFAULT 'vollstaendig',
  	"version_auftrag_id" integer,
  	"version_status" "enum__outgoing_invoices_v_version_status" DEFAULT 'entwurf' NOT NULL,
  	"version_customer_id" integer,
  	"version_customer_name" varchar,
  	"version_customer_siret" varchar,
  	"version_customer_vat_id" varchar,
  	"version_customer_address" varchar,
  	"version_issue_date" timestamp(3) with time zone,
  	"version_due_date" timestamp(3) with time zone,
  	"version_paid_date" timestamp(3) with time zone,
  	"version_delivery_date" timestamp(3) with time zone,
  	"version_business_type" "enum__outgoing_invoices_v_version_business_type" DEFAULT 'lieferung',
  	"version_buyer_reference" varchar,
  	"version_delivery_address" varchar,
  	"version_discount_kind" "enum__outgoing_invoices_v_version_discount_kind" DEFAULT 'kein',
  	"version_discount_value" numeric,
  	"version_discount_reason" varchar,
  	"version_discount_total" numeric,
  	"version_net_total" numeric,
  	"version_subtotal" numeric,
  	"version_vat_total" numeric,
  	"version_total" numeric,
  	"version_steuerfall" "enum__outgoing_invoices_v_version_steuerfall" DEFAULT 'inland',
  	"version_reverse_charge" boolean DEFAULT false,
  	"version_note" varchar,
  	"version_project_id" integer,
  	"version_storno_von_id" integer,
  	"version_storniert_durch_id" integer,
  	"version_storno_grund" varchar,
  	"version_quote_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "_orders_v_version_items" ADD CONSTRAINT "_orders_v_version_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_orders_v_version_items" ADD CONSTRAINT "_orders_v_version_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_orders_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_orders_v" ADD CONSTRAINT "_orders_v_parent_id_orders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_expenses_v" ADD CONSTRAINT "_expenses_v_parent_id_expenses_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_expenses_v" ADD CONSTRAINT "_expenses_v_version_document_id_media_id_fk" FOREIGN KEY ("version_document_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_expenses_v" ADD CONSTRAINT "_expenses_v_version_supplier_id_contacts_id_fk" FOREIGN KEY ("version_supplier_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_quotes_v_version_items" ADD CONSTRAINT "_quotes_v_version_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_quotes_v_version_items" ADD CONSTRAINT "_quotes_v_version_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quotes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quotes_v" ADD CONSTRAINT "_quotes_v_parent_id_quotes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_quotes_v" ADD CONSTRAINT "_quotes_v_version_customer_id_contacts_id_fk" FOREIGN KEY ("version_customer_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_quotes_v" ADD CONSTRAINT "_quotes_v_version_inquiry_id_inquiries_id_fk" FOREIGN KEY ("version_inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_outgoing_invoices_v_version_items" ADD CONSTRAINT "_outgoing_invoices_v_version_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_outgoing_invoices_v_version_items" ADD CONSTRAINT "_outgoing_invoices_v_version_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_outgoing_invoices_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_outgoing_invoices_v_version_reminders" ADD CONSTRAINT "_outgoing_invoices_v_version_reminders_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_outgoing_invoices_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_outgoing_invoices_v" ADD CONSTRAINT "_outgoing_invoices_v_parent_id_outgoing_invoices_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."outgoing_invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_outgoing_invoices_v" ADD CONSTRAINT "_outgoing_invoices_v_version_auftrag_id_jobs_id_fk" FOREIGN KEY ("version_auftrag_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_outgoing_invoices_v" ADD CONSTRAINT "_outgoing_invoices_v_version_customer_id_contacts_id_fk" FOREIGN KEY ("version_customer_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_outgoing_invoices_v" ADD CONSTRAINT "_outgoing_invoices_v_version_project_id_projects_id_fk" FOREIGN KEY ("version_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_outgoing_invoices_v" ADD CONSTRAINT "_outgoing_invoices_v_version_storno_von_id_outgoing_invoices_id_fk" FOREIGN KEY ("version_storno_von_id") REFERENCES "public"."outgoing_invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_outgoing_invoices_v" ADD CONSTRAINT "_outgoing_invoices_v_version_storniert_durch_id_outgoing_invoices_id_fk" FOREIGN KEY ("version_storniert_durch_id") REFERENCES "public"."outgoing_invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_outgoing_invoices_v" ADD CONSTRAINT "_outgoing_invoices_v_version_quote_id_quotes_id_fk" FOREIGN KEY ("version_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "_orders_v_version_items_order_idx" ON "_orders_v_version_items" USING btree ("_order");
  CREATE INDEX "_orders_v_version_items_parent_id_idx" ON "_orders_v_version_items" USING btree ("_parent_id");
  CREATE INDEX "_orders_v_version_items_product_idx" ON "_orders_v_version_items" USING btree ("product_id");
  CREATE INDEX "_orders_v_parent_idx" ON "_orders_v" USING btree ("parent_id");
  CREATE INDEX "_orders_v_version_version_order_number_idx" ON "_orders_v" USING btree ("version_order_number");
  CREATE INDEX "_orders_v_version_version_access_token_idx" ON "_orders_v" USING btree ("version_access_token");
  CREATE INDEX "_orders_v_version_version_stripe_session_id_idx" ON "_orders_v" USING btree ("version_stripe_session_id");
  CREATE INDEX "_orders_v_version_version_paypal_order_id_idx" ON "_orders_v" USING btree ("version_paypal_order_id");
  CREATE INDEX "_orders_v_version_version_updated_at_idx" ON "_orders_v" USING btree ("version_updated_at");
  CREATE INDEX "_orders_v_version_version_created_at_idx" ON "_orders_v" USING btree ("version_created_at");
  CREATE INDEX "_orders_v_version_version_deleted_at_idx" ON "_orders_v" USING btree ("version_deleted_at");
  CREATE INDEX "_orders_v_created_at_idx" ON "_orders_v" USING btree ("created_at");
  CREATE INDEX "_orders_v_updated_at_idx" ON "_orders_v" USING btree ("updated_at");
  CREATE INDEX "_expenses_v_parent_idx" ON "_expenses_v" USING btree ("parent_id");
  CREATE INDEX "_expenses_v_version_version_document_idx" ON "_expenses_v" USING btree ("version_document_id");
  CREATE INDEX "_expenses_v_version_version_supplier_idx" ON "_expenses_v" USING btree ("version_supplier_id");
  CREATE INDEX "_expenses_v_version_version_quelle_mail_idx" ON "_expenses_v" USING btree ("version_quelle_mail");
  CREATE INDEX "_expenses_v_version_version_updated_at_idx" ON "_expenses_v" USING btree ("version_updated_at");
  CREATE INDEX "_expenses_v_version_version_created_at_idx" ON "_expenses_v" USING btree ("version_created_at");
  CREATE INDEX "_expenses_v_version_version_deleted_at_idx" ON "_expenses_v" USING btree ("version_deleted_at");
  CREATE INDEX "_expenses_v_created_at_idx" ON "_expenses_v" USING btree ("created_at");
  CREATE INDEX "_expenses_v_updated_at_idx" ON "_expenses_v" USING btree ("updated_at");
  CREATE INDEX "_quotes_v_version_items_order_idx" ON "_quotes_v_version_items" USING btree ("_order");
  CREATE INDEX "_quotes_v_version_items_parent_id_idx" ON "_quotes_v_version_items" USING btree ("_parent_id");
  CREATE INDEX "_quotes_v_version_items_product_idx" ON "_quotes_v_version_items" USING btree ("product_id");
  CREATE INDEX "_quotes_v_parent_idx" ON "_quotes_v" USING btree ("parent_id");
  CREATE INDEX "_quotes_v_version_version_quote_number_idx" ON "_quotes_v" USING btree ("version_quote_number");
  CREATE INDEX "_quotes_v_version_version_customer_idx" ON "_quotes_v" USING btree ("version_customer_id");
  CREATE INDEX "_quotes_v_version_version_inquiry_idx" ON "_quotes_v" USING btree ("version_inquiry_id");
  CREATE INDEX "_quotes_v_version_version_updated_at_idx" ON "_quotes_v" USING btree ("version_updated_at");
  CREATE INDEX "_quotes_v_version_version_created_at_idx" ON "_quotes_v" USING btree ("version_created_at");
  CREATE INDEX "_quotes_v_version_version_deleted_at_idx" ON "_quotes_v" USING btree ("version_deleted_at");
  CREATE INDEX "_quotes_v_created_at_idx" ON "_quotes_v" USING btree ("created_at");
  CREATE INDEX "_quotes_v_updated_at_idx" ON "_quotes_v" USING btree ("updated_at");
  CREATE INDEX "_outgoing_invoices_v_version_items_order_idx" ON "_outgoing_invoices_v_version_items" USING btree ("_order");
  CREATE INDEX "_outgoing_invoices_v_version_items_parent_id_idx" ON "_outgoing_invoices_v_version_items" USING btree ("_parent_id");
  CREATE INDEX "_outgoing_invoices_v_version_items_auftrag_position_idx" ON "_outgoing_invoices_v_version_items" USING btree ("auftrag_position");
  CREATE INDEX "_outgoing_invoices_v_version_items_product_idx" ON "_outgoing_invoices_v_version_items" USING btree ("product_id");
  CREATE INDEX "_outgoing_invoices_v_version_reminders_order_idx" ON "_outgoing_invoices_v_version_reminders" USING btree ("_order");
  CREATE INDEX "_outgoing_invoices_v_version_reminders_parent_id_idx" ON "_outgoing_invoices_v_version_reminders" USING btree ("_parent_id");
  CREATE INDEX "_outgoing_invoices_v_parent_idx" ON "_outgoing_invoices_v" USING btree ("parent_id");
  CREATE INDEX "_outgoing_invoices_v_version_version_invoice_number_idx" ON "_outgoing_invoices_v" USING btree ("version_invoice_number");
  CREATE INDEX "_outgoing_invoices_v_version_version_auftrag_idx" ON "_outgoing_invoices_v" USING btree ("version_auftrag_id");
  CREATE INDEX "_outgoing_invoices_v_version_version_customer_idx" ON "_outgoing_invoices_v" USING btree ("version_customer_id");
  CREATE INDEX "_outgoing_invoices_v_version_version_project_idx" ON "_outgoing_invoices_v" USING btree ("version_project_id");
  CREATE INDEX "_outgoing_invoices_v_version_version_storno_von_idx" ON "_outgoing_invoices_v" USING btree ("version_storno_von_id");
  CREATE INDEX "_outgoing_invoices_v_version_version_storniert_durch_idx" ON "_outgoing_invoices_v" USING btree ("version_storniert_durch_id");
  CREATE INDEX "_outgoing_invoices_v_version_version_quote_idx" ON "_outgoing_invoices_v" USING btree ("version_quote_id");
  CREATE INDEX "_outgoing_invoices_v_version_version_updated_at_idx" ON "_outgoing_invoices_v" USING btree ("version_updated_at");
  CREATE INDEX "_outgoing_invoices_v_version_version_created_at_idx" ON "_outgoing_invoices_v" USING btree ("version_created_at");
  CREATE INDEX "_outgoing_invoices_v_version_version_deleted_at_idx" ON "_outgoing_invoices_v" USING btree ("version_deleted_at");
  CREATE INDEX "_outgoing_invoices_v_created_at_idx" ON "_outgoing_invoices_v" USING btree ("created_at");
  CREATE INDEX "_outgoing_invoices_v_updated_at_idx" ON "_outgoing_invoices_v" USING btree ("updated_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "_orders_v_version_items" CASCADE;
  DROP TABLE "_orders_v" CASCADE;
  DROP TABLE "_expenses_v" CASCADE;
  DROP TABLE "_quotes_v_version_items" CASCADE;
  DROP TABLE "_quotes_v" CASCADE;
  DROP TABLE "_outgoing_invoices_v_version_items" CASCADE;
  DROP TABLE "_outgoing_invoices_v_version_reminders" CASCADE;
  DROP TABLE "_outgoing_invoices_v" CASCADE;
  ALTER TABLE "appointments" ALTER COLUMN "quelle" SET DATA TYPE text;
  ALTER TABLE "appointments" ALTER COLUMN "quelle" SET DEFAULT 'buero'::text;
  DROP TYPE "public"."enum_appointments_quelle";
  CREATE TYPE "public"."enum_appointments_quelle" AS ENUM('buero', 'caldav');
  ALTER TABLE "appointments" ALTER COLUMN "quelle" SET DEFAULT 'buero'::"public"."enum_appointments_quelle";
  ALTER TABLE "appointments" ALTER COLUMN "quelle" SET DATA TYPE "public"."enum_appointments_quelle" USING "quelle"::"public"."enum_appointments_quelle";
  DROP TYPE "public"."enum__orders_v_version_status";
  DROP TYPE "public"."enum__orders_v_version_rueckgabe_grund";
  DROP TYPE "public"."enum__orders_v_version_rueckgabe_status";
  DROP TYPE "public"."enum__orders_v_version_delivery_method";
  DROP TYPE "public"."enum__orders_v_version_payment_provider";
  DROP TYPE "public"."enum__expenses_v_version_category";
  DROP TYPE "public"."enum__expenses_v_version_payment_method";
  DROP TYPE "public"."enum__expenses_v_version_turnus";
  DROP TYPE "public"."enum__expenses_v_version_extraction_status";
  DROP TYPE "public"."enum__quotes_v_version_status";
  DROP TYPE "public"."enum__quotes_v_version_discount_kind";
  DROP TYPE "public"."enum__quotes_v_version_accepted_via";
  DROP TYPE "public"."enum__outgoing_invoices_v_version_stufe";
  DROP TYPE "public"."enum__outgoing_invoices_v_version_status";
  DROP TYPE "public"."enum__outgoing_invoices_v_version_business_type";
  DROP TYPE "public"."enum__outgoing_invoices_v_version_discount_kind";
  DROP TYPE "public"."enum__outgoing_invoices_v_version_steuerfall";`)
}
