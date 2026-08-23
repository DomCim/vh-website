import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Die Spalte, die bei der digitalen Ware vergessen wurde.
 *
 * **Was passiert ist.** Zur digitalen Ware kamen drei Felder ins Datenmodell:
 * das Häkchen am Artikel, das an der Datei — und der Zeitpunkt, zu dem ein
 * Kunde die sofortige Bereitstellung verlangt hat. Die Migration dazu legte
 * nur die ersten beiden an. Der Zeitpunkt an der Bestellung fehlte.
 *
 * **Was das anrichtet.** Payload baut seine Abfragen aus dem Datenmodell und
 * zählt dabei jede Spalte auf. Fehlt eine, schlägt **jede** Abfrage auf die
 * Tabelle fehl — nicht nur die, die das Feld braucht. Damit war die
 * Bestellseite nicht mehr aufrufbar, im Büro hakte der Abgleich, und eine
 * neue Bestellung wäre gar nicht erst entstanden.
 *
 * **Warum es beim Ausrollen nicht auffiel.** Der Zustandsbericht meldet
 * `db: true`, sobald die Datenbank antwortet — er fragt keine Tabelle ab. Der
 * Produktdatenfeed lief weiter, weil er nur Artikel liest, und die waren
 * vollständig. Es fiel erst auf, als jemand das Büro öffnete.
 *
 * **Die Lehre.** Wer ein Feld hinzufügt, prüft die Migration gegen alle
 * berührten Sammlungen und nicht nur gegen die eine, an der er gerade
 * arbeitet. Von Hand geschriebene Migrationen — hier nötig, weil in der
 * Arbeitsumgebung keine Datenbank zum Abgleichen steht — haben genau diese
 * Schwäche: Sie vergessen still.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "consent_digital_at" timestamp(3) with time zone;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DROP COLUMN IF EXISTS "consent_digital_at";`)
}
