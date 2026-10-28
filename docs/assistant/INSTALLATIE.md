# Post — lokale AI Mail Assistant

Dit is een uitbreiding van emai, met behoud van de bestaande bibliotheek en
ontwikkelfuncties. Dit is een geteste lokale demo en een implementatie voor een
Gmail-testpilot. Het is nog geen vrijgegeven commercieel installatiepakket.

## Snel starten met fictieve e-mails

Vereist: Git, Node.js 24 LTS en npm. Geen mailbox, API-sleutel of betaald account
nodig voor de demo. Voer dit uit vanuit de hoofdmap van de repository:

```sh
npm run assistant:setup
npm run assistant:dev
```

Open **http://localhost:4000** (gebruik localhost, niet het numerieke IP-adres).
Je krijgt Dashboard, E-mails en Instellingen, met zes fictieve berichten.
De demo verstuurt niets en benadert geen echte mailbox. De app gebruikt bewust
een lokaal systeemlettertype en heeft geen externe fontdienst nodig.

Voor een geoptimaliseerde build:

```sh
npm run assistant:build
npm run assistant:start
```

Stoppen: Ctrl+C. Alle instellingen blijven lokaal bewaard. Na opnieuw starten
blijven ook de records tegen dubbele verzending behouden.

## Eén afzonderlijke installatie per klant

Gebruik een aparte map, OS-account en `ASSISTANT_DATA_DIR` per klant. Er is één
mailbox per installatie. Demo en live hebben verschillende databestanden. De app
is geen gedeeld SaaS-platform en bevat geen gebruikerslogin. Hij bindt alleen op
loopback en weigert afwijkende hosts/origins en browserverzoeken van andere sites.
Start niet meerdere processen op dezelfde gegevensmap. Bij meerdere lokale
installaties moet iedere instantie een eigen poort, origin en OAuth-redirect hebben.

## Gmail-testpilot configureren

1. Kopieer `playground/.env.example` naar `playground/.env.local`.
2. Maak in Google Cloud een OAuth-client voor een webapplicatie, activeer de Gmail
   API en configureer het toestemmingsscherm. Voeg een gecontroleerd testaccount toe.
3. Registreer exact `http://localhost:4000/api/oauth/gmail` als redirect-URI.
4. Vul `GOOGLE_CLIENT_ID` en `GOOGLE_CLIENT_SECRET` lokaal in.
5. Genereer een eigen sleutel en vul die in bij `ASSISTANT_MASTER_KEY`:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

6. Zet `ASSISTANT_MODE=live`. Herstart de app. Een live installatie begint met
   uitgeschakelde sortering, rapporten en automatische ontvangstbevestigingen.
7. Stel de gewenste functies in, sla op en kies **Gmail verbinden**. De app vraagt
   leesrechten; bij sorteren ook `gmail.modify`, bij rapporten/ontvangstbevestigingen
   ook `gmail.send`. Gmail modify is zelf een brede permissie: de app gebruikt
   daarvan uitsluitend labels toevoegen, nooit verwijderen of archiveren.
8. Kies **Bijwerken**. Test eerst uitsluitend op een aparte mailbox met fictieve
   berichten. Wijzig je later de vereiste rechten, sla op en verbind Gmail opnieuw.

OAuth heeft state-controle en PKCE. Tokens worden met AES-256-GCM versleuteld;
de sleutel staat buiten SQLite in de lokale omgeving. Mailboxwachtwoorden worden
niet gevraagd. De bestaande Gmail-adapter vernieuwt toegang via de refreshtoken.
Houd `.env.local` privé en gebruik OS-schijfversleuteling. Verlies van de sleutel
vereist opnieuw aanmelden. De sleutel is nog niet in Windows Credential Manager
of macOS Keychain geïntegreerd.

Een andere mailbox kan pas gekoppeld worden nadat de vorige lokale installatie
is gewist. **Loskoppelen** probeert de Google-toestemming in te trekken en verwijdert
ook offline de lokale toegang. Als intrekken offline niet lukt, verwijder de app
daarnaast in de beveiligingsinstellingen van je Google-account.

Voor commerciële Gmail-toegang kunnen Google-verificatie, organisatiebeleid en
een aanvullende beoordeling nodig zijn. Deze zijn geen onderdeel van deze build.

