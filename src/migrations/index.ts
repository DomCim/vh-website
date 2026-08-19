import * as migration_20260817_132927_initial from './20260817_132927_initial';
import * as migration_20260817_133657_integrations from './20260817_133657_integrations';
import * as migration_20260817_145639_shipping from './20260817_145639_shipping';
import * as migration_20260817_152621_ausbau from './20260817_152621_ausbau';
import * as migration_20260817_172510_reichweite from './20260817_172510_reichweite';
import * as migration_20260817_181145_checkout_tva from './20260817_181145_checkout_tva';
import * as migration_20260818_061725_mcp_portal_mfa from './20260818_061725_mcp_portal_mfa';
import * as migration_20260818_075043_buero_belege_rechnungen from './20260818_075043_buero_belege_rechnungen';
import * as migration_20260818_101629_buero_postfach_push from './20260818_101629_buero_postfach_push';
import * as migration_20260818_123622_angebot_nachlass_kundenbestellung from './20260818_123622_angebot_nachlass_kundenbestellung';
import * as migration_20260818_150138_postfach_signatur from './20260818_150138_postfach_signatur';
import * as migration_20260818_184332_sicherung_wartung from './20260818_184332_sicherung_wartung';
import * as migration_20260818_185517_shop_recht from './20260818_185517_shop_recht';
import * as migration_20260818_190812_erechnung from './20260818_190812_erechnung';
import * as migration_20260818_192512_geld from './20260818_192512_geld';
import * as migration_20260818_193349_werkstatt from './20260818_193349_werkstatt';
import * as migration_20260818_194322_bilder from './20260818_194322_bilder';
import * as migration_20260818_201010_takt from './20260818_201010_takt';
import * as migration_20260818_201729_takt_aufbewahrung from './20260818_201729_takt_aufbewahrung';
import * as migration_20260818_211055_passkeys from './20260818_211055_passkeys';
import * as migration_20260818_230824_grabsteine from './20260818_230824_grabsteine';
import * as migration_20260819_092633_entwuerfe from './20260819_092633_entwuerfe';
import * as migration_20260819_093716_rollen from './20260819_093716_rollen';
import * as migration_20260819_101556_anzahlungen from './20260819_101556_anzahlungen';
import * as migration_20260819_102635_rechnungsnummern from './20260819_102635_rechnungsnummern';
import * as migration_20260819_103459_zahlungsziele from './20260819_103459_zahlungsziele';
import * as migration_20260819_112326_stripe_ausbau from './20260819_112326_stripe_ausbau';
import * as migration_20260819_113245_zahlplan_am_auftrag from './20260819_113245_zahlplan_am_auftrag';
import * as migration_20260819_125944_benutzername from './20260819_125944_benutzername';
import * as migration_20260819_144742_rechnungskauf from './20260819_144742_rechnungskauf';
import * as migration_20260819_172008_zahlungsabgleich from './20260819_172008_zahlungsabgleich';
import * as migration_20260819_172805_storno from './20260819_172805_storno';
import * as migration_20260819_173532_auslastung from './20260819_173532_auslastung';
import * as migration_20260819_174511_wiedervorlagen from './20260819_174511_wiedervorlagen';

