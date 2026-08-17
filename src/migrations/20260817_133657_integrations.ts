import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "integrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email_smtp_host" varchar,
  	"email_smtp_port" numeric,
  	"email_smtp_user" varchar,
  	"email_smtp_pass" varchar,
  	"email_from_address" varchar,
  	"email_from_name" varchar,
  	"email_notification_email" varchar,
  	"stripe_secret_key" varchar,
  	"stripe_webhook_secret" varchar,
  	"facebook_page_id" varchar,
  	"facebook_access_token" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "integrations" CASCADE;`)
}
