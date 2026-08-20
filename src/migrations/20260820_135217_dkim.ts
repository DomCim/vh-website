import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" ADD COLUMN "email_dkim_domain" varchar;
  ALTER TABLE "integrations" ADD COLUMN "email_dkim_selector" varchar;
  ALTER TABLE "integrations" ADD COLUMN "email_dkim_private_key" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations" DROP COLUMN "email_dkim_domain";
  ALTER TABLE "integrations" DROP COLUMN "email_dkim_selector";
  ALTER TABLE "integrations" DROP COLUMN "email_dkim_private_key";`)
}
