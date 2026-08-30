import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_appointments_quelle" AS ENUM('buero', 'caldav');
  CREATE TABLE "appointments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"start" timestamp(3) with time zone NOT NULL,
  	"ende" timestamp(3) with time zone,
  	"ganztaegig" boolean DEFAULT false,
  	"ort" varchar,
  	"notiz" varchar,
  	"contact_id" integer,
  	"job_id" integer,
  	"uid" varchar,
  	"quelle" "enum_appointments_quelle" DEFAULT 'buero',
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users" ADD COLUMN "kalender_schluessel" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "appointments_id" integer;
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "appointments_start_idx" ON "appointments" USING btree ("start");
  CREATE INDEX "appointments_ganztaegig_idx" ON "appointments" USING btree ("ganztaegig");
  CREATE INDEX "appointments_contact_idx" ON "appointments" USING btree ("contact_id");
  CREATE INDEX "appointments_job_idx" ON "appointments" USING btree ("job_id");
  CREATE UNIQUE INDEX "appointments_uid_idx" ON "appointments" USING btree ("uid");
  CREATE INDEX "appointments_created_by_idx" ON "appointments" USING btree ("created_by_id");
  CREATE INDEX "appointments_updated_at_idx" ON "appointments" USING btree ("updated_at");
  CREATE INDEX "appointments_created_at_idx" ON "appointments" USING btree ("created_at");
  CREATE INDEX "appointments_deleted_at_idx" ON "appointments" USING btree ("deleted_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_appointments_fk" FOREIGN KEY ("appointments_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_kalender_schluessel_idx" ON "users" USING btree ("kalender_schluessel");
  CREATE INDEX "payload_locked_documents_rels_appointments_id_idx" ON "payload_locked_documents_rels" USING btree ("appointments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "appointments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "appointments" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_appointments_fk";
  
  DROP INDEX "users_kalender_schluessel_idx";
  DROP INDEX "payload_locked_documents_rels_appointments_id_idx";
  ALTER TABLE "users" DROP COLUMN "kalender_schluessel";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "appointments_id";
  DROP TYPE "public"."enum_appointments_quelle";`)
}
