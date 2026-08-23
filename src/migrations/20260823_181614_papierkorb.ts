import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "products" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "categories" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "news" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "_news_v" ADD COLUMN "version_deleted_at" timestamp(3) with time zone;
  ALTER TABLE "projects" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "testimonials" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "promotions" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "inquiries" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "newsletter_subscribers" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "contacts" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "expenses" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "quotes" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "bank_transactions" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "inventory_items" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "goods_receipts" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "product_files" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "customer_uploads" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "stocktakes" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "follow_ups" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "media" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  CREATE INDEX "products_deleted_at_idx" ON "products" USING btree ("deleted_at");
  CREATE INDEX "categories_deleted_at_idx" ON "categories" USING btree ("deleted_at");
  CREATE INDEX "news_deleted_at_idx" ON "news" USING btree ("deleted_at");
  CREATE INDEX "_news_v_version_version_deleted_at_idx" ON "_news_v" USING btree ("version_deleted_at");
  CREATE INDEX "projects_deleted_at_idx" ON "projects" USING btree ("deleted_at");
  CREATE INDEX "testimonials_deleted_at_idx" ON "testimonials" USING btree ("deleted_at");
  CREATE INDEX "promotions_deleted_at_idx" ON "promotions" USING btree ("deleted_at");
  CREATE INDEX "orders_deleted_at_idx" ON "orders" USING btree ("deleted_at");
  CREATE INDEX "inquiries_deleted_at_idx" ON "inquiries" USING btree ("deleted_at");
  CREATE INDEX "newsletter_subscribers_deleted_at_idx" ON "newsletter_subscribers" USING btree ("deleted_at");
  CREATE INDEX "contacts_deleted_at_idx" ON "contacts" USING btree ("deleted_at");
  CREATE INDEX "expenses_deleted_at_idx" ON "expenses" USING btree ("deleted_at");
  CREATE INDEX "quotes_deleted_at_idx" ON "quotes" USING btree ("deleted_at");
  CREATE INDEX "jobs_deleted_at_idx" ON "jobs" USING btree ("deleted_at");
  CREATE INDEX "outgoing_invoices_deleted_at_idx" ON "outgoing_invoices" USING btree ("deleted_at");
  CREATE INDEX "bank_transactions_deleted_at_idx" ON "bank_transactions" USING btree ("deleted_at");
  CREATE INDEX "inventory_items_deleted_at_idx" ON "inventory_items" USING btree ("deleted_at");
  CREATE INDEX "goods_receipts_deleted_at_idx" ON "goods_receipts" USING btree ("deleted_at");
  CREATE INDEX "product_files_deleted_at_idx" ON "product_files" USING btree ("deleted_at");
  CREATE INDEX "customer_uploads_deleted_at_idx" ON "customer_uploads" USING btree ("deleted_at");
  CREATE INDEX "stocktakes_deleted_at_idx" ON "stocktakes" USING btree ("deleted_at");
  CREATE INDEX "follow_ups_deleted_at_idx" ON "follow_ups" USING btree ("deleted_at");
  CREATE INDEX "media_deleted_at_idx" ON "media" USING btree ("deleted_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "products_deleted_at_idx";
  DROP INDEX "categories_deleted_at_idx";
  DROP INDEX "news_deleted_at_idx";
  DROP INDEX "_news_v_version_version_deleted_at_idx";
  DROP INDEX "projects_deleted_at_idx";
  DROP INDEX "testimonials_deleted_at_idx";
  DROP INDEX "promotions_deleted_at_idx";
  DROP INDEX "orders_deleted_at_idx";
  DROP INDEX "inquiries_deleted_at_idx";
  DROP INDEX "newsletter_subscribers_deleted_at_idx";
  DROP INDEX "contacts_deleted_at_idx";
  DROP INDEX "expenses_deleted_at_idx";
  DROP INDEX "quotes_deleted_at_idx";
  DROP INDEX "jobs_deleted_at_idx";
  DROP INDEX "outgoing_invoices_deleted_at_idx";
  DROP INDEX "bank_transactions_deleted_at_idx";
  DROP INDEX "inventory_items_deleted_at_idx";
  DROP INDEX "goods_receipts_deleted_at_idx";
  DROP INDEX "product_files_deleted_at_idx";
  DROP INDEX "customer_uploads_deleted_at_idx";
  DROP INDEX "stocktakes_deleted_at_idx";
  DROP INDEX "follow_ups_deleted_at_idx";
  DROP INDEX "media_deleted_at_idx";
  ALTER TABLE "categories" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "products" DROP COLUMN "deleted_at";
  ALTER TABLE "categories" DROP COLUMN "deleted_at";
  ALTER TABLE "news" DROP COLUMN "deleted_at";
  ALTER TABLE "_news_v" DROP COLUMN "version_deleted_at";
  ALTER TABLE "projects" DROP COLUMN "deleted_at";
  ALTER TABLE "testimonials" DROP COLUMN "deleted_at";
  ALTER TABLE "promotions" DROP COLUMN "deleted_at";
  ALTER TABLE "orders" DROP COLUMN "deleted_at";
  ALTER TABLE "inquiries" DROP COLUMN "deleted_at";
  ALTER TABLE "newsletter_subscribers" DROP COLUMN "deleted_at";
  ALTER TABLE "contacts" DROP COLUMN "deleted_at";
  ALTER TABLE "expenses" DROP COLUMN "deleted_at";
  ALTER TABLE "quotes" DROP COLUMN "deleted_at";
  ALTER TABLE "jobs" DROP COLUMN "deleted_at";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "deleted_at";
  ALTER TABLE "bank_transactions" DROP COLUMN "deleted_at";
  ALTER TABLE "inventory_items" DROP COLUMN "deleted_at";
  ALTER TABLE "goods_receipts" DROP COLUMN "deleted_at";
  ALTER TABLE "product_files" DROP COLUMN "deleted_at";
  ALTER TABLE "customer_uploads" DROP COLUMN "deleted_at";
  ALTER TABLE "stocktakes" DROP COLUMN "deleted_at";
  ALTER TABLE "follow_ups" DROP COLUMN "deleted_at";
  ALTER TABLE "media" DROP COLUMN "deleted_at";`)
}
