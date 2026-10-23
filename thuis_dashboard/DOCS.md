# Thuis Dashboard

Een mobiel dashboard voor ons huis, als Home Assistant App (add-on) met Ingress.
Werkt in de browser én in de Home Assistant Companion app (via de zijbalk).

## Installatie

1. **Instellingen → Apps (Add-ons) → Add-on store → ⋮ → Repositories**
2. Voeg toe: `https://github.com/BertVanBaelen/HA-dashboard`
3. Zoek **Thuis Dashboard** → **Installeren** (de eerste build duurt enkele minuten).
4. Zet **Toon in zijbalk** en **Start bij opstarten** aan → **Starten**.
5. Open **Dashboard** in de zijbalk (ook in de Companion app).

Updates: verhoog `version` in `config.yaml`, push naar GitHub → HA toont "Update beschikbaar".

## Gebruikers

Het dashboard herkent automatisch wie het opent (via Ingress). Iedere gebruiker kiest zelf
in ⚙️ **Instellingen → Persoonlijk**: zichtbare tabs + volgorde, starttab, thema
(auto/licht/donker + blauw/groen/roze), eigen agenda's, Welkom thuis en aankomstmeldingen.
Gedeelde zaken (presets, comfort-temperaturen, radiozenders, gedeelde agenda's, lijsten)
staan onder **Huishouden**.

Koppel elke HA-gebruiker aan zijn `person.*` (Instellingen → Personen → gebruiker kiezen),
anders werken Welkom thuis en aankomstmeldingen niet.

## Dashboard als startpagina

Home Assistant kan een app (Ingress-paneel) niet rechtstreeks als standaard dashboard kiezen.
Daarom: ⚙️ **Instellingen → Persoonlijk → Startpagina → Zet als startpagina**. Dit maakt
(eenmalig) een verborgen dashboard **Thuis Start** aan met een kaartje dat meteen
doorverwijst naar dit dashboard (bestand in `/config/www/thuis_dashboard/redirect.js`).
Kies daarna in je HA-**profiel → Dashboard → Standaard dashboard** voor **Thuis Start**.
Dit is per gebruiker/toestel, dus doe het ook in de Companion app van de ander.
Om Thuis Start zelf te bewerken: open het met `?edit=1` in de URL.

Hiervoor heeft de app schrijftoegang tot de HA-configmap (`homeassistant_config`) en moet de
gebruiker die op de knop drukt beheerder zijn.

## Benodigde scripts in Home Assistant

Het dashboard roept deze scripts aan. Maak ze aan (Instellingen → Automatiseringen → Scripts)
met **exact** deze entity-id's:

| Script | Doet |
|---|---|
| `script.tv_aan` | TV + Chromecast aan, soundbar aan (indien nodig), `input_boolean.tv_actief` aan |
| `script.tv_uit` | TV + Chromecast uit, soundbar uit, `input_boolean.tv_actief` uit |
| `script.stereo_aan` | Yamaha stereo aan, `input_boolean.stereo_actief` aan |
| `script.stereo_uit` | Yamaha stereo uit, `input_boolean.stereo_actief` uit |

Bestaande scripts die ook gebruikt worden: `script.badkamer_verwarmen`, `script.driver_al`,
`script.defrost_all`, `script.soundbar_aux`.

Voorbeeld (`script.tv_uit`):

```yaml
alias: TV uit
sequence:
  - action: remote.send_command
    target: { entity_id: remote.55mled810_12_remote }
    data: { command: Power }
  - action: scene.turn_on
    target: { entity_id: scene.soundbar_power }
  - action: input_boolean.turn_off
    target: { entity_id: input_boolean.tv_actief }
mode: single
```

## Spotify (SpotifyPlus)

Kies op de stereo de bron **Spotify** en er verschijnt een Spotify-kaart: bediening, je bibliotheek
(afspeellijsten, Liked Songs, albums, artiesten, recent, podcasts), zoeken en de wachtrij.
Alles wat je start speelt automatisch op de stereo (Spotify Connect-toestel `Eetkamer`); de stereo
wordt indien nodig eerst aangezet en op de Spotify-ingang gezet. Speelt Spotify op het moment dat je
de bron kiest op een ander toestel (bv. je gsm), dan wordt het naar de stereo overgezet.
Tik bovenaan de kaart op **Speelt op …** om een ander uitvoertoestel te kiezen; die keuze wordt per
gebruiker onthouden.

Eenmalige instelling (Spotify **Premium** is nodig):

1. Installeer **SpotifyPlus** via HACS en herstart Home Assistant.
2. Maak op <https://developer.spotify.com/dashboard> een app aan met als Redirect URI
   `https://my.home-assistant.io/redirect/oauth`. Voeg onder *User Management* elk Spotify-account
   toe dat de app gebruikt (development mode).
3. Instellingen → Apparaten & diensten → Integratie toevoegen → **SpotifyPlus**: vul Client ID en
   Client Secret in en meld je aan bij Spotify. Home Assistant bewaart en vernieuwt het token; het
   dashboard krijgt nooit je Spotify-wachtwoord te zien.
4. Een "slapend" Spotify Connect-toestel (bv. de stereo nadat hij een tijd niets speelde) kan
   SpotifyPlus alleen wekken met je Spotify Connect gebruikersnaam/wachtwoord. Vul die in bij
   SpotifyPlus → **Configureren** (opties). Zonder die login krijg je de melding dat de stereo slaapt
   (SpotifyPlus-fout SAM1005E); kies hem dan één keer in de Spotify-app of kies een ander toestel.

Spotify laat apps in development mode alleen de nummers van **je eigen** afspeellijsten (of waar je aan
meewerkt) zien. Bij afspeellijsten van anderen toont de kaart geen nummerlijst, maar Afspelen en Shuffle werken wel.

De naam van het toestel en (optioneel) de SpotifyPlus-entiteit staan in `app/shared/config.js`
(`MEDIA.spotify`). Zonder entiteit wordt de eerste SpotifyPlus-speler automatisch gebruikt.

**Meerdere Spotify-accounts:** voeg SpotifyPlus nog eens toe en meld je aan met het andere account
(dezelfde developer-app mag; voeg het account toe onder *User Management*). Elke gebruiker kiest in
Instellingen → **Spotify** zijn eigen account, of wisselt bovenaan de Spotify-kaart. Er speelt maar één
account tegelijk op de stereo: wie iets start, neemt de stereo over. Stel de Spotify Connect
gebruikersnaam/wachtwoord (stap 4) in voor elk account.

## Lokaal ontwikkelen

```powershell
cd thuis_dashboard/app
npm install
npm run build
npm run mock      # http://localhost:8099 met nep-data (?user=marjo voor Marjo)
npm run dev       # Vite dev-server met hot reload (start mock server ernaast)
```

Tegen een echte HA: `HA_URL=ws://homeassistant.local:8123/api/websocket HA_TOKEN=<long-lived token> npm start`.

## Veiligheid

De server accepteert enkel verbindingen via de Ingress-proxy, en enkel service-calls uit een
allow-list (`shared/config.js`). Instellingen worden bewaard in `/data/preferences.json`
(zit mee in HA-backups).
