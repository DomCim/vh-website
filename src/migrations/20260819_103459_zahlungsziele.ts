import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" ADD COLUMN "zahlungsziele_anzahlung_tage" numeric DEFAULT 7;
  ALTER TABLE "integrations" ADD COLUMN "zahlungsziele_zwischen_tage" numeric DEFAULT 14;
  ALTER TABLE "integrations" ADD COLUMN "zahlungsziele_schluss_tage" numeric DEFAULT 14;
  ALTER TABLE "integrations" ADD COLUMN "zahlungsziele_platz_freigeben_nach_tagen" numeric DEFAULT 21;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" DROP COLUMN "zahlungsziele_anzahlung_tage";
  ALTER TABLE "integrations" DROP COLUMN "zahlungsziele_zwischen_tage";
  ALTER TABLE "integrations" DROP COLUMN "zahlungsziele_schluss_tage";
  ALTER TABLE "integrations" DROP COLUMN "zahlungsziele_platz_freigeben_nach_tagen";`)
}
