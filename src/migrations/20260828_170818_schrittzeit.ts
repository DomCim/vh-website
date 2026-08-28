import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" ADD COLUMN "schrittzeit_pflicht" boolean DEFAULT false;
  ALTER TABLE "integrations" ADD COLUMN "schrittzeit_planzeit_vorbelegen" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" DROP COLUMN "schrittzeit_pflicht";
  ALTER TABLE "integrations" DROP COLUMN "schrittzeit_planzeit_vorbelegen";`)
}
