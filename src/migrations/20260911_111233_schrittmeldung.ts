import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_mail_log_kind" ADD VALUE 'auftrag-zwischenstand' BEFORE 'auftrag-geliefert';
  ALTER TABLE "jobs_arbeitsplan" ADD COLUMN "kunde_melden" boolean DEFAULT false;
  ALTER TABLE "jobs_arbeitsplan" ADD COLUMN "kundentext" varchar;
  ALTER TABLE "jobs_arbeitsplan" ADD COLUMN "gemeldet_am" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "mail_log" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "mail_log" ALTER COLUMN "kind" SET DEFAULT 'sonstiges'::text;
  DROP TYPE "public"."enum_mail_log_kind";
  CREATE TYPE "public"."enum_mail_log_kind" AS ENUM('bestellung', 'fertigung', 'versand', 'auftrag-fertigung', 'auftrag-fertig', 'auftrag-geliefert', 'anfrage', 'zugangscode', 'postfach', 'sonstiges');
  ALTER TABLE "mail_log" ALTER COLUMN "kind" SET DEFAULT 'sonstiges'::"public"."enum_mail_log_kind";
  ALTER TABLE "mail_log" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_mail_log_kind" USING "kind"::"public"."enum_mail_log_kind";
  ALTER TABLE "jobs_arbeitsplan" DROP COLUMN "kunde_melden";
  ALTER TABLE "jobs_arbeitsplan" DROP COLUMN "kundentext";
  ALTER TABLE "jobs_arbeitsplan" DROP COLUMN "gemeldet_am";`)
}
