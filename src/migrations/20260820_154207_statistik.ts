import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "analytics_eigene_zaehlung" boolean DEFAULT false;
  ALTER TABLE "integrations" ADD COLUMN "plausible_url" varchar;
  ALTER TABLE "integrations" ADD COLUMN "plausible_seite" varchar;
  ALTER TABLE "integrations" ADD COLUMN "plausible_api_key" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "analytics_eigene_zaehlung";
  ALTER TABLE "integrations" DROP COLUMN "plausible_url";
  ALTER TABLE "integrations" DROP COLUMN "plausible_seite";
  ALTER TABLE "integrations" DROP COLUMN "plausible_api_key";`)
}
