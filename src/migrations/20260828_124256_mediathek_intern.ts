import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" ADD COLUMN "intern" boolean DEFAULT false;`)

  /*
   * Bestand nachziehen: Alles, worauf eine interne Sammlung zeigt, war nie
   * für die Öffentlichkeit gedacht — Belegscans, Lieferscheine,
   * Kundenanhänge aus Anfragen, Inventarfotos, Übergabefotos und der
   * Bestellscan am Auftrag. Künftige Uploads setzen das Kennzeichen selbst
   * (siehe die Upload-Routen); hier holen wir die schon liegenden Dateien
   * hinter die Anmeldung. Produktbilder bleiben unberührt: Auf sie zeigt
   * keine dieser Tabellen.
   */
  await db.execute(sql`
   UPDATE "media" SET "intern" = true WHERE "id" IN (
     SELECT "document_id" FROM "expenses" WHERE "document_id" IS NOT NULL
     UNION
     SELECT "document_id" FROM "goods_receipts" WHERE "document_id" IS NOT NULL
     UNION
     SELECT "photo_id" FROM "inventory_items" WHERE "photo_id" IS NOT NULL
     UNION
     SELECT "bild_id" FROM "jobs_uebergabefotos" WHERE "bild_id" IS NOT NULL
     UNION
     SELECT "order_document_id" FROM "jobs" WHERE "order_document_id" IS NOT NULL
     UNION
     SELECT "media_id" FROM "inquiries_rels" WHERE "media_id" IS NOT NULL
   );`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DROP COLUMN "intern";`)
}
