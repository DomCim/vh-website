import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Anmelden mit Benutzernamen: Das Werkstatt-Tablet gehört keiner Person, ein
 * Konto „werkstatt" braucht keine eigene Mail-Adresse. Die E-Mail-Spalte
 * verliert dafür ihre Pflicht — wer eine hat, behält sie, sie bleibt der Weg
 * für „Passwort vergessen".
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
  ALTER TABLE "users" ADD COLUMN "username" varchar;
  CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "users_username_idx";
  ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
  ALTER TABLE "users" DROP COLUMN "username";`)
}
