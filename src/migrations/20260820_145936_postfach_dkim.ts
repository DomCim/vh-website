import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations_mailboxes" ADD COLUMN "dkim_domain" varchar;
  ALTER TABLE "integrations_mailboxes" ADD COLUMN "dkim_selector" varchar;
  ALTER TABLE "integrations_mailboxes" ADD COLUMN "dkim_private_key" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integrations_mailboxes" DROP COLUMN "dkim_domain";
  ALTER TABLE "integrations_mailboxes" DROP COLUMN "dkim_selector";
  ALTER TABLE "integrations_mailboxes" DROP COLUMN "dkim_private_key";`)
}
