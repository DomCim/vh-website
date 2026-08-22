import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "site_settings_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"frage" varchar NOT NULL,
  	"antwort" varchar NOT NULL
  );
  
  ALTER TABLE "testimonials" ADD COLUMN "rating" numeric;
  ALTER TABLE "site_settings" ADD COLUMN "google_verification" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "bing_verification" varchar;
  ALTER TABLE "site_settings_faq" ADD CONSTRAINT "site_settings_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "site_settings_faq_order_idx" ON "site_settings_faq" USING btree ("_order");
  CREATE INDEX "site_settings_faq_parent_id_idx" ON "site_settings_faq" USING btree ("_parent_id");
  CREATE INDEX "site_settings_faq_locale_idx" ON "site_settings_faq" USING btree ("_locale");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "site_settings_faq" CASCADE;
  ALTER TABLE "testimonials" DROP COLUMN "rating";
  ALTER TABLE "site_settings" DROP COLUMN "google_verification";
  ALTER TABLE "site_settings" DROP COLUMN "bing_verification";`)
}
