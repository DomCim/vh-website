import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_inquiries_type" AS ENUM('kontakt', 'produkt', 'massanfertigung');
  CREATE TYPE "public"."enum_inquiries_status" AS ENUM('neu', 'inBearbeitung', 'beantwortet', 'erledigt');
  ALTER TYPE "public"."enum_orders_status" ADD VALUE 'inProduction' BEFORE 'shipped';
  CREATE TABLE "inquiries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_inquiries_type" DEFAULT 'kontakt' NOT NULL,
  	"status" "enum_inquiries_status" DEFAULT 'neu' NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"message" varchar NOT NULL,
  	"product_id" integer,
  	"product_title" varchar,
  	"product_url" varchar,
  	"custom_width" numeric,
  	"custom_depth" numeric,
  	"custom_height" numeric,
  	"custom_color" varchar,
  	"custom_purpose" varchar,
  	"custom_desired_date" varchar,
  	"locale" varchar,
  	"internal_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inquiries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "login_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"code_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_mfa_backup_codes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"hash" varchar
  );
  
  ALTER TABLE "products" ADD COLUMN "ready_made" boolean DEFAULT false;
  ALTER TABLE "products_locales" ADD COLUMN "production_time" varchar;
  ALTER TABLE "projects_rels" ADD COLUMN "products_id" integer;
  ALTER TABLE "orders" ADD COLUMN "expected_ready" varchar;
  ALTER TABLE "orders" ADD COLUMN "access_token" varchar;
  ALTER TABLE "users" ADD COLUMN "mfa_enabled" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "mfa_secret" varchar;
  ALTER TABLE "users" ADD COLUMN "mfa_pending_secret" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "login_codes_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "analytics_script_url" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "analytics_domain" varchar;
  ALTER TABLE "site_settings_locales" ADD COLUMN "craft_notice" varchar;
  ALTER TABLE "site_settings_locales" ADD COLUMN "craft_default_production_time" varchar;
  ALTER TABLE "integrations" ADD COLUMN "mcp_api_key" varchar;
  ALTER TABLE "integrations" ADD COLUMN "mcp_readonly_key" varchar;
  ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inquiries_rels" ADD CONSTRAINT "inquiries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "inquiries_rels" ADD CONSTRAINT "inquiries_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_mfa_backup_codes" ADD CONSTRAINT "users_mfa_backup_codes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "inquiries_product_idx" ON "inquiries" USING btree ("product_id");
  CREATE INDEX "inquiries_updated_at_idx" ON "inquiries" USING btree ("updated_at");
  CREATE INDEX "inquiries_created_at_idx" ON "inquiries" USING btree ("created_at");
  CREATE INDEX "inquiries_rels_order_idx" ON "inquiries_rels" USING btree ("order");
  CREATE INDEX "inquiries_rels_parent_idx" ON "inquiries_rels" USING btree ("parent_id");
  CREATE INDEX "inquiries_rels_path_idx" ON "inquiries_rels" USING btree ("path");
  CREATE INDEX "inquiries_rels_media_id_idx" ON "inquiries_rels" USING btree ("media_id");
  CREATE INDEX "login_codes_email_idx" ON "login_codes" USING btree ("email");
  CREATE INDEX "login_codes_updated_at_idx" ON "login_codes" USING btree ("updated_at");
  CREATE INDEX "login_codes_created_at_idx" ON "login_codes" USING btree ("created_at");
  CREATE INDEX "users_mfa_backup_codes_order_idx" ON "users_mfa_backup_codes" USING btree ("_order");
  CREATE INDEX "users_mfa_backup_codes_parent_id_idx" ON "users_mfa_backup_codes" USING btree ("_parent_id");
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiries_fk" FOREIGN KEY ("inquiries_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_login_codes_fk" FOREIGN KEY ("login_codes_id") REFERENCES "public"."login_codes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_rels_products_id_idx" ON "projects_rels" USING btree ("products_id");
  CREATE UNIQUE INDEX "orders_access_token_idx" ON "orders" USING btree ("access_token");
  CREATE INDEX "payload_locked_documents_rels_inquiries_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiries_id");
  CREATE INDEX "payload_locked_documents_rels_login_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("login_codes_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "inquiries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inquiries_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "login_codes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_mfa_backup_codes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "inquiries" CASCADE;
  DROP TABLE "inquiries_rels" CASCADE;
  DROP TABLE "login_codes" CASCADE;
  DROP TABLE "users_mfa_backup_codes" CASCADE;
  ALTER TABLE "projects_rels" DROP CONSTRAINT "projects_rels_products_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_inquiries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_login_codes_fk";
  
  ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_orders_status";
  CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'paid', 'shipped', 'cancelled');
  ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."enum_orders_status";
  ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."enum_orders_status" USING "status"::"public"."enum_orders_status";
  DROP INDEX "projects_rels_products_id_idx";
  DROP INDEX "orders_access_token_idx";
  DROP INDEX "payload_locked_documents_rels_inquiries_id_idx";
  DROP INDEX "payload_locked_documents_rels_login_codes_id_idx";
  ALTER TABLE "products" DROP COLUMN "ready_made";
  ALTER TABLE "products_locales" DROP COLUMN "production_time";
  ALTER TABLE "projects_rels" DROP COLUMN "products_id";
  ALTER TABLE "orders" DROP COLUMN "expected_ready";
  ALTER TABLE "orders" DROP COLUMN "access_token";
  ALTER TABLE "users" DROP COLUMN "mfa_enabled";
  ALTER TABLE "users" DROP COLUMN "mfa_secret";
  ALTER TABLE "users" DROP COLUMN "mfa_pending_secret";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "inquiries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "login_codes_id";
  ALTER TABLE "site_settings" DROP COLUMN "analytics_script_url";
  ALTER TABLE "site_settings" DROP COLUMN "analytics_domain";
  ALTER TABLE "site_settings_locales" DROP COLUMN "craft_notice";
  ALTER TABLE "site_settings_locales" DROP COLUMN "craft_default_production_time";
  ALTER TABLE "integrations" DROP COLUMN "mcp_api_key";
  ALTER TABLE "integrations" DROP COLUMN "mcp_readonly_key";
  DROP TYPE "public"."enum_inquiries_type";
  DROP TYPE "public"."enum_inquiries_status";`)
}
