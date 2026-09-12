import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_supplier_orders_status" AS ENUM('angefragt', 'bestellt', 'teilgeliefert', 'geliefert', 'storniert');
  CREATE TABLE "supplier_orders_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item_id" integer NOT NULL,
  	"quantity" numeric NOT NULL,
  	"delivered_quantity" numeric DEFAULT 0,
  	"price" numeric,
  	"note" varchar
  );
  
  CREATE TABLE "supplier_orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_number" varchar,
  	"status" "enum_supplier_orders_status" DEFAULT 'angefragt' NOT NULL,
  	"supplier_id" integer,
  	"supplier_name" varchar,
  	"requested_at" timestamp(3) with time zone,
  	"ordered_at" timestamp(3) with time zone,
  	"expected_at" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "supplier_orders_id" integer;
  ALTER TABLE "supplier_orders_lines" ADD CONSTRAINT "supplier_orders_lines_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "supplier_orders_lines" ADD CONSTRAINT "supplier_orders_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."supplier_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_supplier_id_contacts_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "supplier_orders_lines_order_idx" ON "supplier_orders_lines" USING btree ("_order");
  CREATE INDEX "supplier_orders_lines_parent_id_idx" ON "supplier_orders_lines" USING btree ("_parent_id");
  CREATE INDEX "supplier_orders_lines_item_idx" ON "supplier_orders_lines" USING btree ("item_id");
  CREATE UNIQUE INDEX "supplier_orders_order_number_idx" ON "supplier_orders" USING btree ("order_number");
  CREATE INDEX "supplier_orders_status_idx" ON "supplier_orders" USING btree ("status");
  CREATE INDEX "supplier_orders_supplier_idx" ON "supplier_orders" USING btree ("supplier_id");
  CREATE INDEX "supplier_orders_requested_at_idx" ON "supplier_orders" USING btree ("requested_at");
  CREATE INDEX "supplier_orders_ordered_at_idx" ON "supplier_orders" USING btree ("ordered_at");
  CREATE INDEX "supplier_orders_updated_at_idx" ON "supplier_orders" USING btree ("updated_at");
  CREATE INDEX "supplier_orders_created_at_idx" ON "supplier_orders" USING btree ("created_at");
  CREATE INDEX "supplier_orders_deleted_at_idx" ON "supplier_orders" USING btree ("deleted_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_supplier_orders_fk" FOREIGN KEY ("supplier_orders_id") REFERENCES "public"."supplier_orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_supplier_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("supplier_orders_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "supplier_orders_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "supplier_orders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "supplier_orders_lines" CASCADE;
  DROP TABLE "supplier_orders" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_supplier_orders_fk";
  
  DROP INDEX "payload_locked_documents_rels_supplier_orders_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "supplier_orders_id";
  DROP TYPE "public"."enum_supplier_orders_status";`)
}