## AI instellen

Voor lokale verwerking: installeer Ollama, download een model en configureer:

```dotenv
ASSISTANT_AI_PROVIDER=ollama
ASSISTANT_AI_MODEL=llama3.1
ASSISTANT_AI_URL=http://localhost:11434
```

Het model moet Nederlands/Engels en JSON-uitvoer goed ondersteunen. Controleer
de licentie van het gekozen model apart. Deze wijziging bundelt geen modelgewichten.

Voor optionele cloudverwerking:

```dotenv
ASSISTANT_AI_PROVIDER=openai
ASSISTANT_AI_MODEL=YOUR_SUPPORTED_CHAT_COMPLETIONS_MODEL
ASSISTANT_AI_URL=https://api.openai.com/v1
ASSISTANT_AI_KEY=YOUR_PRIVATE_API_KEY
```

Gebruik een model dat de bestaande OpenAI Chat Completions-adapter ondersteunt.
Bij cloud-AI worden afzender, onderwerp en een begrensd gedeelte van de mailinhoud
naar die aanbieder gestuurd. Regel hiervoor vóór klantgebruik de vereiste afspraken
en transparantie. Zonder werkende AI plaatst de assistent berichten in Nakijken;
hij verzint geen samenvatting en verstuurt daar geen ontvangstbevestiging voor.

## Wat de functies doen

- Dagelijks overzicht op lokale IANA-tijd, standaard 08:00, aanvankelijk uit.
  Eén blijvende verzendclaim per lokale kalenderdag. E-mailkanaal achter een
  `DeliveryChannel`-interface voor een latere WhatsApp-adapter.
- De lokale achtergrondtaak controleert iedere minuut. Computer en proces moeten
  actief blijven. Na slapen volgt dezelfde dag een inhaalpoging; geen historische
  rapporten van eerdere dagen. Een onzekere bezorging wordt niet blind herhaald.
- Het ongelezen aantal telt de hele mailbox behalve spam/prullenbak. AI-analyse
  omvat maximaal 200 inboxberichten binnen de bewaartermijn. Die beperking wordt
  getoond als er meer berichten zijn. Urgentie en prioriteiten zijn dus geen
  gegarandeerd volledige mailboxaudit.
- Categorieën kunnen aangemaakt, hernoemd en verwijderd worden. Nakijken blijft
  behouden. Bij lage zekerheid gaat een bericht daarheen. Handmatige correcties
  blijven bewaard. Sortering voegt uitsluitend labels toe. Verwijderen van een
  lokale categorie verwijdert nooit providerlabels of e-mails.
- Onbekend betekent niet automatisch lead. Een concrete aanvraag met letterlijk
  onderbouwende bronpassage is nodig. Verzonden geschiedenis kan een contact als
  bekend herkennen. De gebruiker kan klant/lead/bekend/onbekend/niet-relevant kiezen.
- Opvolging gebruikt complete Gmail-gesprekken om latere eigen antwoorden te
  herkennen. Eigen automatische ontvangstbevestigingen tellen niet als inhoudelijk
  antwoord. Handmatig afronden stopt de herinnering. Het overzicht toont één
  prioriteit per gesprek. Berichten buiten de inbox worden niet langer opgevolgd.
- Ontvangstbevestigingen staan uit. Activeren of wijzigen van actieve regels vereist
  expliciete bevestiging. De testknop toont alleen een voorbeeld; verstuurt niets.
  Er worden alleen geschikte berichten van ná activeren en jonger dan één uur
  behandeld, maximaal één per gesprek. Bounces, bulkmail, afwijkende reply-to,
  automatische afzenders en onzekerheid worden uitgesloten. SPF/DMARC-afzender-
  authenticatie is nog geen aparte productregel; test spoofing in de pilot.
- Samenvattingen gebruiken de bestaande engines plus gevalideerde aanvullende
  analyse. Alleen letterlijk onderbouwde ISO-datums worden als deadline getoond.
  Relatieve datums zoals 'volgende vrijdag' worden bewust niet gegokt.
- Bij een AI-storing zijn samenvattingen, lead-detectie en antwoordvragen onvolledig.
  Nakijken blijft dan essentieel. AI kan ondanks instructies onjuiste beoordelingen
  geven; de AI krijgt geen tools, geheimen of bevoegdheid om eigen acties te bedenken.

