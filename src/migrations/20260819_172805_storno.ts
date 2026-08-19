import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Storno und Original zeigen aufeinander.
 *
 * Zwei Beziehungen statt einer, weil beide Fragen im Betrieb vorkommen:
 * „Was hebt diese Rechnung auf?" und „Gilt diese Rechnung noch?".
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "outgoing_invoices" ADD COLUMN "storno_von_id" integer;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "storniert_durch_id" integer;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "storno_grund" varchar;
  ALTER TABLE "outgoing_invoices" ADD CONSTRAINT "outgoing_invoices_storno_von_id_outgoing_invoices_id_fk" FOREIGN KEY ("storno_von_id") REFERENCES "public"."outgoing_invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "outgoing_invoices" ADD CONSTRAINT "outgoing_invoices_storniert_durch_id_outgoing_invoices_id_fk" FOREIGN KEY ("storniert_durch_id") REFERENCES "public"."outgoing_invoices"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "outgoing_invoices_storno_von_idx" ON "outgoing_invoices" USING btree ("storno_von_id");
  CREATE INDEX "outgoing_invoices_storniert_durch_idx" ON "outgoing_invoices" USING btree ("storniert_durch_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "outgoing_invoices" DROP CONSTRAINT "outgoing_invoices_storno_von_id_outgoing_invoices_id_fk";
  
  ALTER TABLE "outgoing_invoices" DROP CONSTRAINT "outgoing_invoices_storniert_durch_id_outgoing_invoices_id_fk";
  
  DROP INDEX "outgoing_invoices_storno_von_idx";
  DROP INDEX "outgoing_invoices_storniert_durch_idx";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "storno_von_id";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "storniert_durch_id";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "storno_grund";`)
}
