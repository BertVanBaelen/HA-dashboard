# Changelog

## 0.4.1
- Media: play/pauze, terugspoelen en vooruitspoelen werken weer (via de Chromecast-afstandsbediening).

## 0.4.0
- Nieuw tabblad **Plattegrond**: per kamer temperatuur, lampen en meer; tik op een kamer voor alle instellingen.
- Startpagina: springt niet meer terug naar het standaard HA-dashboard na het openen van Thuis Dashboard.
- Personen: tijdelijke meldingen "Komen & gaan" (1–8 uur of tot morgen) wanneer iemand thuiskomt of vertrekt.
- Systeem: Zigbee via ZHA (toestellen, LQI, laatst gezien, koppelen); Zigbee2MQTT/MQTT-onderdelen verwijderd.
- Auto: verbruik in kWh/100km, nieuwe onderdelen "Ritten" en "Kosten" (laden < 10 kW € 0,37/kWh, > 10 kW € 0,65/kWh,
  op basis van de HA-geschiedenis), overbodige cijfers weg, stoelverwarming zet niveau en schakelaar apart aan.
- Agenda: afspraken maken in je eigen agenda's.
- Home: tik op de regengrafiek voor de buienradar.
- Klimaat: draaiknoppen vervangen door −/+ knoppen en snelkeuzes (geen per ongeluk draaien meer bij scrollen).
- Verlichting: Govee vloerlamp verwijderd, LED-strip keuken toegevoegd.
- Stereo: duidelijke melding (en uitzetknop) als de sleep timer aan staat.

## 0.3.3
- Fix: het dashboardpaneel is ook zichtbaar voor niet-beheerders, zodat hun startpagina kan doorverwijzen.

## 0.3.2
- Fix: Net Radio bladeren gaf "media_content_type and media_content_id must be provided together".
  Favorieten: Andere radio → Net Radio → Podcasts → Favorites.

## 0.3.1
- Stereo: radio speelt nu via Net Radio van de MusicCast-stereo zelf (niet meer via de server-/URL-functie).
  In 'Andere radio' blader je door het Net Radio-menu van de stereo; tik op de ster om een favoriet toe te voegen.
  Oude favoriete zenders (stream-URL's) worden verwijderd: voeg ze opnieuw toe via Net Radio.

## 0.3.0
- Media: play/pauze, terugspoelen en vooruitspoelen sturen nu altijd de TV-afstandsbediening aan.
  Pijlen zijn de standaard-afstandsbediening. Scrollen werkt ook als je vinger op de knoppen begint.
  De Stereo-knop wordt correct geselecteerd wanneer de stereo speelt.
- Auto: nieuw onderdeel "Data" met kerncijfers, alle grafieken en een doorzoekbare lijst met alle info.
- Personen: lopende afspraken uit de actieve agenda's verschijnen op de persoonskaart ("Nu bezig").
- Rustiger: de meeste bewegende/dansende iconen zijn weggehaald of veel subtieler gemaakt.

## 0.2.0
- Nieuw: dashboard als startpagina van Home Assistant (Instellingen → Persoonlijk → Startpagina).
- Home: regengrafiek voor de komende 5 uur, leuke kledij-iconen, geen Tado-verwijzingen meer.
- Klimaat: draaiknop-thermostaat per kamer, huis-illustratie (buiten/binnen/zon/open ramen),
  "Uit" vooraan, boost in een uitklapbaar deel, tweede slaapkamersensor weg.
- Media: TV-knop volgt de status van de Chromecast.
- Auto: stoelverwarming via een keuzelijst (Uit/niveau).
- Agenda: kleuren per agenda instelbaar, agenda's van andere personen tonen via persoonchips.
- Grafieken: thermostaattemperaturen i.p.v. kamersensor, zon % bij buiten, batterijen van persoonlijke toestellen.
- Geen scrollbalk meer op gsm.

## 0.1.0
- Eerste versie: tabs Home, Klimaat, Verlichting, Media, Auto, Agenda & Lijsten, Personen, Systeem en Grafieken.
- Per gebruiker: zichtbare tabs, volgorde, starttab, agenda's, thema (licht/donker/auto + blauw/groen/roze).
- Huishouden: presets, comfort-temperaturen, radiozenders, gedeelde agenda's en lijsten.
- Welkom thuis / Alles uit, aankomstmelding.
