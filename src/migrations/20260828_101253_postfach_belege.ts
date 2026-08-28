import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "expenses" ADD COLUMN "quelle_mail" varchar;
  CREATE INDEX "expenses_quelle_mail_idx" ON "expenses" USING btree ("quelle_mail");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "expenses_quelle_mail_idx";
  ALTER TABLE "expenses" DROP COLUMN "quelle_mail";`)
}
