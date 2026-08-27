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
import * as migration_20260819_175115_angebotsannahme from './20260819_175115_angebotsannahme';
import * as migration_20260819_175504_erechnung_plattform from './20260819_175504_erechnung_plattform';
import * as migration_20260819_182142_werkstattwochen from './20260819_182142_werkstattwochen';
import * as migration_20260819_193745_variantenstueckliste from './20260819_193745_variantenstueckliste';
import * as migration_20260819_201353_variantendienste_bestandsverlauf from './20260819_201353_variantendienste_bestandsverlauf';
import * as migration_20260819_202917_nachbestellung from './20260819_202917_nachbestellung';
import * as migration_20260819_204824_wareneingang from './20260819_204824_wareneingang';
import * as migration_20260819_233212_werkstattdateien from './20260819_233212_werkstattdateien';
import * as migration_20260820_092646_uebergabemappen from './20260820_092646_uebergabemappen';
import * as migration_20260820_095931_beigestelltes_material from './20260820_095931_beigestelltes_material';
import * as migration_20260820_135217_dkim from './20260820_135217_dkim';
import * as migration_20260820_145936_postfach_dkim from './20260820_145936_postfach_dkim';
import * as migration_20260820_154207_statistik from './20260820_154207_statistik';
import * as migration_20260820_222645_arbeitsplan from './20260820_222645_arbeitsplan';
import * as migration_20260821_055731_auftragsmeldungen from './20260821_055731_auftragsmeldungen';
import * as migration_20260821_065058_meldungen from './20260821_065058_meldungen';
import * as migration_20260821_213813_abnahme_bausteine_belege from './20260821_213813_abnahme_bausteine_belege';
import * as migration_20260822_135017_reichweite_sterne_faq from './20260822_135017_reichweite_sterne_faq';
import * as migration_20260823_073210_google_rezensionen from './20260823_073210_google_rezensionen';
import * as migration_20260823_110500_meldungen_github from './20260823_110500_meldungen_github';
import * as migration_20260823_115500_digitale_ware from './20260823_115500_digitale_ware';
import * as migration_20260823_154000_bestellung_digital_at from './20260823_154000_bestellung_digital_at';
import * as migration_20260823_160000_neuerungen from './20260823_160000_neuerungen';
import * as migration_20260823_170000_besuche from './20260823_170000_besuche';
import * as migration_20260823_181614_papierkorb from './20260823_181614_papierkorb';
import * as migration_20260823_231711_versandzonen from './20260823_231711_versandzonen';
import * as migration_20260823_235127_newsprodukte from './20260823_235127_newsprodukte';
import * as migration_20260824_000625_rueckgabe from './20260824_000625_rueckgabe';
import * as migration_20260825_075655_uebergabefotos from './20260825_075655_uebergabefotos';
import * as migration_20260826_074038_datev_nummern from './20260826_074038_datev_nummern';
import * as migration_20260826_105448_mailvorlagen from './20260826_105448_mailvorlagen';
import * as migration_20260826_140454_farbbilder from './20260826_140454_farbbilder';
import * as migration_20260827_134731_ablauf_fundament from './20260827_134731_ablauf_fundament';
import * as migration_20260827_143309_laufmarken from './20260827_143309_laufmarken';

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
    name: '20260819_174511_wiedervorlagen',
  },
  {
    up: migration_20260819_175115_angebotsannahme.up,
    down: migration_20260819_175115_angebotsannahme.down,
    name: '20260819_175115_angebotsannahme',
  },
  {
    up: migration_20260819_175504_erechnung_plattform.up,
    down: migration_20260819_175504_erechnung_plattform.down,
    name: '20260819_175504_erechnung_plattform',
  },
  {
    up: migration_20260819_182142_werkstattwochen.up,
    down: migration_20260819_182142_werkstattwochen.down,
    name: '20260819_182142_werkstattwochen',
  },
  {
    up: migration_20260819_193745_variantenstueckliste.up,
    down: migration_20260819_193745_variantenstueckliste.down,
    name: '20260819_193745_variantenstueckliste',
  },
  {
    up: migration_20260819_201353_variantendienste_bestandsverlauf.up,
    down: migration_20260819_201353_variantendienste_bestandsverlauf.down,
    name: '20260819_201353_variantendienste_bestandsverlauf',
  },
  {
    up: migration_20260819_202917_nachbestellung.up,
    down: migration_20260819_202917_nachbestellung.down,
    name: '20260819_202917_nachbestellung',
  },
  {
    up: migration_20260819_204824_wareneingang.up,
    down: migration_20260819_204824_wareneingang.down,
    name: '20260819_204824_wareneingang',
  },
  {
    up: migration_20260819_233212_werkstattdateien.up,
    down: migration_20260819_233212_werkstattdateien.down,
    name: '20260819_233212_werkstattdateien',
  },
  {
    up: migration_20260820_092646_uebergabemappen.up,
    down: migration_20260820_092646_uebergabemappen.down,
    name: '20260820_092646_uebergabemappen',
  },
  {
    up: migration_20260820_095931_beigestelltes_material.up,
    down: migration_20260820_095931_beigestelltes_material.down,
    name: '20260820_095931_beigestelltes_material',
  },
  {
    up: migration_20260820_135217_dkim.up,
    down: migration_20260820_135217_dkim.down,
    name: '20260820_135217_dkim',
  },
  {
    up: migration_20260820_145936_postfach_dkim.up,
    down: migration_20260820_145936_postfach_dkim.down,
    name: '20260820_145936_postfach_dkim',
  },
  {
    up: migration_20260820_154207_statistik.up,
    down: migration_20260820_154207_statistik.down,
    name: '20260820_154207_statistik',
  },
  {
    up: migration_20260820_222645_arbeitsplan.up,
    down: migration_20260820_222645_arbeitsplan.down,
    name: '20260820_222645_arbeitsplan',
  },
  {
    up: migration_20260821_055731_auftragsmeldungen.up,
    down: migration_20260821_055731_auftragsmeldungen.down,
    name: '20260821_055731_auftragsmeldungen',
  },
  {
    up: migration_20260821_065058_meldungen.up,
    down: migration_20260821_065058_meldungen.down,
    name: '20260821_065058_meldungen',
  },
  {
    up: migration_20260821_213813_abnahme_bausteine_belege.up,
    down: migration_20260821_213813_abnahme_bausteine_belege.down,
    name: '20260821_213813_abnahme_bausteine_belege',
  },
  {
    up: migration_20260822_135017_reichweite_sterne_faq.up,
    down: migration_20260822_135017_reichweite_sterne_faq.down,
    name: '20260822_135017_reichweite_sterne_faq',
  },
  {
    up: migration_20260823_073210_google_rezensionen.up,
    down: migration_20260823_073210_google_rezensionen.down,
    name: '20260823_073210_google_rezensionen',
  },
  {
    up: migration_20260823_110500_meldungen_github.up,
    down: migration_20260823_110500_meldungen_github.down,
    name: '20260823_110500_meldungen_github',
  },
  {
    up: migration_20260823_115500_digitale_ware.up,
    down: migration_20260823_115500_digitale_ware.down,
    name: '20260823_115500_digitale_ware',
  },
  {
    up: migration_20260823_154000_bestellung_digital_at.up,
    down: migration_20260823_154000_bestellung_digital_at.down,
    name: '20260823_154000_bestellung_digital_at',
  },
  {
    up: migration_20260823_160000_neuerungen.up,
    down: migration_20260823_160000_neuerungen.down,
    name: '20260823_160000_neuerungen',
  },
  {
    up: migration_20260823_170000_besuche.up,
    down: migration_20260823_170000_besuche.down,
    name: '20260823_170000_besuche',
  },
  {
    up: migration_20260823_181614_papierkorb.up,
    down: migration_20260823_181614_papierkorb.down,
    name: '20260823_181614_papierkorb',
  },
  {
    up: migration_20260823_231711_versandzonen.up,
    down: migration_20260823_231711_versandzonen.down,
    name: '20260823_231711_versandzonen',
  },
  {
    up: migration_20260823_235127_newsprodukte.up,
    down: migration_20260823_235127_newsprodukte.down,
    name: '20260823_235127_newsprodukte',
  },
  {
    up: migration_20260824_000625_rueckgabe.up,
    down: migration_20260824_000625_rueckgabe.down,
    name: '20260824_000625_rueckgabe',
  },
  {
    up: migration_20260825_075655_uebergabefotos.up,
    down: migration_20260825_075655_uebergabefotos.down,
    name: '20260825_075655_uebergabefotos',
  },
  {
    up: migration_20260826_074038_datev_nummern.up,
    down: migration_20260826_074038_datev_nummern.down,
    name: '20260826_074038_datev_nummern',
  },
  {
    up: migration_20260826_105448_mailvorlagen.up,
    down: migration_20260826_105448_mailvorlagen.down,
    name: '20260826_105448_mailvorlagen',
  },
  {
    up: migration_20260826_140454_farbbilder.up,
    down: migration_20260826_140454_farbbilder.down,
    name: '20260826_140454_farbbilder',
  },
  {
    up: migration_20260827_134731_ablauf_fundament.up,
    down: migration_20260827_134731_ablauf_fundament.down,
    name: '20260827_134731_ablauf_fundament',
  },
  {
    up: migration_20260827_143309_laufmarken.up,
    down: migration_20260827_143309_laufmarken.down,
    name: '20260827_143309_laufmarken'
  },
];
