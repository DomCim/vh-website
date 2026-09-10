import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Der Steuerfall tritt an die Stelle des Hakens, und die Rechnungsposition
 * merkt sich ihre Auftragsposition.
 *
 * **Der Teil, den die Erzeugung nicht kennt, ist der wichtige.** Bisher gab es
 * genau einen Haken `reverse_charge`. Auf dem Papier druckte er den Satz zur
 * **innergemeinschaftlichen Lieferung**, in der Factur-X-Datei schrieb er
 * `AE`, also Reverse Charge — zwei verschiedene Tatbestände am selben Beleg.
 *
 * Aufgelöst wird das zugunsten dessen, was der Kunde in der Hand hielt: Jede
 * bestehende Rechnung mit gesetztem Haken wird zur **innergemeinschaftlichen
 * Lieferung**. Das deckt sich mit dem Betrieb — bis heute ist nichts anderes
 * hinausgegangen (Dominik, 10.09.2026). Alles andere wäre die nachträgliche
 * Umdeutung eines Belegs, der so beim Kunden liegt.
 *
 * Ohne diesen Schritt stünden die alten Rechnungen auf `inland`. Der Haken
 * folgt seit dieser Fassung dem Steuerfall — beim nächsten Speichern fiele er
 * damit weg, und eine steuerfreie Rechnung bekäme rückwirkend Umsatzsteuer.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_outgoing_invoices_steuerfall" AS ENUM('inland', 'ig_lieferung', 'reverse_charge');
  ALTER TABLE "outgoing_invoices_items" ADD COLUMN "auftrag_position" varchar;
  ALTER TABLE "outgoing_invoices" ADD COLUMN "steuerfall" "enum_outgoing_invoices_steuerfall" DEFAULT 'inland';
  CREATE INDEX "outgoing_invoices_items_auftrag_position_idx" ON "outgoing_invoices_items" USING btree ("auftrag_position");`)

  // Was bisher „Reverse Charge" hieß, war dem Text nach eine Lieferung.
  await db.execute(sql`
    UPDATE "outgoing_invoices"
       SET "steuerfall" = 'ig_lieferung'
     WHERE "reverse_charge" IS TRUE;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  /*
   * Zurück bleibt der Haken die einzige Quelle. Beide Fälle ohne Inland
   * bedeuten ihn; was danach als Reverse Charge angelegt wurde, verliert beim
   * Rückwärtsgang seine Unterscheidung. Mehr gibt die alte Form nicht her.
   */
  await db.execute(sql`
    UPDATE "outgoing_invoices"
       SET "reverse_charge" = TRUE
     WHERE "steuerfall" IS NOT NULL AND "steuerfall" <> 'inland';`)

  await db.execute(sql`
   DROP INDEX "outgoing_invoices_items_auftrag_position_idx";
  ALTER TABLE "outgoing_invoices_items" DROP COLUMN "auftrag_position";
  ALTER TABLE "outgoing_invoices" DROP COLUMN "steuerfall";
  DROP TYPE "public"."enum_outgoing_invoices_steuerfall";`)
}
