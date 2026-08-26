import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "integrations_mailvorlagen" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"art" varchar NOT NULL,
  	"betreff" varchar,
  	"inhalt" varchar,
  	"aktiv" boolean DEFAULT true
  );
  
  ALTER TABLE "integrations_mailvorlagen" ADD CONSTRAINT "integrations_mailvorlagen_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "integrations_mailvorlagen_order_idx" ON "integrations_mailvorlagen" USING btree ("_order");
  CREATE INDEX "integrations_mailvorlagen_parent_id_idx" ON "integrations_mailvorlagen" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "integrations_mailvorlagen" CASCADE;`)
}
