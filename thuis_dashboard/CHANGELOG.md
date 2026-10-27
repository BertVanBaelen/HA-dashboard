# Changelog

## 0.7.5
- Verbinding na het heropenen van de app: de app controleert de verbinding meteen bij terugkeren
  naar de voorgrond en verbindt direct opnieuw als ze weggevallen is (in plaats van tot 10 s te wachten
  of op een "dode" verbinding te blijven hangen). Acties wachten even op de nieuwe verbinding i.p.v. meteen te falen.
- Nieuwe knop **Vernieuwen** (↻) naast Instellingen: verbindt opnieuw en herlaadt het huidige tabblad.
  Ook de melding "Verbinding verbroken" en het laadscherm zijn aantikbaar om opnieuw te proberen.
- De server stuurt elke 30 s een heartbeat zodat de ingress-proxy de verbinding niet als inactief afsluit.
- Buienradar toont nu ook de **verwachting voor de komende 2 uur** (bron: Buienradar, Benelux; daarbuiten blijft
  RainViewer met enkel het verleden). Op de tijdlijn staat een "Nu"-markering, het toekomstige deel is gearceerd
  en op de kaart verschijnt "Verwachting +… min" zolang je een voorspeld beeld bekijkt.

## 0.7.4
- Helderheid, volume en doeltemperatuur springen niet meer even terug naar de oude waarde na het instellen:
  de gekozen waarde blijft staan tot Home Assistant ze bevestigt (max. 10 s).

## 0.7.3
- Lampen met segmenten (bv. Govee Uplighter): enkel de hoofdlamp wordt getoond, de `…_segment_N`-lampen niet meer.
  Scènes blijven beschikbaar via het palet-icoon van de hoofdlamp.
- Schakelaars die bij een lamp horen (DreamView, muziekmodus, zij-/onderlicht, …) verschijnen niet meer als apparaat in de ruimte.

## 0.7.2
- Huisje (huisweergave): bij 5 of meer ruimtes wordt het huis hoger zodat naam, temperatuur en
  pictogrammen per ruimte volledig zichtbaar blijven, ook op smalle gsm-schermen.

## 0.7.1
- Plattegrond bewerken: nieuwe lijst **Koppelingen met Home Assistant** om elke ruimte op de plattegrond
  aan een HA-area te koppelen (of te ontkoppelen), met knop "Automatisch koppelen".
- "+ Ruimte" koppelt een bestaande, nog niet gekoppelde ruimte met dezelfde naam in plaats van een nieuwe te tekenen.
- Automatisch koppelen herkent ook gedeeltelijke namen (bv. "Living" ↔ "Living room") en wordt na de update één keer opnieuw uitgevoerd.

## 0.7.0
- Kamers komen nu uit de **Areas van Home Assistant**: lampen, schakelaars, scripts, sensoren, ramen/deuren,
  verwarming en de plaats van TV/stereo/soundbar volgen de area van de entiteit (of van het toestel).
  Een nieuwe lamp toevoegen = in HA de juiste area kiezen. Verbergen kan met het label `dashboard_verbergen`.
- Huisje: de plattegrond wordt getekend uit gegevens en kan door **HA-beheerders** aangepast worden via
  Instellingen → Huishouden → Plattegrond bewerken (ruimtes, vloer, icoon, deuren en ramen).
  Ruimtes met toestellen die niet getekend zijn verschijnen onder "Niet op plattegrond".
- Eenmalige migratie: de huidige plattegrond, comforttemperaturen, sensornamen en presets blijven behouden.
- Nieuwe add-on-optie `admins` (gebruikersnamen) als reserve wanneer de beheerdersrechten niet uit HA gelezen kunnen worden.
- Thuiskomstmelding biedt verwarmen aan voor de kamers met verwarming (max. 3).
## 0.6.2
- Soundbar (Media-tab en plattegrond): aan/uit, volume en ingang lopen nu via scripts
  (`script.sounbar_power`, `script.soundbar_volume_up/down`, `script.soundbar_input_toggle`) in plaats van scenes.
  Dempen doet voorlopig niets tot er een mute-script is.
- LED-strip keuken gebruikt de nieuwe entiteit `light.0x00124b001f69cb9d`.
- Systeem: de Zigbee/ZHA-kaart, de Zigbee-status bovenaan en de bijhorende serverrechten zijn verwijderd.

