# Validatie en opleverstatus

Gecontroleerd op 28 oktober 2026. Basis: `bf0f248`, emai v0.2.0.
Deze fork is uitgebreid; de bestaande TypeScript-bibliotheek, mailproviders,
AI-engines en ontwikkelpagina's zijn behouden.

## Uitgevoerde controles

| Controle | Resultaat |
|---|---|
| Oorspronkelijke regressiesuite | 537/537 geslaagd vóór wijzigingen |
| Volledige uiteindelijke suite | 582/582 geslaagd, 29 bestanden |
| Nieuwe tests | 45 voor assistent, opslag, veiligheid, transport en planning |
| TypeScript bibliotheek | Geslaagd |
| Bibliotheek CJS/ESM/type declarations build | Geslaagd |
| TypeScript Next-frontend | Geslaagd |
| Next productiebuild | Geslaagd; definitieve controle op deze branch |
| Draaiende demo, HTTP | 17 assertions geslaagd, ook op productiebuild |
| Desktopbrowser | Dashboard, briefingpreview, zoeken, ontvangstbevestigingspreview, instellingen en taalwissel geslaagd |
| Mobiele browser, 390×844 | Dashboard en navigatie geslaagd; geen horizontale overflow |
| Browser JavaScript-fouten | Geen tijdens succesvolle browsercontrole |
| npm audit hoofdproject | 0 bekende kwetsbaarheden, inclusief ontwikkelafhankelijkheden |
| npm audit frontend | 0 bekende kwetsbaarheden |
| Licentie-inventaris | Geïnstalleerde afhankelijkheden geïnventariseerd; binaire distributiereview nog vereist |

HTTP-controles zijn reproduceerbaar met `node scripts/smoke-assistant.mjs`
terwijl de demo draait. Ze resetten de fictieve dataset en mogen uitsluitend op
een demo-installatie uitgevoerd worden. Browsercontrole met Playwright/Chromium op zowel ontwikkelserver als productiebuild;
visuals staan in `screenshots/`.

De nieuwe suite controleert onder meer IANA-tijdzones/zomer- en wintertijd,
instellingsvalidatie, categorie-uniciteit, loopheaders/no-reply/spamblokkades,
expliciete toestemming, per-contactregels, onzekere AI-uitvoer, letterlijk
onderbouwde deadlines en leads, opvolgstatus, gespreksdeduplicatie, maximaal vijf
prioriteiten, HTML-escaping, afzonderlijke klantopslag, bewaartermijnen,
geauthenticeerde credentialversleuteling, wissen, atomische verzendclaims,
herstel na procesonderbreking, veilige labelretries, onzekere bezorging en Gmail
thread-ID/looppreventieheaders via een gemockte SDK. Geen echte mail verzonden.

## Functiestatus

| Gevraagde functie | Geïmplementeerd | Extern nog te verifiëren/configureren |
|---|---|---|
| Dagelijks overzicht | Tijdzone/tijdstip, overzicht, tekst/HTML, lokale achtergrondtaak, deduplicatie en kanaalinterface | Gmail-verbinding en daadwerkelijke bezorging in gecontroleerd account |
| Categoriseren | Categoriebeheer, Review-fallback, lokale correctie, optionele bestaande/toegevoegde Gmail-labels | Live labeltests en modelkwaliteit |
| Afzenders en leads | Bekende geschiedenis, afzonderlijke leadfilter, bronpassage en handmatige contactkeuze | Representatieve klantdata en foutpositieven beoordelen |
| Opvolging | Actievraag, volledige gesprekscontrole, configureerbare termijn, afronden, overzicht | Echte conversaties met aliassen en diverse mailboxinstellingen |
| Ontvangstbevestigingen | Standaard uit, expliciete bevestiging, regels, testpreview, looppreventie, administratie | Gecontroleerd account en expliciete activering voor echte verzending |
| Samenvattingen | Hergebruik bestaande engines, NL/EN, gevalideerde acties en gegronde ISO-deadlines | Werkend model, juistheid en adversariële evaluatie |
| Interface | Drie hoofdschermen, Nederlands standaard, Engels, mobiel | Gebruikersonderzoek met niet-technische ondernemers |
| Lokale installatie | Node 24, SQLite, .env-voorbeeld, handleiding en afzonderlijke data per klant | Windows/macOS hardwaretest en volwaardig ondertekend installatiepakket |
| Microsoft 365 | Bestaande providerarchitectuur en Graph-code behouden | Niet beschikbaar gesteld als afgeronde integratie; consent/refresh/live tests volgende fase |
| WhatsApp | Uitbreidbaar via DeliveryChannel | Geen WhatsApp-integratie gebouwd of claim van werkende bezorging |

## Grenzen van de huidige versie

- Eén lokale mailbox per installatie; geen gedeelde gebruikersauthenticatie of
  publiek SaaS-hostingmodel. Geen publieke deployment gedaan.
- AI verwerkt maximaal 200 recente inboxberichten binnen de bewaartermijn; het
  ongelezen aantal telt de hele mailbox buiten spam en prullenbak. Het overzicht
  markeert onvolledige dekking. Belangrijke mail buiten deze selectie kan ontbreken.
- Alleen ISO-deadlines met letterlijke bronpassage worden getoond; relatieve datums
  worden niet geraden. Contactherkenning is gebaseerd op toegestane mailgeschiedenis,
  niet op een geïmporteerd volledig adresboek.
- De achtergrondtaak vereist een draaiende app en computer. Inboxsynchronisatie
  gebeurt ten hoogste elke vijf minuten automatisch; de rapportplanning wordt elke
  minuut bekeken. Handmatig bijwerken kan tussendoor.
- Geen end-to-end Gmail-, echte model-, Outlook-, offline besturingssysteem- of
  installatiepakkettests geclaimd. AI-uitval heeft veilige Review-fallbacks, maar
  betekent dat antwoordvragen/urgentie/nieuwe leads gemist kunnen worden.
- Beveiliging en rechten zijn ontwikkelcontroles; commerciële privacy-, provider-
  en target-platformreviews staan beschreven in SECURITY-LICENSING.md.

De demo en de lokale applicatiecode zijn beschikbaar voor beoordeling. Een
commerciële release vereist de genoemde integratie-, beveiligings- en OS-tests.
