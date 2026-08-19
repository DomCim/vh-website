import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Zwei Dinge:
 *
 * Fremdleistung je Variante — Verzinken kostet nach Gewicht, Beschichten nach
 * Fläche; ein großes Stück ist dort teurer als ein kleines.
 *
 * Und der Bestandsverlauf am Inventarposten: jede Veränderung mit Grund, Zeit
 * und Person. Ohne ihn blieb nur, die Zahl im Feld zu überschreiben — und
 * hinterher wusste niemand mehr, warum aus 50 plötzlich 48 wurden.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "products_variants_service_providers" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"contact_id" integer,
  	"service" varchar,
  	"cost" numeric,
  	"lead_time" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "inventory_items_movements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" timestamp(3) with time zone,
  	"delta" numeric,
  	"rest" numeric,
  	"reason" varchar,
  	"who" varchar
  );
  
  ALTER TABLE "products_variants_service_providers" ADD CONSTRAINT "products_variants_service_providers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_variants_service_providers" ADD CONSTRAINT "products_variants_service_providers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "inventory_items_movements" ADD CONSTRAINT "inventory_items_movements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_variants_service_providers_order_idx" ON "products_variants_service_providers" USING btree ("_order");
  CREATE INDEX "products_variants_service_providers_parent_id_idx" ON "products_variants_service_providers" USING btree ("_parent_id");
  CREATE INDEX "products_variants_service_providers_contact_idx" ON "products_variants_service_providers" USING btree ("contact_id");
  CREATE INDEX "inventory_items_movements_order_idx" ON "inventory_items_movements" USING btree ("_order");
  CREATE INDEX "inventory_items_movements_parent_id_idx" ON "inventory_items_movements" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "products_variants_service_providers" CASCADE;
  DROP TABLE "inventory_items_movements" CASCADE;`)
}
