import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Wohin eine Fehlermeldung aus dem Büro geht.
 *
 * Zwei Spalten am Global „Integrationen": Repository und Zugangswort. Beide
 * dürfen leer bleiben — dann erscheint im Büro kein Melde-Knopf, und das ist
 * der vorgesehene Zustand, solange kein Zugangswort vergeben ist.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" ADD COLUMN "github_repository" varchar;
  ALTER TABLE "integrations" ADD COLUMN "github_token" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" DROP COLUMN "github_repository";
  ALTER TABLE "integrations" DROP COLUMN "github_token";`)
}
