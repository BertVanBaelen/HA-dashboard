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
