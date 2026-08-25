import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "jobs_uebergabefotos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"bild_id" integer NOT NULL,
  	"bemerkung" varchar
  );
  
  ALTER TABLE "jobs_uebergabefotos" ADD CONSTRAINT "jobs_uebergabefotos_bild_id_media_id_fk" FOREIGN KEY ("bild_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs_uebergabefotos" ADD CONSTRAINT "jobs_uebergabefotos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "jobs_uebergabefotos_order_idx" ON "jobs_uebergabefotos" USING btree ("_order");
  CREATE INDEX "jobs_uebergabefotos_parent_id_idx" ON "jobs_uebergabefotos" USING btree ("_parent_id");
  CREATE INDEX "jobs_uebergabefotos_bild_idx" ON "jobs_uebergabefotos" USING btree ("bild_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "jobs_uebergabefotos" CASCADE;`)
}
