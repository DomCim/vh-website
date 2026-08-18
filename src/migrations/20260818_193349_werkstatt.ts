import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "jobs_time_entries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" timestamp(3) with time zone,
  	"minutes" numeric NOT NULL,
  	"note" varchar
  );
  
  ALTER TABLE "products" ADD COLUMN "production_minutes" numeric;
  ALTER TABLE "jobs" ADD COLUMN "running_since" timestamp(3) with time zone;
  ALTER TABLE "site_settings" ADD COLUMN "craft_hourly_rate" numeric DEFAULT 65;
  ALTER TABLE "site_settings" ADD COLUMN "craft_target_margin" numeric DEFAULT 40;
  ALTER TABLE "jobs_time_entries" ADD CONSTRAINT "jobs_time_entries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "jobs_time_entries_order_idx" ON "jobs_time_entries" USING btree ("_order");
  CREATE INDEX "jobs_time_entries_parent_id_idx" ON "jobs_time_entries" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "jobs_time_entries" CASCADE;
  ALTER TABLE "products" DROP COLUMN "production_minutes";
  ALTER TABLE "jobs" DROP COLUMN "running_since";
  ALTER TABLE "site_settings" DROP COLUMN "craft_hourly_rate";
  ALTER TABLE "site_settings" DROP COLUMN "craft_target_margin";`)
}
