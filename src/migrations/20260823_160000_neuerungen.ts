import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Die Neuerungen bekommen eine Tabelle — und jedes Konto eine Marke, bis
 * wohin es sie gelesen hat.
 *
 * **Von Hand nachgeschnitten, und zwar aus gutem Grund.** Erzeugt hat das
 * `payload migrate:create`, und dabei standen sieben Spalten mit drin, die es
 * längst gibt: `products.digital`, `orders.consent_digital_at`,
 * `product_files.download` und die beiden GitHub-Felder an den Integrationen.
 * Sie kamen über handgeschriebene Migrationen ins Haus, und die haben keinen
 * Schnappschuss hinterlassen — Payload rechnet den Unterschied aber gegen den
 * letzten Schnappschuss und hielt sie deshalb für neu. In Produktion wäre
 * daraus ein „column already exists" geworden, der Containerstart hätte
 * zehnmal vergeblich migriert und aufgegeben: kein Büro, keine Website.
 *
 * Der Schnappschuss zu dieser Migration steht dagegen vollständig da. Damit
 * ist die Abweichung geheilt, und die nächste erzeugte Migration rechnet
 * wieder gegen den wirklichen Stand.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "changelog_punkte_unter" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "changelog_punkte" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "changelog" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"nummer" numeric NOT NULL,
  	"titel" varchar NOT NULL,
  	"datum" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "neuerung_gesehen" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "changelog_id" integer;
  ALTER TABLE "changelog_punkte_unter" ADD CONSTRAINT "changelog_punkte_unter_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."changelog_punkte"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "changelog_punkte" ADD CONSTRAINT "changelog_punkte_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."changelog"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "changelog_punkte_unter_order_idx" ON "changelog_punkte_unter" USING btree ("_order");
  CREATE INDEX "changelog_punkte_unter_parent_id_idx" ON "changelog_punkte_unter" USING btree ("_parent_id");
  CREATE INDEX "changelog_punkte_order_idx" ON "changelog_punkte" USING btree ("_order");
  CREATE INDEX "changelog_punkte_parent_id_idx" ON "changelog_punkte" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "changelog_nummer_idx" ON "changelog" USING btree ("nummer");
  CREATE INDEX "changelog_datum_idx" ON "changelog" USING btree ("datum");
  CREATE INDEX "changelog_updated_at_idx" ON "changelog" USING btree ("updated_at");
  CREATE INDEX "changelog_created_at_idx" ON "changelog" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_changelog_fk" FOREIGN KEY ("changelog_id") REFERENCES "public"."changelog"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_changelog_id_idx" ON "payload_locked_documents_rels" USING btree ("changelog_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "changelog_punkte_unter" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "changelog_punkte" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "changelog" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "changelog_punkte_unter" CASCADE;
  DROP TABLE "changelog_punkte" CASCADE;
  DROP TABLE "changelog" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_changelog_fk";
  
  DROP INDEX "payload_locked_documents_rels_changelog_id_idx";
  ALTER TABLE "users" DROP COLUMN "neuerung_gesehen";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "changelog_id";`)
}
