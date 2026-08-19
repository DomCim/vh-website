import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "products_file_folders" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant_id" varchar,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "product_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"variant_id" varchar,
  	"variant_title" varchar,
  	"folder" varchar,
  	"label" varchar,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  ALTER TABLE "quotes_items" ADD COLUMN "product_id" integer;
  ALTER TABLE "jobs_positions" ADD COLUMN "product_id" integer;
  ALTER TABLE "outgoing_invoices_items" ADD COLUMN "product_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "product_files_id" integer;
  ALTER TABLE "products_file_folders" ADD CONSTRAINT "products_file_folders_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "product_files" ADD CONSTRAINT "product_files_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "products_file_folders_order_idx" ON "products_file_folders" USING btree ("_order");
  CREATE INDEX "products_file_folders_parent_id_idx" ON "products_file_folders" USING btree ("_parent_id");
  CREATE INDEX "product_files_product_idx" ON "product_files" USING btree ("product_id");
  CREATE INDEX "product_files_variant_id_idx" ON "product_files" USING btree ("variant_id");
  CREATE INDEX "product_files_folder_idx" ON "product_files" USING btree ("folder");
  CREATE INDEX "product_files_updated_at_idx" ON "product_files" USING btree ("updated_at");
  CREATE INDEX "product_files_created_at_idx" ON "product_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "product_files_filename_idx" ON "product_files" USING btree ("filename");
  ALTER TABLE "quotes_items" ADD CONSTRAINT "quotes_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs_positions" ADD CONSTRAINT "jobs_positions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "outgoing_invoices_items" ADD CONSTRAINT "outgoing_invoices_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_files_fk" FOREIGN KEY ("product_files_id") REFERENCES "public"."product_files"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "quotes_items_product_idx" ON "quotes_items" USING btree ("product_id");
  CREATE INDEX "jobs_positions_product_idx" ON "jobs_positions" USING btree ("product_id");
  CREATE INDEX "outgoing_invoices_items_product_idx" ON "outgoing_invoices_items" USING btree ("product_id");
  CREATE INDEX "payload_locked_documents_rels_product_files_id_idx" ON "payload_locked_documents_rels" USING btree ("product_files_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_file_folders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "product_files" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products_file_folders" CASCADE;
  DROP TABLE "product_files" CASCADE;
  ALTER TABLE "quotes_items" DROP CONSTRAINT "quotes_items_product_id_products_id_fk";
  
  ALTER TABLE "jobs_positions" DROP CONSTRAINT "jobs_positions_product_id_products_id_fk";
  
  ALTER TABLE "outgoing_invoices_items" DROP CONSTRAINT "outgoing_invoices_items_product_id_products_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_product_files_fk";
  
  DROP INDEX "quotes_items_product_idx";
  DROP INDEX "jobs_positions_product_idx";
  DROP INDEX "outgoing_invoices_items_product_idx";
  DROP INDEX "payload_locked_documents_rels_product_files_id_idx";
  ALTER TABLE "quotes_items" DROP COLUMN "product_id";
  ALTER TABLE "jobs_positions" DROP COLUMN "product_id";
  ALTER TABLE "outgoing_invoices_items" DROP COLUMN "product_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "product_files_id";`)
}
