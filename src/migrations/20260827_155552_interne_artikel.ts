import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ADD COLUMN "intern" boolean DEFAULT false;
  CREATE INDEX "products_intern_idx" ON "products" USING btree ("intern");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "products_intern_idx";
  ALTER TABLE "products" DROP COLUMN "intern";`)
}
