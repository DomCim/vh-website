import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_address_history_bereich" AS ENUM('products', 'categories', 'news', 'projects');
  CREATE TYPE "public"."enum_address_history_sprache" AS ENUM('de', 'fr', 'en');
  CREATE TABLE "address_history" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"bereich" "enum_address_history_bereich" NOT NULL,
  	"sprache" "enum_address_history_sprache" NOT NULL,
  	"adresse" varchar NOT NULL,
  	"dokument" numeric NOT NULL,
  	"seit" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "products_locales" ADD COLUMN "adresse" varchar;
  ALTER TABLE "categories_locales" ADD COLUMN "adresse" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "address_history_id" integer;
  CREATE INDEX "address_history_bereich_idx" ON "address_history" USING btree ("bereich");
  CREATE INDEX "address_history_sprache_idx" ON "address_history" USING btree ("sprache");
  CREATE INDEX "address_history_adresse_idx" ON "address_history" USING btree ("adresse");
  CREATE INDEX "address_history_dokument_idx" ON "address_history" USING btree ("dokument");
  CREATE INDEX "address_history_updated_at_idx" ON "address_history" USING btree ("updated_at");
  CREATE INDEX "address_history_created_at_idx" ON "address_history" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_address_history_fk" FOREIGN KEY ("address_history_id") REFERENCES "public"."address_history"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "products_adresse_idx" ON "products_locales" USING btree ("adresse","_locale");
  CREATE UNIQUE INDEX "categories_adresse_idx" ON "categories_locales" USING btree ("adresse","_locale");
  CREATE INDEX "payload_locked_documents_rels_address_history_id_idx" ON "payload_locked_documents_rels" USING btree ("address_history_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "address_history" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "address_history" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_address_history_fk";
  
  DROP INDEX "products_adresse_idx";
  DROP INDEX "categories_adresse_idx";
  DROP INDEX "payload_locked_documents_rels_address_history_id_idx";
  ALTER TABLE "products_locales" DROP COLUMN "adresse";
  ALTER TABLE "categories_locales" DROP COLUMN "adresse";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "address_history_id";
  DROP TYPE "public"."enum_address_history_bereich";
  DROP TYPE "public"."enum_address_history_sprache";`)
}
