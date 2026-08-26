import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" ADD COLUMN "email_datev_berater" numeric;
  ALTER TABLE "integrations" ADD COLUMN "email_datev_mandant" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" DROP COLUMN "email_datev_berater";
  ALTER TABLE "integrations" DROP COLUMN "email_datev_mandant";`)
}
