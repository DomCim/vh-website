import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" ADD COLUMN "consent_terms_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "consent_waiver" boolean;
  ALTER TABLE "legal_locales" ADD COLUMN "widerruf" jsonb;
  ALTER TABLE "legal_locales" ADD COLUMN "widerrufsformular" jsonb;
  ALTER TABLE "legal_locales" ADD COLUMN "versand_zahlung" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DROP COLUMN "consent_terms_at";
  ALTER TABLE "orders" DROP COLUMN "consent_waiver";
  ALTER TABLE "legal_locales" DROP COLUMN "widerruf";
  ALTER TABLE "legal_locales" DROP COLUMN "widerrufsformular";
  ALTER TABLE "legal_locales" DROP COLUMN "versand_zahlung";`)
}
