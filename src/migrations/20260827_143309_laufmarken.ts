import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "job_tags_verlauf" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"job_number" varchar,
  	"gekoppelt_am" timestamp(3) with time zone,
  	"entkoppelt_am" timestamp(3) with time zone
  );
  
  CREATE TABLE "job_tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"auftrag_id" integer,
  	"gekoppelt_am" timestamp(3) with time zone,
  	"notiz" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "contacts" ADD COLUMN "marken_zugang_pin" varchar;
  ALTER TABLE "contacts" ADD COLUMN "marken_zugang_gesetzt_am" timestamp(3) with time zone;
  ALTER TABLE "jobs_arbeitsplan" ADD COLUMN "raus_am" timestamp(3) with time zone;
  ALTER TABLE "jobs_arbeitsplan" ADD COLUMN "zurueck_am" timestamp(3) with time zone;
  ALTER TABLE "jobs_arbeitsplan" ADD COLUMN "angekommen_am" timestamp(3) with time zone;
  ALTER TABLE "jobs_arbeitsplan" ADD COLUMN "fertig_gemeldet_am" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "job_tags_id" integer;
  ALTER TABLE "job_tags_verlauf" ADD CONSTRAINT "job_tags_verlauf_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."job_tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "job_tags" ADD CONSTRAINT "job_tags_auftrag_id_jobs_id_fk" FOREIGN KEY ("auftrag_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "job_tags_verlauf_order_idx" ON "job_tags_verlauf" USING btree ("_order");
  CREATE INDEX "job_tags_verlauf_parent_id_idx" ON "job_tags_verlauf" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "job_tags_code_idx" ON "job_tags" USING btree ("code");
  CREATE INDEX "job_tags_auftrag_idx" ON "job_tags" USING btree ("auftrag_id");
  CREATE INDEX "job_tags_updated_at_idx" ON "job_tags" USING btree ("updated_at");
  CREATE INDEX "job_tags_created_at_idx" ON "job_tags" USING btree ("created_at");
  CREATE INDEX "job_tags_deleted_at_idx" ON "job_tags" USING btree ("deleted_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_job_tags_fk" FOREIGN KEY ("job_tags_id") REFERENCES "public"."job_tags"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_job_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("job_tags_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "job_tags_verlauf" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "job_tags" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "job_tags_verlauf" CASCADE;
  DROP TABLE "job_tags" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_job_tags_fk";
  
  DROP INDEX "payload_locked_documents_rels_job_tags_id_idx";
  ALTER TABLE "contacts" DROP COLUMN "marken_zugang_pin";
  ALTER TABLE "contacts" DROP COLUMN "marken_zugang_gesetzt_am";
  ALTER TABLE "jobs_arbeitsplan" DROP COLUMN "raus_am";
  ALTER TABLE "jobs_arbeitsplan" DROP COLUMN "zurueck_am";
  ALTER TABLE "jobs_arbeitsplan" DROP COLUMN "angekommen_am";
  ALTER TABLE "jobs_arbeitsplan" DROP COLUMN "fertig_gemeldet_am";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "job_tags_id";`)
}
