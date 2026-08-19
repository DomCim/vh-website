import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_orders_payment_provider" ADD VALUE 'rechnung' BEFORE 'stripe';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DATA TYPE text;
  ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DEFAULT 'paypal'::text;
  DROP TYPE "public"."enum_orders_payment_provider";
  CREATE TYPE "public"."enum_orders_payment_provider" AS ENUM('paypal', 'stripe');
  ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DEFAULT 'paypal'::"public"."enum_orders_payment_provider";
  ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DATA TYPE "public"."enum_orders_payment_provider" USING "payment_provider"::"public"."enum_orders_payment_provider";`)
}
