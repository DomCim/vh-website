import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Der Stand der Anmeldung bei einer Plateforme Agréée.
 *
 * Kein technisches Feld, sondern ein Merkposten mit Datum: Ab dem
 * 1. September 2026 müssen elektronische Rechnungen über eine zugelassene
 * Plattform ankommen. Lesen und Schreiben kann das Haus längst — die
 * Anmeldung ist eine Unterschrift, und was nirgends steht, geht unter.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_integrations_erechnung_stand" AS ENUM('offen', 'beauftragt', 'registriert');
  ALTER TABLE "integrations" ADD COLUMN "erechnung_stand" "enum_integrations_erechnung_stand" DEFAULT 'offen';
  ALTER TABLE "integrations" ADD COLUMN "erechnung_plattform" varchar;
  ALTER TABLE "integrations" ADD COLUMN "erechnung_kennung" varchar;
  ALTER TABLE "integrations" ADD COLUMN "erechnung_registriert_am" timestamp(3) with time zone;
  ALTER TABLE "integrations" ADD COLUMN "erechnung_notiz" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" DROP COLUMN "erechnung_stand";
  ALTER TABLE "integrations" DROP COLUMN "erechnung_plattform";
  ALTER TABLE "integrations" DROP COLUMN "erechnung_kennung";
  ALTER TABLE "integrations" DROP COLUMN "erechnung_registriert_am";
  ALTER TABLE "integrations" DROP COLUMN "erechnung_notiz";
  DROP TYPE "public"."enum_integrations_erechnung_stand";`)
}
