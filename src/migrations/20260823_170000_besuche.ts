import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Der Zugang zu Plausibles Ereignis-Datenbank — für die einzelnen
 * Besuchswege (siehe `lib/besuche.ts`).
 *
 * Vier Felder am Global „Integrationen", alle dürfen leer bleiben: Ohne
 * Adresse bleibt die Seite „Einzelne Besuche" aus, und das ist der Zustand,
 * solange der Container nicht ins Netz der Statistik darf. Gezählt und
 * ausgewertet wird davon unabhängig weiter.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" ADD COLUMN "plausible_ch_url" varchar;
  ALTER TABLE "integrations" ADD COLUMN "plausible_ch_datenbank" varchar;
  ALTER TABLE "integrations" ADD COLUMN "plausible_ch_benutzer" varchar;
  ALTER TABLE "integrations" ADD COLUMN "plausible_ch_passwort" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" DROP COLUMN "plausible_ch_url";
  ALTER TABLE "integrations" DROP COLUMN "plausible_ch_datenbank";
  ALTER TABLE "integrations" DROP COLUMN "plausible_ch_benutzer";
  ALTER TABLE "integrations" DROP COLUMN "plausible_ch_passwort";`)
}
