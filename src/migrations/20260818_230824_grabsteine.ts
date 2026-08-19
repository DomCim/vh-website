import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "deletions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"bereich" varchar NOT NULL,
  	"datensatz" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "deletions_id" integer;
  CREATE INDEX "deletions_bereich_idx" ON "deletions" USING btree ("bereich");
  CREATE INDEX "deletions_updated_at_idx" ON "deletions" USING btree ("updated_at");
  CREATE INDEX "deletions_created_at_idx" ON "deletions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_deletions_fk" FOREIGN KEY ("deletions_id") REFERENCES "public"."deletions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_deletions_id_idx" ON "payload_locked_documents_rels" USING btree ("deletions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "deletions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "deletions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_deletions_fk";
  
  DROP INDEX "payload_locked_documents_rels_deletions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "deletions_id";`)
}