export const migrations = [
  {
    up: migration_20260817_132927_initial.up,
    down: migration_20260817_132927_initial.down,
    name: '20260817_132927_initial',
  },
  {
    up: migration_20260817_133657_integrations.up,
    down: migration_20260817_133657_integrations.down,
    name: '20260817_133657_integrations',
  },
  {
    up: migration_20260817_145639_shipping.up,
    down: migration_20260817_145639_shipping.down,
    name: '20260817_145639_shipping',
  },
  {
    up: migration_20260817_152621_ausbau.up,
    down: migration_20260817_152621_ausbau.down,
    name: '20260817_152621_ausbau',
  },
  {
    up: migration_20260817_172510_reichweite.up,
    down: migration_20260817_172510_reichweite.down,
    name: '20260817_172510_reichweite',
  },
  {
    up: migration_20260817_181145_checkout_tva.up,
    down: migration_20260817_181145_checkout_tva.down,
    name: '20260817_181145_checkout_tva',
  },
  {
    up: migration_20260818_061725_mcp_portal_mfa.up,
    down: migration_20260818_061725_mcp_portal_mfa.down,
    name: '20260818_061725_mcp_portal_mfa',
  },
  {
    up: migration_20260818_075043_buero_belege_rechnungen.up,
    down: migration_20260818_075043_buero_belege_rechnungen.down,
    name: '20260818_075043_buero_belege_rechnungen',
  },
  {
    up: migration_20260818_101629_buero_postfach_push.up,
    down: migration_20260818_101629_buero_postfach_push.down,
    name: '20260818_101629_buero_postfach_push',
  },
  {
    up: migration_20260818_123622_angebot_nachlass_kundenbestellung.up,
    down: migration_20260818_123622_angebot_nachlass_kundenbestellung.down,
    name: '20260818_123622_angebot_nachlass_kundenbestellung',
  },
  {
    up: migration_20260818_150138_postfach_signatur.up,
    down: migration_20260818_150138_postfach_signatur.down,
    name: '20260818_150138_postfach_signatur',
  },
  {
    up: migration_20260818_184332_sicherung_wartung.up,
    down: migration_20260818_184332_sicherung_wartung.down,
    name: '20260818_184332_sicherung_wartung',
  },
  {
    up: migration_20260818_185517_shop_recht.up,
    down: migration_20260818_185517_shop_recht.down,
    name: '20260818_185517_shop_recht',
  },
  {
    up: migration_20260818_190812_erechnung.up,
    down: migration_20260818_190812_erechnung.down,
    name: '20260818_190812_erechnung',
  },
  {
    up: migration_20260818_192512_geld.up,
    down: migration_20260818_192512_geld.down,
    name: '20260818_192512_geld',
  },
  {
    up: migration_20260818_193349_werkstatt.up,
    down: migration_20260818_193349_werkstatt.down,
    name: '20260818_193349_werkstatt',
  },
  {
    up: migration_20260818_194322_bilder.up,
    down: migration_20260818_194322_bilder.down,
    name: '20260818_194322_bilder',
  },
  {
    up: migration_20260818_201010_takt.up,
    down: migration_20260818_201010_takt.down,
    name: '20260818_201010_takt',
  },
  {
    up: migration_20260818_201729_takt_aufbewahrung.up,
    down: migration_20260818_201729_takt_aufbewahrung.down,
    name: '20260818_201729_takt_aufbewahrung',
  },
  {
    up: migration_20260818_211055_passkeys.up,
    down: migration_20260818_211055_passkeys.down,
    name: '20260818_211055_passkeys',
  },
  {
    up: migration_20260818_230824_grabsteine.up,
    down: migration_20260818_230824_grabsteine.down,
    name: '20260818_230824_grabsteine',
  },
  {
    up: migration_20260819_092633_entwuerfe.up,
    down: migration_20260819_092633_entwuerfe.down,
    name: '20260819_092633_entwuerfe',
  },
  {
    up: migration_20260819_093716_rollen.up,
    down: migration_20260819_093716_rollen.down,
    name: '20260819_093716_rollen',
  },
  {
    up: migration_20260819_101556_anzahlungen.up,
    down: migration_20260819_101556_anzahlungen.down,
    name: '20260819_101556_anzahlungen',
  },
  {
    up: migration_20260819_102635_rechnungsnummern.up,
    down: migration_20260819_102635_rechnungsnummern.down,
    name: '20260819_102635_rechnungsnummern',
  },
  {
    up: migration_20260819_103459_zahlungsziele.up,
    down: migration_20260819_103459_zahlungsziele.down,
    name: '20260819_103459_zahlungsziele',
  },
  {
    up: migration_20260819_112326_stripe_ausbau.up,
    down: migration_20260819_112326_stripe_ausbau.down,
    name: '20260819_112326_stripe_ausbau',
  },
  {
    up: migration_20260819_113245_zahlplan_am_auftrag.up,
    down: migration_20260819_113245_zahlplan_am_auftrag.down,
    name: '20260819_113245_zahlplan_am_auftrag',
  },
  {
    up: migration_20260819_125944_benutzername.up,
    down: migration_20260819_125944_benutzername.down,
    name: '20260819_125944_benutzername',
  },
  {
    up: migration_20260819_144742_rechnungskauf.up,
    down: migration_20260819_144742_rechnungskauf.down,
    name: '20260819_144742_rechnungskauf',
  },
  {
    up: migration_20260819_172008_zahlungsabgleich.up,
    down: migration_20260819_172008_zahlungsabgleich.down,
    name: '20260819_172008_zahlungsabgleich',
  },
  {
    up: migration_20260819_172805_storno.up,
    down: migration_20260819_172805_storno.down,
    name: '20260819_172805_storno',
  },
  {
    up: migration_20260819_173532_auslastung.up,
    down: migration_20260819_173532_auslastung.down,
    name: '20260819_173532_auslastung',
  },
  {
    up: migration_20260819_174511_wiedervorlagen.up,
    down: migration_20260819_174511_wiedervorlagen.down,
    name: '20260819_174511_wiedervorlagen'
  },
];
