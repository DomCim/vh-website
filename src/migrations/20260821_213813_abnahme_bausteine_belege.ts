import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_expenses_turnus" AS ENUM('nein', 'monatlich', 'vierteljaehrlich', 'jaehrlich');
  CREATE TABLE "integrations_textbausteine" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"titel" varchar NOT NULL,
  	"inhalt" varchar NOT NULL
  );
  
  ALTER TABLE "expenses" ADD COLUMN "turnus" "enum_expenses_turnus" DEFAULT 'nein';
  ALTER TABLE "jobs" ADD COLUMN "abnahme_am" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "abnahme_name" varchar;
  ALTER TABLE "jobs" ADD COLUMN "abnahme_ort" varchar;
  ALTER TABLE "integrations" ADD COLUMN "email_steuerberater_email" varchar;
  ALTER TABLE "integrations_textbausteine" ADD CONSTRAINT "integrations_textbausteine_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "integrations_textbausteine_order_idx" ON "integrations_textbausteine" USING btree ("_order");
  CREATE INDEX "integrations_textbausteine_parent_id_idx" ON "integrations_textbausteine" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "integrations_textbausteine" CASCADE;
  ALTER TABLE "expenses" DROP COLUMN "turnus";
  ALTER TABLE "jobs" DROP COLUMN "abnahme_am";
  ALTER TABLE "jobs" DROP COLUMN "abnahme_name";
  ALTER TABLE "jobs" DROP COLUMN "abnahme_ort";
  ALTER TABLE "integrations" DROP COLUMN "email_steuerberater_email";
  DROP TYPE "public"."enum_expenses_turnus";`)
}
