import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Wareneingänge: was geliefert wurde, mit Lieferschein.
 *
 * Ein eigener Vorgang und nicht eine Korrektur mehr am Posten — eine Lieferung
 * mit fünf Positionen wäre sonst fünf zusammenhanglose Buchungen, und das
 * Papier hinge an keiner davon.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "goods_receipts_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item_id" integer NOT NULL,
  	"quantity" numeric NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "goods_receipts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"receipt_number" varchar,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"delivery_note" varchar,
  	"supplier_id" integer,
  	"supplier_name" varchar,
  	"document_id" integer,
  	"booked" boolean DEFAULT false,
  	"expense_id" integer,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "goods_receipts_id" integer;
  ALTER TABLE "goods_receipts_lines" ADD CONSTRAINT "goods_receipts_lines_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "goods_receipts_lines" ADD CONSTRAINT "goods_receipts_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_contacts_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_document_id_media_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "goods_receipts_lines_order_idx" ON "goods_receipts_lines" USING btree ("_order");
  CREATE INDEX "goods_receipts_lines_parent_id_idx" ON "goods_receipts_lines" USING btree ("_parent_id");
  CREATE INDEX "goods_receipts_lines_item_idx" ON "goods_receipts_lines" USING btree ("item_id");
  CREATE UNIQUE INDEX "goods_receipts_receipt_number_idx" ON "goods_receipts" USING btree ("receipt_number");
  CREATE INDEX "goods_receipts_received_at_idx" ON "goods_receipts" USING btree ("received_at");
  CREATE INDEX "goods_receipts_supplier_idx" ON "goods_receipts" USING btree ("supplier_id");
  CREATE INDEX "goods_receipts_document_idx" ON "goods_receipts" USING btree ("document_id");
  CREATE INDEX "goods_receipts_expense_idx" ON "goods_receipts" USING btree ("expense_id");
  CREATE INDEX "goods_receipts_updated_at_idx" ON "goods_receipts" USING btree ("updated_at");
  CREATE INDEX "goods_receipts_created_at_idx" ON "goods_receipts" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_goods_receipts_fk" FOREIGN KEY ("goods_receipts_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_goods_receipts_id_idx" ON "payload_locked_documents_rels" USING btree ("goods_receipts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "goods_receipts_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "goods_receipts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "goods_receipts_lines" CASCADE;
  DROP TABLE "goods_receipts" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_goods_receipts_fk";
  
  DROP INDEX "payload_locked_documents_rels_goods_receipts_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "goods_receipts_id";`)
}
