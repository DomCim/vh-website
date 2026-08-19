import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Stückliste und Arbeitszeit je Variante — dazu die Variantenkennung an der
 * Bestellposition.
 *
 * Die Kennung ist der Punkt: Die Bezeichnung einer Variante ist übersetzt und
 * änderbar, taugt also nicht, um Monate später zu sagen, welche Stückliste für
 * ein bestelltes Stück galt.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "products_variants_bill_of_materials" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item_id" integer,
  	"quantity" numeric,
  	"note" varchar
  );
  
  ALTER TABLE "products_variants" ADD COLUMN "production_minutes" numeric;
  ALTER TABLE "orders_items" ADD COLUMN "variant_id" varchar;
  ALTER TABLE "products_variants_bill_of_materials" ADD CONSTRAINT "products_variants_bill_of_materials_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_variants_bill_of_materials" ADD CONSTRAINT "products_variants_bill_of_materials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_variants"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_variants_bill_of_materials_order_idx" ON "products_variants_bill_of_materials" USING btree ("_order");
  CREATE INDEX "products_variants_bill_of_materials_parent_id_idx" ON "products_variants_bill_of_materials" USING btree ("_parent_id");
  CREATE INDEX "products_variants_bill_of_materials_item_idx" ON "products_variants_bill_of_materials" USING btree ("item_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "products_variants_bill_of_materials" CASCADE;
  ALTER TABLE "products_variants" DROP COLUMN "production_minutes";
  ALTER TABLE "orders_items" DROP COLUMN "variant_id";`)
}
