import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Was zum Nachbestellen an einem Posten fehlt: die übliche Bestellmenge, die
 * Artikelnummer beim Lieferanten und der Merker, dass schon bestellt ist.
 *
 * Der Merker ist der wichtigste Teil: Zwischen „bestellt" und „liegt im Regal"
 * vergehen Tage, in denen der Bestand weiter unter dem Mindestbestand steht.
 * Ohne ihn stünde die Anfrage jeden Morgen wieder auf der Liste.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "inventory_items" ADD COLUMN "order_quantity" numeric;
  ALTER TABLE "inventory_items" ADD COLUMN "supplier_ref" varchar;
  ALTER TABLE "inventory_items" ADD COLUMN "reordered_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "inventory_items" DROP COLUMN "order_quantity";
  ALTER TABLE "inventory_items" DROP COLUMN "supplier_ref";
  ALTER TABLE "inventory_items" DROP COLUMN "reordered_at";`)
}
