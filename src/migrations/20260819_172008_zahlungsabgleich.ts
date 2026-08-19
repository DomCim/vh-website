import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Kontobewegungen: der eingelesene Kontoauszug.
 *
 * Der eindeutige Index auf den Fingerabdruck ist der eigentliche Punkt dieser
 * Tabelle — er sorgt dafür, dass derselbe Auszug zweimal eingelesen nichts
 * verdoppelt. Überschneidende Zeiträume sind beim Herunterladen der Normalfall.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_bank_transactions_status" AS ENUM('offen', 'zugeordnet', 'ignoriert');
  CREATE TYPE "public"."enum_bank_transactions_source" AS ENUM('csv', 'camt');
  CREATE TABLE "bank_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"fingerprint" varchar NOT NULL,
  	"status" "enum_bank_transactions_status" DEFAULT 'offen' NOT NULL,
  	"booking_date" timestamp(3) with time zone NOT NULL,
  	"amount" numeric NOT NULL,
  	"counterparty" varchar,
  	"purpose" varchar,
  	"iban" varchar,
  	"currency" varchar DEFAULT 'EUR',
  	"invoice_id" integer,
  	"matched_at" timestamp(3) with time zone,
  	"source" "enum_bank_transactions_source" DEFAULT 'csv',
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bank_transactions_id" integer;
  ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_invoice_id_outgoing_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."outgoing_invoices"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "bank_transactions_fingerprint_idx" ON "bank_transactions" USING btree ("fingerprint");
  CREATE INDEX "bank_transactions_booking_date_idx" ON "bank_transactions" USING btree ("booking_date");
  CREATE INDEX "bank_transactions_invoice_idx" ON "bank_transactions" USING btree ("invoice_id");
  CREATE INDEX "bank_transactions_updated_at_idx" ON "bank_transactions" USING btree ("updated_at");
  CREATE INDEX "bank_transactions_created_at_idx" ON "bank_transactions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bank_transactions_fk" FOREIGN KEY ("bank_transactions_id") REFERENCES "public"."bank_transactions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_bank_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("bank_transactions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bank_transactions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "bank_transactions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_bank_transactions_fk";
  
  DROP INDEX "payload_locked_documents_rels_bank_transactions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "bank_transactions_id";
  DROP TYPE "public"."enum_bank_transactions_status";
  DROP TYPE "public"."enum_bank_transactions_source";`)
}
