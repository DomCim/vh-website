import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import { firmenAngaben } from '../lib/settings'

/**
 * Belege frieren ihre Angaben ein und werden abgelegt.
 *
 * Neu sind je Beleg zwei Spalten: `absender` — die Abschrift der eigenen
 * Firmenangaben zum Zeitpunkt des Festschreibens — und `pdf_ablage`, der Name
 * der abgelegten Datei unter `media/belege`. An der Mahnzeile stehen außerdem
 * die gesetzte Frist und ihr eigenes Schreiben.
 *
 * **Der Nachtrag am Ende ist Absicht.** Bestandsbelege bekommen die heutigen
 * Firmenangaben als Abschrift. Was damals wirklich auf dem Papier stand, weiß
 * niemand mehr — das Heutige ist aber genau das, was sie ohnehin die ganze
 * Zeit zeigen. Ohne den Nachtrag würden sie beim nächsten Umzug oder
 * Bankwechsel ein weiteres Mal wandern; mit ihm stehen sie ab jetzt still.
 *
 * Shop-Bestellungen bleiben davon ausgenommen: Ihre Rechnung entsteht einmal
 * als Mailanhang und wird nie wieder gebaut. Eine Abschrift von heute wäre
 * dort eine Behauptung ohne Nutzen.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" ADD COLUMN "absender" jsonb;
  ALTER TABLE "orders" ADD COLUMN "pdf_ablage" varchar;
  ALTER TABLE "quotes" ADD COLUMN "absender" jsonb;
  ALTER TABLE "quotes" ADD COLUMN "pdf_ablage" varchar;
  ALTER TABLE "jobs" ADD COLUMN "absender" jsonb;
  ALTER TABLE "jobs" ADD COLUMN "pdf_ablage" varchar;
  ALTER TABLE "outgoing_invoices_reminders" ADD COLUMN "frist_bis" timestamp(3) with time zone;
  ALTER TABLE "outgoing_invoices_reminders" ADD COLUMN "pdf_ablage" varchar;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "absender" jsonb;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "pdf_ablage" varchar;`)

  /*
   * Gelesen wird abgesichert, geschrieben nicht.
   *
   * Beim allerersten Start läuft diese Wanderung gegen eine leere Datenbank:
   * Es gibt weder Belege noch gepflegte Einstellungen. Scheitert das Lesen der
   * Einstellungen, ist nichts nachzutragen, und der Start soll deswegen nicht
   * anhalten.
   *
   * Ein `try` um die UPDATEs wäre dagegen Selbstbetrug: Eine Wanderung läuft
   * in einer Transaktion, und nach einem gescheiterten Befehl nimmt Postgres
   * bis zu deren Ende gar nichts mehr an — auch nicht den Eintrag, mit dem
   * Payload die Wanderung als erledigt vermerkt. Ein abgefangener SQL-Fehler
   * bringt den Start also trotzdem zu Fall, nur mit einer irreführenden
   * Meldung. Geht hier etwas schief, soll es laut schiefgehen.
   */
  let absender: string | null = null
  try {
    const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0, req })
    absender = JSON.stringify(firmenAngaben(settings))
  } catch (err) {
    payload.logger.warn(
      { err },
      'Firmenangaben nicht lesbar — Bestandsbelege bleiben ohne Abschrift.',
    )
  }

  /*
   * Je Anweisung ein Aufruf. Mehrere Befehle mit Platzhaltern in einem
   * `db.execute` lehnt Postgres ab („cannot insert multiple commands into a
   * prepared statement") — die Wanderung fiel genau daran einmal um.
   */
  if (absender) {
    await db.execute(sql`
      UPDATE "outgoing_invoices" SET "absender" = ${absender}::jsonb
      WHERE "invoice_number" IS NOT NULL AND "absender" IS NULL`)
    await db.execute(sql`
      UPDATE "quotes" SET "absender" = ${absender}::jsonb
      WHERE "quote_number" IS NOT NULL AND "absender" IS NULL`)
    await db.execute(sql`
      UPDATE "jobs" SET "absender" = ${absender}::jsonb
      WHERE "confirmed_at" IS NOT NULL AND "absender" IS NULL`)
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DROP COLUMN "absender";
  ALTER TABLE "orders" DROP COLUMN "pdf_ablage";
  ALTER TABLE "quotes" DROP COLUMN "absender";
  ALTER TABLE "quotes" DROP COLUMN "pdf_ablage";
  ALTER TABLE "jobs" DROP COLUMN "absender";
  ALTER TABLE "jobs" DROP COLUMN "pdf_ablage";
  ALTER TABLE "outgoing_invoices_reminders" DROP COLUMN "frist_bis";
  ALTER TABLE "outgoing_invoices_reminders" DROP COLUMN "pdf_ablage";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "absender";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "pdf_ablage";`)
}
