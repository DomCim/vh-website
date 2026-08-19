import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Wiedervorlagen: der Zettel, den man sich selbst schreibt.
 *
 * Der Bezug auf Partner, Auftrag, Angebot und Rechnung ist überall freiwillig
 * — „Werkstatttor streichen" gehört zu keinem Vorgang.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "follow_ups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"due_date" timestamp(3) with time zone NOT NULL,
  	"done" boolean DEFAULT false,
  	"note" varchar,
  	"contact_id" integer,
  	"job_id" integer,
  	"quote_id" integer,
  	"invoice_id" integer,
  	"done_at" timestamp(3) with time zone,
  	"reminded_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "follow_ups_id" integer;
  ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_invoice_id_outgoing_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."outgoing_invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "follow_ups_due_date_idx" ON "follow_ups" USING btree ("due_date");
  CREATE INDEX "follow_ups_done_idx" ON "follow_ups" USING btree ("done");
  CREATE INDEX "follow_ups_contact_idx" ON "follow_ups" USING btree ("contact_id");
  CREATE INDEX "follow_ups_job_idx" ON "follow_ups" USING btree ("job_id");
  CREATE INDEX "follow_ups_quote_idx" ON "follow_ups" USING btree ("quote_id");
  CREATE INDEX "follow_ups_invoice_idx" ON "follow_ups" USING btree ("invoice_id");
  CREATE INDEX "follow_ups_created_by_idx" ON "follow_ups" USING btree ("created_by_id");
  CREATE INDEX "follow_ups_updated_at_idx" ON "follow_ups" USING btree ("updated_at");
  CREATE INDEX "follow_ups_created_at_idx" ON "follow_ups" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_follow_ups_fk" FOREIGN KEY ("follow_ups_id") REFERENCES "public"."follow_ups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_follow_ups_id_idx" ON "payload_locked_documents_rels" USING btree ("follow_ups_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "follow_ups" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "follow_ups" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_follow_ups_fk";
  
  DROP INDEX "payload_locked_documents_rels_follow_ups_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "follow_ups_id";`)
}
