import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_payment_provider" AS ENUM('stripe', 'paypal');
  ALTER TYPE "public"."_locales" ADD VALUE 'en';
  ALTER TYPE "public"."enum__news_v_published_locale" ADD VALUE 'en';
  ALTER TABLE "orders" ADD COLUMN "tracking_number" varchar;
  ALTER TABLE "orders" ADD COLUMN "tracking_url" varchar;
  ALTER TABLE "orders" ADD COLUMN "payment_provider" "enum_orders_payment_provider" DEFAULT 'stripe';
  ALTER TABLE "orders" ADD COLUMN "paypal_order_id" varchar;
  ALTER TABLE "orders" ADD COLUMN "paypal_capture_id" varchar;
  ALTER TABLE "integrations" ADD COLUMN "paypal_client_id" varchar;
  ALTER TABLE "integrations" ADD COLUMN "paypal_client_secret" varchar;
  ALTER TABLE "integrations" ADD COLUMN "paypal_sandbox" boolean DEFAULT false;
  CREATE INDEX "orders_paypal_order_id_idx" ON "orders" USING btree ("paypal_order_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_variants_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "products_color_options_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "products_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "categories_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "news_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "_news_v_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "promotions_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "media_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "homepage_hero_slides_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "homepage_highlights_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "homepage_values_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "homepage_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "site_settings_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "legal_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  DROP TYPE "public"."_locales";
  CREATE TYPE "public"."_locales" AS ENUM('de', 'fr');
  ALTER TABLE "products_variants_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "products_color_options_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "products_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "categories_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "news_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "_news_v_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "promotions_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "media_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "homepage_hero_slides_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "homepage_highlights_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "homepage_values_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "homepage_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "site_settings_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "legal_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "_news_v" ALTER COLUMN "published_locale" SET DATA TYPE text;
  DROP TYPE "public"."enum__news_v_published_locale";
  CREATE TYPE "public"."enum__news_v_published_locale" AS ENUM('de', 'fr');
  ALTER TABLE "_news_v" ALTER COLUMN "published_locale" SET DATA TYPE "public"."enum__news_v_published_locale" USING "published_locale"::"public"."enum__news_v_published_locale";
  DROP INDEX "orders_paypal_order_id_idx";
  ALTER TABLE "orders" DROP COLUMN "tracking_number";
  ALTER TABLE "orders" DROP COLUMN "tracking_url";
  ALTER TABLE "orders" DROP COLUMN "payment_provider";
  ALTER TABLE "orders" DROP COLUMN "paypal_order_id";
  ALTER TABLE "orders" DROP COLUMN "paypal_capture_id";
  ALTER TABLE "integrations" DROP COLUMN "paypal_client_id";
  ALTER TABLE "integrations" DROP COLUMN "paypal_client_secret";
  ALTER TABLE "integrations" DROP COLUMN "paypal_sandbox";
  DROP TYPE "public"."enum_orders_payment_provider";`)
}
