import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Rollen werden Datensätze — und die vorhandenen Konten ziehen mit um.
 *
 * Das alte Auswahlfeld `role` bleibt in der Tabelle stehen. Es ist der
 * Rückweg: Sollte hier etwas schiefgehen oder ein Konto durchrutschen,
 * erkennt `hatRecht` einen alten Inhaber weiterhin daran. Ein halb
 * geglückter Umzug soll niemanden aussperren.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_roles_rechte" AS ENUM('buero.oeffnen', 'postfach.lesen', 'anfragen.bearbeiten', 'angebote.schreiben', 'auftraege.bearbeiten', 'rechnungen.schreiben', 'belege.erfassen', 'inventar.pflegen', 'partner.pflegen', 'zahlen.sehen', 'website.pflegen', 'newsletter.versenden', 'sicherung.ausloesen', 'einstellungen.aendern', 'benutzer.verwalten');
  CREATE TABLE "roles_rechte" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_roles_rechte",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "roles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"schluessel" varchar NOT NULL,
  	"eingebaut" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "rolle_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "roles_id" integer;
  ALTER TABLE "roles_rechte" ADD CONSTRAINT "roles_rechte_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "roles_rechte_order_idx" ON "roles_rechte" USING btree ("order");
  CREATE INDEX "roles_rechte_parent_idx" ON "roles_rechte" USING btree ("parent_id");
  CREATE UNIQUE INDEX "roles_schluessel_idx" ON "roles" USING btree ("schluessel");
  CREATE INDEX "roles_updated_at_idx" ON "roles" USING btree ("updated_at");
  CREATE INDEX "roles_created_at_idx" ON "roles" USING btree ("created_at");
  ALTER TABLE "users" ADD CONSTRAINT "users_rolle_id_roles_id_fk" FOREIGN KEY ("rolle_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_roles_fk" FOREIGN KEY ("roles_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_rolle_idx" ON "users" USING btree ("rolle_id");
  CREATE INDEX "payload_locked_documents_rels_roles_id_idx" ON "payload_locked_documents_rels" USING btree ("roles_id");`)

  // ── Die zwei eingebauten Rollen ────────────────────────────────────────
  await db.execute(sql`
    INSERT INTO "roles" ("name", "schluessel", "eingebaut")
    VALUES ('Inhaber', 'inhaber', true), ('Redaktion', 'redaktion', true);
  `)

  /*
   * Die Inhaberrolle bekommt bewusst keine Haken: Erkannt wird sie an ihrem
   * Schlüssel und darf damit immer alles. Stünde hier eine Liste, fehlte ihr
   * nach dem nächsten neuen Recht ausgerechnet dieses eine.
   */
  await db.execute(sql`
    INSERT INTO "roles_rechte" ("order", "parent_id", "value")
    SELECT 1, "id", 'website.pflegen'::"public"."enum_roles_rechte"
    FROM "roles" WHERE "schluessel" = 'redaktion';
  `)

  // ── Und die vorhandenen Konten hängen sich dort ein ────────────────────
  await db.execute(sql`
    UPDATE "users" SET "rolle_id" = (SELECT "id" FROM "roles" WHERE "schluessel" = 'inhaber')
    WHERE "role" = 'inhaber';
  `)
  await db.execute(sql`
    UPDATE "users" SET "rolle_id" = (SELECT "id" FROM "roles" WHERE "schluessel" = 'redaktion')
    WHERE "role" IS DISTINCT FROM 'inhaber';
  `)

  payload.logger.info('Rollen angelegt und vorhandene Konten zugeordnet.')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "roles_rechte" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "roles" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "roles_rechte" CASCADE;
  DROP TABLE "roles" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT "users_rolle_id_roles_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_roles_fk";
  
  DROP INDEX "users_rolle_idx";
  DROP INDEX "payload_locked_documents_rels_roles_id_idx";
  ALTER TABLE "users" DROP COLUMN "rolle_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "roles_id";
  DROP TYPE "public"."enum_roles_rechte";`)
}
