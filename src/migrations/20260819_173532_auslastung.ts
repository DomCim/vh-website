import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Zwei Zahlen für die Wochen-Auslastung: Was ein Auftrag an Werkstattzeit
 * zusagt, und wie viele Stunden die Woche überhaupt hergibt.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jobs" ADD COLUMN "planned_minutes" numeric;
  ALTER TABLE "site_settings" ADD COLUMN "craft_weekly_hours" numeric DEFAULT 30;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jobs" DROP COLUMN "planned_minutes";
  ALTER TABLE "site_settings" DROP COLUMN "craft_weekly_hours";`)
}
