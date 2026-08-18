import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_integrations_sicherung_protokoll" AS ENUM('smb', 'webdav');
  CREATE TABLE "system_state" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"last_run" timestamp(3) with time zone,
  	"ok" boolean DEFAULT true,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "expenses" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "expenses" ADD COLUMN "reminder_sent_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "system_state_id" integer;
  ALTER TABLE "integrations" ADD COLUMN "sicherung_protokoll" "enum_integrations_sicherung_protokoll" DEFAULT 'smb';
  ALTER TABLE "integrations" ADD COLUMN "sicherung_smb_server" varchar;
  ALTER TABLE "integrations" ADD COLUMN "sicherung_smb_freigabe" varchar;
  ALTER TABLE "integrations" ADD COLUMN "sicherung_smb_pfad" varchar;
  ALTER TABLE "integrations" ADD COLUMN "sicherung_smb_benutzer" varchar;
  ALTER TABLE "integrations" ADD COLUMN "sicherung_smb_passwort" varchar;
  ALTER TABLE "integrations" ADD COLUMN "sicherung_webdav_url" varchar;
  ALTER TABLE "integrations" ADD COLUMN "sicherung_webdav_benutzer" varchar;
  ALTER TABLE "integrations" ADD COLUMN "sicherung_webdav_passwort" varchar;
  ALTER TABLE "integrations" ADD COLUMN "sicherung_automatik" boolean DEFAULT true;
  ALTER TABLE "integrations" ADD COLUMN "sicherung_uhrzeit" varchar DEFAULT '03:30';
  ALTER TABLE "integrations" ADD COLUMN "sicherung_behalten_lokal" numeric DEFAULT 7;
  ALTER TABLE "integrations" ADD COLUMN "sicherung_behalten_nas" numeric DEFAULT 30;
  CREATE UNIQUE INDEX "system_state_key_idx" ON "system_state" USING btree ("key");
  CREATE INDEX "system_state_updated_at_idx" ON "system_state" USING btree ("updated_at");
  CREATE INDEX "system_state_created_at_idx" ON "system_state" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_system_state_fk" FOREIGN KEY ("system_state_id") REFERENCES "public"."system_state"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_system_state_id_idx" ON "payload_locked_documents_rels" USING btree ("system_state_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "system_state" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "system_state" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_system_state_fk";
  
  DROP INDEX "payload_locked_documents_rels_system_state_id_idx";
  ALTER TABLE "expenses" DROP COLUMN "due_date";
  ALTER TABLE "expenses" DROP COLUMN "reminder_sent_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "system_state_id";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_protokoll";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_smb_server";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_smb_freigabe";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_smb_pfad";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_smb_benutzer";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_smb_passwort";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_webdav_url";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_webdav_benutzer";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_webdav_passwort";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_automatik";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_uhrzeit";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_behalten_lokal";
  ALTER TABLE "integrations" DROP COLUMN "sicherung_behalten_nas";
  DROP TYPE "public"."enum_integrations_sicherung_protokoll";`)
}
