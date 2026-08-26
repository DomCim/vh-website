import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_variants" ADD COLUMN "image_id" integer;
  ALTER TABLE "products_color_options" ADD COLUMN "image_id" integer;
  ALTER TABLE "products_variants" ADD CONSTRAINT "products_variants_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_color_options" ADD CONSTRAINT "products_color_options_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "products_variants_image_idx" ON "products_variants" USING btree ("image_id");
  CREATE INDEX "products_color_options_image_idx" ON "products_color_options" USING btree ("image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_variants" DROP CONSTRAINT "products_variants_image_id_media_id_fk";
  
  ALTER TABLE "products_color_options" DROP CONSTRAINT "products_color_options_image_id_media_id_fk";
  
  DROP INDEX "products_variants_image_idx";
  DROP INDEX "products_color_options_image_idx";
  ALTER TABLE "products_variants" DROP COLUMN "image_id";
  ALTER TABLE "products_color_options" DROP COLUMN "image_id";`)
}
