import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" ADD COLUMN "google_reviews_merchant_id" varchar;
  ALTER TABLE "integrations" ADD COLUMN "google_reviews_lieferzeit_tage" numeric DEFAULT 28;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" DROP COLUMN "google_reviews_merchant_id";
  ALTER TABLE "integrations" DROP COLUMN "google_reviews_lieferzeit_tage";`)
}
