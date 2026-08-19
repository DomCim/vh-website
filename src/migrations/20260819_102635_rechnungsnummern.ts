import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jobs" ADD COLUMN "rechnungs_basis" varchar;
  ALTER TABLE "jobs" ADD COLUMN "stufen_gesamt" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jobs" DROP COLUMN "rechnungs_basis";
  ALTER TABLE "jobs" DROP COLUMN "stufen_gesamt";`)
}
