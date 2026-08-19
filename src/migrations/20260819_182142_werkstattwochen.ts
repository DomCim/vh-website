import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Werkstattwochen: die verfügbaren Stunden einer einzelnen Kalenderwoche.
 *
 * Nur für Wochen, die von der Faustregel abweichen — die Werkstatt läuft neben
 * einem Hauptberuf, und eine feste Wochenzahl wäre genau dann falsch, wenn es
 * darauf ankommt.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "workshop_weeks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"woche" varchar NOT NULL,
  	"stunden" numeric NOT NULL,
  	"notiz" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "workshop_weeks_id" integer;
  CREATE UNIQUE INDEX "workshop_weeks_woche_idx" ON "workshop_weeks" USING btree ("woche");
  CREATE INDEX "workshop_weeks_updated_at_idx" ON "workshop_weeks" USING btree ("updated_at");
  CREATE INDEX "workshop_weeks_created_at_idx" ON "workshop_weeks" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_workshop_weeks_fk" FOREIGN KEY ("workshop_weeks_id") REFERENCES "public"."workshop_weeks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_workshop_weeks_id_idx" ON "payload_locked_documents_rels" USING btree ("workshop_weeks_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "workshop_weeks" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "workshop_weeks" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_workshop_weeks_fk";
  
  DROP INDEX "payload_locked_documents_rels_workshop_weeks_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "workshop_weeks_id";`)
}
