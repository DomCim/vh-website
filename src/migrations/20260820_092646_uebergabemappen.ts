import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_product_files_herkunft" AS ENUM('haus', 'kunde');
  CREATE TABLE "customer_uploads_folders" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "customer_uploads_zugaenge" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"token" varchar,
  	"passwort" varchar,
  	"erzeugt_am" timestamp(3) with time zone,
  	"gueltig_bis" timestamp(3) with time zone,
  	"an_email" varchar,
  	"zuletzt_genutzt" timestamp(3) with time zone,
  	"zurueckgezogen" boolean DEFAULT false
  );
  
  CREATE TABLE "customer_uploads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"contact_id" integer,
  	"email" varchar,
  	"anfrage_id" integer,
  	"angebot_id" integer,
  	"auftrag_id" integer,
  	"geschlossen" boolean DEFAULT false,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "product_files" ALTER COLUMN "product_id" DROP NOT NULL;
  ALTER TABLE "product_files" ADD COLUMN "mappe_id" integer;
  ALTER TABLE "product_files" ADD COLUMN "anfrage_id" integer;
  ALTER TABLE "product_files" ADD COLUMN "angebot_id" integer;
  ALTER TABLE "product_files" ADD COLUMN "auftrag_id" integer;
  ALTER TABLE "product_files" ADD COLUMN "herkunft" "enum_product_files_herkunft" DEFAULT 'haus';
  ALTER TABLE "product_files" ADD COLUMN "freigabe" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "customer_uploads_id" integer;
  ALTER TABLE "customer_uploads_folders" ADD CONSTRAINT "customer_uploads_folders_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customer_uploads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customer_uploads_zugaenge" ADD CONSTRAINT "customer_uploads_zugaenge_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customer_uploads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customer_uploads" ADD CONSTRAINT "customer_uploads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_uploads" ADD CONSTRAINT "customer_uploads_anfrage_id_inquiries_id_fk" FOREIGN KEY ("anfrage_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_uploads" ADD CONSTRAINT "customer_uploads_angebot_id_quotes_id_fk" FOREIGN KEY ("angebot_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_uploads" ADD CONSTRAINT "customer_uploads_auftrag_id_jobs_id_fk" FOREIGN KEY ("auftrag_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "customer_uploads_folders_order_idx" ON "customer_uploads_folders" USING btree ("_order");
  CREATE INDEX "customer_uploads_folders_parent_id_idx" ON "customer_uploads_folders" USING btree ("_parent_id");
  CREATE INDEX "customer_uploads_zugaenge_order_idx" ON "customer_uploads_zugaenge" USING btree ("_order");
  CREATE INDEX "customer_uploads_zugaenge_parent_id_idx" ON "customer_uploads_zugaenge" USING btree ("_parent_id");
  CREATE INDEX "customer_uploads_zugaenge_token_idx" ON "customer_uploads_zugaenge" USING btree ("token");
  CREATE INDEX "customer_uploads_contact_idx" ON "customer_uploads" USING btree ("contact_id");
  CREATE INDEX "customer_uploads_anfrage_idx" ON "customer_uploads" USING btree ("anfrage_id");
  CREATE INDEX "customer_uploads_angebot_idx" ON "customer_uploads" USING btree ("angebot_id");
  CREATE INDEX "customer_uploads_auftrag_idx" ON "customer_uploads" USING btree ("auftrag_id");
  CREATE INDEX "customer_uploads_updated_at_idx" ON "customer_uploads" USING btree ("updated_at");
  CREATE INDEX "customer_uploads_created_at_idx" ON "customer_uploads" USING btree ("created_at");
  ALTER TABLE "product_files" ADD CONSTRAINT "product_files_mappe_id_customer_uploads_id_fk" FOREIGN KEY ("mappe_id") REFERENCES "public"."customer_uploads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_files" ADD CONSTRAINT "product_files_anfrage_id_inquiries_id_fk" FOREIGN KEY ("anfrage_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_files" ADD CONSTRAINT "product_files_angebot_id_quotes_id_fk" FOREIGN KEY ("angebot_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_files" ADD CONSTRAINT "product_files_auftrag_id_jobs_id_fk" FOREIGN KEY ("auftrag_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customer_uploads_fk" FOREIGN KEY ("customer_uploads_id") REFERENCES "public"."customer_uploads"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "product_files_mappe_idx" ON "product_files" USING btree ("mappe_id");
  CREATE INDEX "product_files_anfrage_idx" ON "product_files" USING btree ("anfrage_id");
  CREATE INDEX "product_files_angebot_idx" ON "product_files" USING btree ("angebot_id");
  CREATE INDEX "product_files_auftrag_idx" ON "product_files" USING btree ("auftrag_id");
  CREATE INDEX "product_files_freigabe_idx" ON "product_files" USING btree ("freigabe");
  CREATE INDEX "payload_locked_documents_rels_customer_uploads_id_idx" ON "payload_locked_documents_rels" USING btree ("customer_uploads_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "customer_uploads_folders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customer_uploads_zugaenge" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customer_uploads" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "customer_uploads_folders" CASCADE;
  DROP TABLE "customer_uploads_zugaenge" CASCADE;
  DROP TABLE "customer_uploads" CASCADE;
  ALTER TABLE "product_files" DROP CONSTRAINT "product_files_mappe_id_customer_uploads_id_fk";
  
  ALTER TABLE "product_files" DROP CONSTRAINT "product_files_anfrage_id_inquiries_id_fk";
  
  ALTER TABLE "product_files" DROP CONSTRAINT "product_files_angebot_id_quotes_id_fk";
  
  ALTER TABLE "product_files" DROP CONSTRAINT "product_files_auftrag_id_jobs_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_customer_uploads_fk";
  
  DROP INDEX "product_files_mappe_idx";
  DROP INDEX "product_files_anfrage_idx";
  DROP INDEX "product_files_angebot_idx";
  DROP INDEX "product_files_auftrag_idx";
  DROP INDEX "product_files_freigabe_idx";
  DROP INDEX "payload_locked_documents_rels_customer_uploads_id_idx";
  ALTER TABLE "product_files" ALTER COLUMN "product_id" SET NOT NULL;
  ALTER TABLE "product_files" DROP COLUMN "mappe_id";
  ALTER TABLE "product_files" DROP COLUMN "anfrage_id";
  ALTER TABLE "product_files" DROP COLUMN "angebot_id";
  ALTER TABLE "product_files" DROP COLUMN "auftrag_id";
  ALTER TABLE "product_files" DROP COLUMN "herkunft";
  ALTER TABLE "product_files" DROP COLUMN "freigabe";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "customer_uploads_id";
  DROP TYPE "public"."enum_product_files_herkunft";`)
}
