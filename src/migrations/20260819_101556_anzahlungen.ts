import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_outgoing_invoices_stufe" AS ENUM('vollstaendig', 'anzahlung', 'zwischen', 'schluss');
  ALTER TABLE "products" ADD COLUMN "anzahlung_prozent" numeric DEFAULT 0;
  ALTER TABLE "products" ADD COLUMN "zwischen_prozent" numeric DEFAULT 0;
  ALTER TABLE "jobs" ADD COLUMN "meilenstein_bezeichnung" varchar DEFAULT 'Rohbau fertig';
  ALTER TABLE "jobs" ADD COLUMN "meilenstein_erreicht_am" timestamp(3) with time zone;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "stufe" "enum_outgoing_invoices_stufe" DEFAULT 'vollstaendig';
  ALTER TABLE "outgoing_invoices" ADD COLUMN "auftrag_id" integer;
  ALTER TABLE "outgoing_invoices" ADD CONSTRAINT "outgoing_invoices_auftrag_id_jobs_id_fk" FOREIGN KEY ("auftrag_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "outgoing_invoices_auftrag_idx" ON "outgoing_invoices" USING btree ("auftrag_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "outgoing_invoices" DROP CONSTRAINT "outgoing_invoices_auftrag_id_jobs_id_fk";
  
  DROP INDEX "outgoing_invoices_auftrag_idx";
  ALTER TABLE "products" DROP COLUMN "anzahlung_prozent";
  ALTER TABLE "products" DROP COLUMN "zwischen_prozent";
  ALTER TABLE "jobs" DROP COLUMN "meilenstein_bezeichnung";
  ALTER TABLE "jobs" DROP COLUMN "meilenstein_erreicht_am";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "stufe";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "auftrag_id";
  DROP TYPE "public"."enum_outgoing_invoices_stufe";`)
}
