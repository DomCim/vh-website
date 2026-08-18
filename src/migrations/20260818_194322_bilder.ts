import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" ADD COLUMN "sizes_klein_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_klein_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_klein_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_klein_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_klein_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_klein_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_xl_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_xl_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_xl_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_xl_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_xl_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_xl_filename" varchar;
  CREATE INDEX "media_sizes_klein_sizes_klein_filename_idx" ON "media" USING btree ("sizes_klein_filename");
  CREATE INDEX "media_sizes_xl_sizes_xl_filename_idx" ON "media" USING btree ("sizes_xl_filename");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "media_sizes_klein_sizes_klein_filename_idx";
  DROP INDEX "media_sizes_xl_sizes_xl_filename_idx";
  ALTER TABLE "media" DROP COLUMN "sizes_klein_url";
  ALTER TABLE "media" DROP COLUMN "sizes_klein_width";
  ALTER TABLE "media" DROP COLUMN "sizes_klein_height";
  ALTER TABLE "media" DROP COLUMN "sizes_klein_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_klein_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_klein_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_xl_url";
  ALTER TABLE "media" DROP COLUMN "sizes_xl_width";
  ALTER TABLE "media" DROP COLUMN "sizes_xl_height";
  ALTER TABLE "media" DROP COLUMN "sizes_xl_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_xl_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_xl_filename";`)
}
