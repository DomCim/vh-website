import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_arbeitsplan_art" AS ENUM('eigen', 'fremd');
  CREATE TABLE "products_arbeitsplan" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"was" varchar NOT NULL,
  	"art" "enum_products_arbeitsplan_art" DEFAULT 'eigen' NOT NULL,
  	"minuten" numeric,
  	"dienstleister_id" integer,
  	"kosten" numeric,
  	"vorlauf_tage" numeric,
  	"notiz" varchar
  );
  
  ALTER TABLE "jobs_positions" ADD COLUMN "farbe" varchar;
  ALTER TABLE "products_arbeitsplan" ADD CONSTRAINT "products_arbeitsplan_dienstleister_id_contacts_id_fk" FOREIGN KEY ("dienstleister_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_arbeitsplan" ADD CONSTRAINT "products_arbeitsplan_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_arbeitsplan_order_idx" ON "products_arbeitsplan" USING btree ("_order");
  CREATE INDEX "products_arbeitsplan_parent_id_idx" ON "products_arbeitsplan" USING btree ("_parent_id");
  CREATE INDEX "products_arbeitsplan_dienstleister_idx" ON "products_arbeitsplan" USING btree ("dienstleister_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "products_arbeitsplan" CASCADE;
  ALTER TABLE "jobs_positions" DROP COLUMN "farbe";
  DROP TYPE "public"."enum_products_arbeitsplan_art";`)
}
