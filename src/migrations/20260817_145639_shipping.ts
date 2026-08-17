import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_delivery_method" AS ENUM('shipping', 'pickup');
  ALTER TABLE "orders" ALTER COLUMN "shipping_address_line1" DROP NOT NULL;
  ALTER TABLE "orders" ALTER COLUMN "shipping_address_postal_code" DROP NOT NULL;
  ALTER TABLE "orders" ALTER COLUMN "shipping_address_city" DROP NOT NULL;
  ALTER TABLE "orders" ALTER COLUMN "shipping_address_country" DROP NOT NULL;
  ALTER TABLE "products" ADD COLUMN "shipping_cost" numeric;
  ALTER TABLE "orders" ADD COLUMN "shipping_total" numeric DEFAULT 0;
  ALTER TABLE "orders" ADD COLUMN "delivery_method" "enum_orders_delivery_method" DEFAULT 'shipping' NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" ALTER COLUMN "shipping_address_line1" SET NOT NULL;
  ALTER TABLE "orders" ALTER COLUMN "shipping_address_postal_code" SET NOT NULL;
  ALTER TABLE "orders" ALTER COLUMN "shipping_address_city" SET NOT NULL;
  ALTER TABLE "orders" ALTER COLUMN "shipping_address_country" SET NOT NULL;
  ALTER TABLE "products" DROP COLUMN "shipping_cost";
  ALTER TABLE "orders" DROP COLUMN "shipping_total";
  ALTER TABLE "orders" DROP COLUMN "delivery_method";
  DROP TYPE "public"."enum_orders_delivery_method";`)
}
