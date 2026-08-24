import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_versand_zonen_laender" AS ENUM('FR', 'DE', 'AT', 'BE', 'LU', 'NL', 'IT', 'ES', 'CH');
  CREATE TABLE "versand_zonen_laender" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_versand_zonen_laender",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "versand_zonen" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"aufschlag" numeric DEFAULT 0
  );
  
  CREATE TABLE "versand_zonen_locales" (
  	"hinweis" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "versand" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "orders" ADD COLUMN "shipping_address_country_code" varchar;
  ALTER TABLE "versand_zonen_laender" ADD CONSTRAINT "versand_zonen_laender_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."versand_zonen"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "versand_zonen" ADD CONSTRAINT "versand_zonen_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."versand"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "versand_zonen_locales" ADD CONSTRAINT "versand_zonen_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."versand_zonen"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "versand_zonen_laender_order_idx" ON "versand_zonen_laender" USING btree ("order");
  CREATE INDEX "versand_zonen_laender_parent_idx" ON "versand_zonen_laender" USING btree ("parent_id");
  CREATE INDEX "versand_zonen_order_idx" ON "versand_zonen" USING btree ("_order");
  CREATE INDEX "versand_zonen_parent_id_idx" ON "versand_zonen" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "versand_zonen_locales_locale_parent_id_unique" ON "versand_zonen_locales" USING btree ("_locale","_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "versand_zonen_laender" CASCADE;
  DROP TABLE "versand_zonen" CASCADE;
  DROP TABLE "versand_zonen_locales" CASCADE;
  DROP TABLE "versand" CASCADE;
  ALTER TABLE "orders" DROP COLUMN "shipping_address_country_code";
  DROP TYPE "public"."enum_versand_zonen_laender";`)
}
