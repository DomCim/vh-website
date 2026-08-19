import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "drafts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"benutzer_id" integer NOT NULL,
  	"schluessel" varchar NOT NULL,
  	"stand" jsonb NOT NULL,
  	"geraet" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "drafts_id" integer;
  ALTER TABLE "drafts" ADD CONSTRAINT "drafts_benutzer_id_users_id_fk" FOREIGN KEY ("benutzer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "drafts_benutzer_idx" ON "drafts" USING btree ("benutzer_id");
  CREATE INDEX "drafts_schluessel_idx" ON "drafts" USING btree ("schluessel");
  CREATE INDEX "drafts_updated_at_idx" ON "drafts" USING btree ("updated_at");
  CREATE INDEX "drafts_created_at_idx" ON "drafts" USING btree ("created_at");
  CREATE UNIQUE INDEX "benutzer_schluessel_idx" ON "drafts" USING btree ("benutzer_id","schluessel");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_drafts_fk" FOREIGN KEY ("drafts_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_drafts_id_idx" ON "payload_locked_documents_rels" USING btree ("drafts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "drafts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "drafts" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_drafts_fk";
  
  DROP INDEX "payload_locked_documents_rels_drafts_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "drafts_id";`)
}
