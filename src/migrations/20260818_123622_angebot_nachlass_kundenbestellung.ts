import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_quotes_discount_kind" AS ENUM('kein', 'prozent', 'betrag');
  CREATE TYPE "public"."enum_outgoing_invoices_discount_kind" AS ENUM('kein', 'prozent', 'betrag');
  ALTER TABLE "quotes" ADD COLUMN "discount_kind" "enum_quotes_discount_kind" DEFAULT 'kein';
  ALTER TABLE "quotes" ADD COLUMN "discount_value" numeric;
  ALTER TABLE "quotes" ADD COLUMN "discount_reason" varchar;
  ALTER TABLE "quotes" ADD COLUMN "discount_total" numeric;
  ALTER TABLE "quotes" ADD COLUMN "net_total" numeric;
  ALTER TABLE "quotes" ADD COLUMN "revision" numeric DEFAULT 1;
  ALTER TABLE "quotes" ADD COLUMN "revised_at" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "customer_order_ref" varchar;
  ALTER TABLE "jobs" ADD COLUMN "ordered_at" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "confirmed_at" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "order_document_id" integer;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "discount_kind" "enum_outgoing_invoices_discount_kind" DEFAULT 'kein';
  ALTER TABLE "outgoing_invoices" ADD COLUMN "discount_value" numeric;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "discount_reason" varchar;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "discount_total" numeric;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "net_total" numeric;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_order_document_id_media_id_fk" FOREIGN KEY ("order_document_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "jobs_order_document_idx" ON "jobs" USING btree ("order_document_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jobs" DROP CONSTRAINT "jobs_order_document_id_media_id_fk";
  
  DROP INDEX "jobs_order_document_idx";
  ALTER TABLE "quotes" DROP COLUMN "discount_kind";
  ALTER TABLE "quotes" DROP COLUMN "discount_value";
  ALTER TABLE "quotes" DROP COLUMN "discount_reason";
  ALTER TABLE "quotes" DROP COLUMN "discount_total";
  ALTER TABLE "quotes" DROP COLUMN "net_total";
  ALTER TABLE "quotes" DROP COLUMN "revision";
  ALTER TABLE "quotes" DROP COLUMN "revised_at";
  ALTER TABLE "jobs" DROP COLUMN "customer_order_ref";
  ALTER TABLE "jobs" DROP COLUMN "ordered_at";
  ALTER TABLE "jobs" DROP COLUMN "confirmed_at";
  ALTER TABLE "jobs" DROP COLUMN "order_document_id";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "discount_kind";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "discount_value";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "discount_reason";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "discount_total";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "net_total";
  DROP TYPE "public"."enum_quotes_discount_kind";
  DROP TYPE "public"."enum_outgoing_invoices_discount_kind";`)
}
