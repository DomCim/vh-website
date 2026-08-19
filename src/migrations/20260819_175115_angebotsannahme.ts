import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Wann, von wem und auf welchem Weg ein Angebot angenommen wurde.
 *
 * Der Weg ist der Punkt: „telefonisch" ist eine Angabe, „im Kundenportal
 * angenommen" ist ein Beleg.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_quotes_accepted_via" AS ENUM('portal', 'buero');
  ALTER TABLE "quotes" ADD COLUMN "accepted_at" timestamp(3) with time zone;
  ALTER TABLE "quotes" ADD COLUMN "accepted_via" "enum_quotes_accepted_via";
  ALTER TABLE "quotes" ADD COLUMN "accepted_name" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quotes" DROP COLUMN "accepted_at";
  ALTER TABLE "quotes" DROP COLUMN "accepted_via";
  ALTER TABLE "quotes" DROP COLUMN "accepted_name";
  DROP TYPE "public"."enum_quotes_accepted_via";`)
}
