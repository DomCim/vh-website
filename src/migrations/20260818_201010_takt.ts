import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" ADD COLUMN "wartung_aktiv" boolean DEFAULT true;
  ALTER TABLE "integrations" ADD COLUMN "wartung_interval_minuten" numeric DEFAULT 15;
  ALTER TABLE "integrations" ADD COLUMN "wartung_postfach_minuten" numeric DEFAULT 5;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" DROP COLUMN "wartung_aktiv";
  ALTER TABLE "integrations" DROP COLUMN "wartung_interval_minuten";
  ALTER TABLE "integrations" DROP COLUMN "wartung_postfach_minuten";`)
}
