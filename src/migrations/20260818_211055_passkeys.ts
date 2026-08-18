import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "users_passkeys" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"credential_id" varchar NOT NULL,
  	"public_key" varchar NOT NULL,
  	"counter" numeric DEFAULT 0,
  	"transports" varchar,
  	"label" varchar,
  	"last_used_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_passkeys" ADD CONSTRAINT "users_passkeys_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_passkeys_order_idx" ON "users_passkeys" USING btree ("_order");
  CREATE INDEX "users_passkeys_parent_id_idx" ON "users_passkeys" USING btree ("_parent_id");
  CREATE INDEX "users_passkeys_credential_id_idx" ON "users_passkeys" USING btree ("credential_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_passkeys" CASCADE;`)
}
