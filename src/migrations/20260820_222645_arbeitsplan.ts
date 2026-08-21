import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_variants_arbeitsplan_art" AS ENUM('eigen', 'fremd');
  CREATE TYPE "public"."enum_jobs_arbeitsplan_art" AS ENUM('eigen', 'fremd');
  CREATE TYPE "public"."enum_jobs_arbeitsplan_stand" AS ENUM('offen', 'laeuft', 'erledigt');
  CREATE TABLE "products_variants_arbeitsplan" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"was" varchar,
  	"art" "enum_products_variants_arbeitsplan_art" DEFAULT 'eigen',
  	"minuten" numeric,
  	"dienstleister_id" integer,
  	"kosten" numeric,
  	"vorlauf_tage" numeric,
  	"notiz" varchar
  );
  
  CREATE TABLE "jobs_arbeitsplan" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"was" varchar NOT NULL,
  	"art" "enum_jobs_arbeitsplan_art" DEFAULT 'eigen' NOT NULL,
  	"minuten" numeric,
  	"dienstleister_id" integer,
  	"kosten" numeric,
  	"vorlauf_tage" numeric,
  	"stand" "enum_jobs_arbeitsplan_stand" DEFAULT 'offen',
  	"erledigt_am" timestamp(3) with time zone,
  	"notiz" varchar
  );
  
  ALTER TABLE "products_variants_arbeitsplan" ADD CONSTRAINT "products_variants_arbeitsplan_dienstleister_id_contacts_id_fk" FOREIGN KEY ("dienstleister_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_variants_arbeitsplan" ADD CONSTRAINT "products_variants_arbeitsplan_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "jobs_arbeitsplan" ADD CONSTRAINT "jobs_arbeitsplan_dienstleister_id_contacts_id_fk" FOREIGN KEY ("dienstleister_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs_arbeitsplan" ADD CONSTRAINT "jobs_arbeitsplan_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_variants_arbeitsplan_order_idx" ON "products_variants_arbeitsplan" USING btree ("_order");
  CREATE INDEX "products_variants_arbeitsplan_parent_id_idx" ON "products_variants_arbeitsplan" USING btree ("_parent_id");
  CREATE INDEX "products_variants_arbeitsplan_dienstleister_idx" ON "products_variants_arbeitsplan" USING btree ("dienstleister_id");
  CREATE INDEX "jobs_arbeitsplan_order_idx" ON "jobs_arbeitsplan" USING btree ("_order");
  CREATE INDEX "jobs_arbeitsplan_parent_id_idx" ON "jobs_arbeitsplan" USING btree ("_parent_id");
  CREATE INDEX "jobs_arbeitsplan_dienstleister_idx" ON "jobs_arbeitsplan" USING btree ("dienstleister_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "products_variants_arbeitsplan" CASCADE;
  DROP TABLE "jobs_arbeitsplan" CASCADE;
  DROP TYPE "public"."enum_products_variants_arbeitsplan_art";
  DROP TYPE "public"."enum_jobs_arbeitsplan_art";
  DROP TYPE "public"."enum_jobs_arbeitsplan_stand";`)
}
