import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_contacts_sprache" AS ENUM('de', 'fr', 'en');
  CREATE TYPE "public"."enum_jobs_lieferart" AS ENUM('versand', 'abholung');
  ALTER TYPE "public"."enum_mail_log_kind" ADD VALUE 'auftrag-fertigung' BEFORE 'anfrage';
  ALTER TYPE "public"."enum_mail_log_kind" ADD VALUE 'auftrag-fertig' BEFORE 'anfrage';
  ALTER TYPE "public"."enum_mail_log_kind" ADD VALUE 'auftrag-geliefert' BEFORE 'anfrage';
  ALTER TABLE "contacts" ADD COLUMN "sprache" "enum_contacts_sprache" DEFAULT 'de';
  ALTER TABLE "jobs" ADD COLUMN "lieferart" "enum_jobs_lieferart" DEFAULT 'versand';
  ALTER TABLE "jobs" ADD COLUMN "tracking_number" varchar;
  ALTER TABLE "jobs" ADD COLUMN "tracking_url" varchar;
  ALTER TABLE "jobs" ADD COLUMN "kunde_email" varchar;
  ALTER TABLE "jobs" ADD COLUMN "kunde_benachrichtigen" boolean DEFAULT true;
  ALTER TABLE "jobs" ADD COLUMN "gemeldet_in_fertigung" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "gemeldet_fertig" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "gemeldet_geliefert" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "gemeldet_hinweis" varchar;
  ALTER TABLE "mail_log" ADD COLUMN "job_id" integer;
  ALTER TABLE "mail_log" ADD CONSTRAINT "mail_log_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "mail_log_job_idx" ON "mail_log" USING btree ("job_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "mail_log" DROP CONSTRAINT "mail_log_job_id_jobs_id_fk";
  
  ALTER TABLE "mail_log" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "mail_log" ALTER COLUMN "kind" SET DEFAULT 'sonstiges'::text;
  DROP TYPE "public"."enum_mail_log_kind";
  CREATE TYPE "public"."enum_mail_log_kind" AS ENUM('bestellung', 'fertigung', 'versand', 'anfrage', 'zugangscode', 'postfach', 'sonstiges');
  ALTER TABLE "mail_log" ALTER COLUMN "kind" SET DEFAULT 'sonstiges'::"public"."enum_mail_log_kind";
  ALTER TABLE "mail_log" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_mail_log_kind" USING "kind"::"public"."enum_mail_log_kind";
  DROP INDEX "mail_log_job_idx";
  ALTER TABLE "contacts" DROP COLUMN "sprache";
  ALTER TABLE "jobs" DROP COLUMN "lieferart";
  ALTER TABLE "jobs" DROP COLUMN "tracking_number";
  ALTER TABLE "jobs" DROP COLUMN "tracking_url";
  ALTER TABLE "jobs" DROP COLUMN "kunde_email";
  ALTER TABLE "jobs" DROP COLUMN "kunde_benachrichtigen";
  ALTER TABLE "jobs" DROP COLUMN "gemeldet_in_fertigung";
  ALTER TABLE "jobs" DROP COLUMN "gemeldet_fertig";
  ALTER TABLE "jobs" DROP COLUMN "gemeldet_geliefert";
  ALTER TABLE "jobs" DROP COLUMN "gemeldet_hinweis";
  ALTER TABLE "mail_log" DROP COLUMN "job_id";
  DROP TYPE "public"."enum_contacts_sprache";
  DROP TYPE "public"."enum_jobs_lieferart";`)
}
