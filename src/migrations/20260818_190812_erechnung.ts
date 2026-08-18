import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_outgoing_invoices_business_type" AS ENUM('lieferung', 'dienstleistung', 'gemischt');
  ALTER TABLE "outgoing_invoices" ADD COLUMN "customer_siret" varchar;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "customer_vat_id" varchar;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "delivery_date" timestamp(3) with time zone;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "business_type" "enum_outgoing_invoices_business_type" DEFAULT 'lieferung';
  ALTER TABLE "outgoing_invoices" ADD COLUMN "buyer_reference" varchar;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "delivery_address" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "company_iban" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "company_bic" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "company_vat_on_debits" boolean;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "outgoing_invoices" DROP COLUMN "customer_siret";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "customer_vat_id";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "delivery_date";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "business_type";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "buyer_reference";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "delivery_address";
  ALTER TABLE "site_settings" DROP COLUMN "company_iban";
  ALTER TABLE "site_settings" DROP COLUMN "company_bic";
  ALTER TABLE "site_settings" DROP COLUMN "company_vat_on_debits";
  DROP TYPE "public"."enum_outgoing_invoices_business_type";`)
}
