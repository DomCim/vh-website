import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
 * Stripe wird nicht mehr angeboten. Die beiden Schlüsselfelder fallen weg —
 * sie sind Zugangsdaten zu einem Konto, das niemand mehr benutzt, und die
 * gehören nicht in einer Datenbank herumliegen.
 *
 * Der Wert 'stripe' bleibt dagegen in der Auswahl der Bestellungen stehen.
 * Alte Bestellungen tragen ihn, und eine Bestellung, deren Zahlungsart sich
 * nicht mehr benennen lässt, wäre bei einer Prüfung wertlos. Auch
 * `stripe_session_id` und `stripe_payment_intent_id` bleiben aus demselben
 * Grund: Sie sind der Beleg dafür, welche Zahlung damals wozu gehörte.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DATA TYPE text;
  ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DEFAULT 'paypal'::text;
  DROP TYPE "public"."enum_orders_payment_provider";
  CREATE TYPE "public"."enum_orders_payment_provider" AS ENUM('paypal', 'stripe');
  ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DEFAULT 'paypal'::"public"."enum_orders_payment_provider";
  ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DATA TYPE "public"."enum_orders_payment_provider" USING "payment_provider"::"public"."enum_orders_payment_provider";
  ALTER TABLE "integrations" DROP COLUMN "stripe_secret_key";
  ALTER TABLE "integrations" DROP COLUMN "stripe_webhook_secret";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DATA TYPE text;
  ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DEFAULT 'stripe'::text;
  DROP TYPE "public"."enum_orders_payment_provider";
  CREATE TYPE "public"."enum_orders_payment_provider" AS ENUM('stripe', 'paypal');
  ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DEFAULT 'stripe'::"public"."enum_orders_payment_provider";
  ALTER TABLE "orders" ALTER COLUMN "payment_provider" SET DATA TYPE "public"."enum_orders_payment_provider" USING "payment_provider"::"public"."enum_orders_payment_provider";
  ALTER TABLE "integrations" ADD COLUMN "stripe_secret_key" varchar;
  ALTER TABLE "integrations" ADD COLUMN "stripe_webhook_secret" varchar;`)
}
