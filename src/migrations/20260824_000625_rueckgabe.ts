import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_rueckgabe_grund" AS ENUM('storno', 'widerruf', 'reklamation');
  CREATE TYPE "public"."enum_orders_rueckgabe_status" AS ENUM('offen', 'wareZurueck', 'erstattet', 'abgelehnt');
  ALTER TABLE "orders" ADD COLUMN "rueckgabe_grund" "enum_orders_rueckgabe_grund";
  ALTER TABLE "orders" ADD COLUMN "rueckgabe_status" "enum_orders_rueckgabe_status";
  ALTER TABLE "orders" ADD COLUMN "rueckgabe_betrag" numeric;
  ALTER TABLE "orders" ADD COLUMN "rueckgabe_angefragt_am" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "rueckgabe_ware_zurueck_am" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "rueckgabe_erstattet_am" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "rueckgabe_notiz" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DROP COLUMN "rueckgabe_grund";
  ALTER TABLE "orders" DROP COLUMN "rueckgabe_status";
  ALTER TABLE "orders" DROP COLUMN "rueckgabe_betrag";
  ALTER TABLE "orders" DROP COLUMN "rueckgabe_angefragt_am";
  ALTER TABLE "orders" DROP COLUMN "rueckgabe_ware_zurueck_am";
  ALTER TABLE "orders" DROP COLUMN "rueckgabe_erstattet_am";
  ALTER TABLE "orders" DROP COLUMN "rueckgabe_notiz";
  DROP TYPE "public"."enum_orders_rueckgabe_grund";
  DROP TYPE "public"."enum_orders_rueckgabe_status";`)
}
