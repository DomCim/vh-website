import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jobs" ADD COLUMN "zahlplan_anzahlung_prozent" numeric DEFAULT 0;
  ALTER TABLE "jobs" ADD COLUMN "zahlplan_zwischen_prozent" numeric DEFAULT 0;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jobs" DROP COLUMN "zahlplan_anzahlung_prozent";
  ALTER TABLE "jobs" DROP COLUMN "zahlplan_zwischen_prozent";`)
}
