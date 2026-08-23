import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Digitale Ware: das Häkchen am Artikel und das an der Datei.
 *
 * Beide stehen auf `false`, und das ist der richtige Ausgangspunkt: Ein
 * vorhandener Artikel ist ein Stück Stahl, und eine vorhandene Werkstattdatei
 * gehört niemandem außer dem Haus. Ein Standard von `true` hätte hier auf
 * einen Schlag das ganze Archiv zum Verkauf gestellt.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ADD COLUMN "digital" boolean DEFAULT false;
  ALTER TABLE "product_files" ADD COLUMN "download" boolean DEFAULT false;
  CREATE INDEX IF NOT EXISTS "product_files_download_idx" ON "product_files" ("download");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "product_files_download_idx";
  ALTER TABLE "products" DROP COLUMN "digital";
  ALTER TABLE "product_files" DROP COLUMN "download";`)
}