## 0.6.1
- Auto → **Ritten** in een nieuw jasje: overzicht van de laatste 10 dagen met km per dag, kaart met alle gereden
  routes en per rit een kaartje met de route, vertrek- en aankomstplaats, verbruik (groen/oranje/rood) en een
  batterijbalk. Tik op een rit om de route groot te bekijken.
- Auto → **Kosten**: totaal met verdeling thuis/AC vs. snelladen/DC, kosten per dag, en per laadbeurt een kaart
  met icoon, batterijbalk en (buiten thuis) de laadlocatie op de kaart.
- Routes en locaties komen van de GPS-tracker van de auto; plaatsnamen via OpenStreetMap (lokaal gecachet).

## 0.6.0
- Nieuw tabblad **Nieuws** met VRT NWS, NOS, BBC News, Sporza en Tweakers. Eén bericht per kaart: veeg opzij om
  het weg te doen (met "Ongedaan maken"), scroll om het volledige artikel te lezen. Berichten zonder volledige
  tekst (Tweakers, video's) tonen enkel de samenvatting en een knop naar de site.
- Per bron kies je **Alles**, **Belangrijk** (enkel de grote verhalen van de dag) of **Uit**. Standaard: Sporza en
  Tweakers op Belangrijk. Hetzelfde verhaal bij meerdere bronnen verschijnt maar één keer.
- Weggeveegde berichten worden per gebruiker onthouden, ook over toestellen heen.

## 0.5.5
- Buienradar: nu een kaart met tijdslider (laatste 2 uur, afspelen/pauze) en een marker op jouw locatie
  (of thuis als je locatie onbekend is). Bron: RainViewer.
- Home: tik op een kamer in **Binnen** om meteen naar die kamer in **Huisje** te gaan.
- Huisje: de zon van het Klimaat-tabblad (volgt het zonnepercentage, 's nachts de maan) staat nu ook in het
  huisje en op de plattegrond.
- Stereo: de knoppen Soundbar aan/uit en Ingang zijn kleiner.

## 0.5.4
- Spotify: de volumeslider is weg; gebruik de volumeknoppen van de soundbar.
- Stereo: **Soundbar aan/uit** en **Ingang wisselen** staan nu meteen onder de soundbar-volumeknoppen (niet meer
  verstopt onder Geavanceerd).

## 0.5.3
- Spotify: afspeellijsten van iemand anders tonen geen "Forbidden"-fout meer. Spotify laat apps sinds 2026 alleen
  de nummers van je eigen afspeellijsten zien; de kaart zegt dat nu duidelijk en Afspelen/Shuffle werkt gewoon.

## 0.5.2
- Tabblad **Plattegrond** heet nu **Huisje** en toont de kamers ook als huisje (zoals bij Klimaat). Wissel onder de
  tekening tussen huisje en plattegrond; je keuze wordt onthouden. Kamers zonder apparaten staan niet in het huisje.

## 0.5.1
- Spotify: kies zelf het **uitvoertoestel** (tik op "Speelt op …" bovenaan de Spotify-kaart). De keuze wordt per
  gebruiker onthouden; alles wat je start speelt daarna op dat toestel.
- Spotify: "Naar eetkamer" geeft geen SAM1005E-fout meer maar een duidelijke melding wanneer de stereo slaapt, en
  opent meteen de toestelkeuze.
- Spotify: afspelen werkt weer (hervat op het actieve toestel of brengt de muziek naar het gekozen toestel).

## 0.5.0
- Media: **Spotify-kaart** (via SpotifyPlus) wanneer de stereo op Spotify staat: afspelen/pauze, vorige/volgende,
  spoelen, shuffle, herhalen, volume, Liked Songs, wachtrij, zoeken en je bibliotheek (afspeellijsten, albums,
  artiesten, recent, podcasts). Muziek speelt automatisch op de stereo (Eetkamer).
- Stereo: bron Spotify kiezen haalt een Spotify-sessie van een ander toestel naar de stereo.
- Spotify per gebruiker: kies je eigen Spotify-account in Instellingen (of bovenaan de Spotify-kaart).
- Stereo-pagina vernieuwd: bovenaan de bronkeuze (Spotify, Radio, CD, Platenspeler), daaronder het soundbar-volume
  en daaronder de kaart van de gekozen bron (Spotify-kaart of radiozenders; niets extra bij CD/platenspeler).

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