## Privacy en gegevens wissen

SQLite bewaart afzender, onderwerp, korte analyse, contactkeuze en processtatus.
Volledige bodies en bijlagen worden niet opgeslagen door de assistentlaag.
Standaard bewaartermijn: 30 dagen, instelbaar van 1 tot 90. Opaque
verzendclaims blijven staan om oude gesprekken niet opnieuw te beantwoorden.
Contactkeuzes en instellingen blijven staan tot expliciet wissen. SQLite gebruikt
secure_delete en een privébestand; dit is geen garantie tegen herstel uit OS-back-ups.

Via Instellingen kun je alle lokale gegevens wissen. Je originele mailbox blijft
behouden. De demo wordt daarna opnieuw met fictieve berichten gevuld. Wis ook
zelfgemaakte back-ups bij een volledig verwijderverzoek.

## Status en fouten

Instellingen toont automatiseringsgeschiedenis. `sent` is door de provider bevestigd,
`demo` is uitsluitend gesimuleerd, `applied` is een labelactie, `error` is een
mislukte labelactie, `uncertain` is een verzending waarvan het resultaat niet veilig
kan worden vastgesteld. Controleer bij uncertain eerst Verzonden e-mails. Een
herstart verandert achtergebleven pending-claims in uncertain. Er is geen 'opnieuw
versturen'-knop die dit risico verbergt. Lees-/syncfouten worden de volgende minuut
opnieuw geprobeerd. Geheime providerfouten en mailinhoud komen niet in app-logs.

## Windows en macOS

De Next standalone-build is voorbereid. De werkende distributievorm is voorlopig
Node + browser met bovenstaande commando's. Een Windows .exe/.msi en een macOS
.app/.dmg zijn niet gebouwd of getest. Een latere Electron/Tauri-wrapper kan
het bestaande lokale proces starten zonder herbouw van het product. Daarvoor
zijn OS-tests, code signing/notarization, automatische updates, veilige
sleutelopslag, libvips-licentieafhandeling en een uninstall-procedure nodig.

## Terugkerende kosten

- Demo en volledig lokale Ollama-verwerking: geen vereiste software-abonnementen;
  wel eigen hardware, stroom en je bestaande mailboxabonnement.
- Geen verplichte hosting-, Supabase-, WhatsApp- of scheduler-dienst.
- Cloud-AI: verbruik wordt per model en aantal tokens afgerekend. Reken met drie
  AI-calls per nieuw geanalyseerde mail (bestaande classificatie, samenvatting,
  aanvullende analyse), plus een korte aanbeveling na synchronisatie.
- Rekenvoorbeeld, geen gegarandeerde factuur: bij 3.000 nieuwe mails/maand en
  gemiddeld in totaal 4.000 input- en 700 outputtokens per mail zijn dat 12 miljoen
  input- en 2,1 miljoen outputtokens. Bij $0,40/$1,60 per miljoen is dat ongeveer
  $8,16/maand exclusief extra aanbevelingen, retries, belastingen en wisselkoers.
  De werkelijke modelprijs en tokenverdeling bepalen de factuur.

Bronnen gecontroleerd op 28 oktober 2026:
https://developers.openai.com/api/docs/models/gpt-4.1-mini (tariefvoorbeeld,
geen modelkeuzeadvies; deze modelpagina vermeldt deprecatie)
https://ollama.com/pricing (lokaal draaien zonder abonnement).

## Ontwikkelchecks

```sh
npm test
npm run typecheck
npm run assistant:build
npm --prefix playground run typecheck
node scripts/license-inventory.mjs
npm audit
npm --prefix playground audit
```

Oude ontwikkelfuncties blijven in de code aanwezig. Alleen met
`ENABLE_LEGACY_PLAYGROUND=1` zijn de oude API-routes en ontwikkelpagina's bereikbaar;
het oorspronkelijke dashboard staat op `/legacy/dashboard`. Gebruik deze oude
configuratie uitsluitend als ontwikkelaar, nooit voor echte klantgeheimen. De
nieuwe assistent gebruikt die plaintext configuratie niet.
