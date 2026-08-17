import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "projects" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "site_settings" ADD COLUMN "company_siret" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "company_vat_id" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "company_vat_rate" numeric DEFAULT 20;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "site_settings" DROP COLUMN "company_siret";
  ALTER TABLE "site_settings" DROP COLUMN "company_vat_id";
  ALTER TABLE "site_settings" DROP COLUMN "company_vat_rate";`)
}
