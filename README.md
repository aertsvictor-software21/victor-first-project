# ARENA

Een gestileerde, kleurrijke en competitieve **3D-arena-shooter** in de browser (Three.js),
met een strakke, volwassen look voor tieners: heroïsche personages, donkere HUD en felle accenten.

> De visuele richting staat beschreven in [`docs/ART_DIRECTION.md`](docs/ART_DIRECTION.md).

## Starten

```bash
npm install
npm run dev      # ontwikkelserver op http://localhost:5173
npm run build    # productie-build in dist/
```

## Online zetten (speelbaar in elke browser)

ARENA is een statische webapp: geen installatie, geen plug-ins, werkt in Chrome, Edge, Firefox en Safari en op Chromebooks.

- **GitHub Pages (gratis):** merge naar `main` en zet eenmalig *Settings → Pages → Source: GitHub Actions* aan.
  De workflow in `.github/workflows/pages.yml` bouwt en publiceert dan automatisch.
- **Andere host (itch.io, Netlify, schoolserver):** `npm run build` en upload de map `dist/`. Dankzij relatieve paden werkt het ook vanuit een submap.

Op zwakkere toestellen (Chromebooks, ≤ 4 cores of ≤ 4 GB geheugen) start de automatische kwaliteit op *Laag*.

## Besturing

| Toets | Actie |
|---|---|
| `WASD` | Bewegen |
| Muis | Richten · linkermuisknop = schieten |
| `Spatie` | Springen (2× = dubbelsprong met salto) |
| `Spatie` tegen een muur in de lucht | **Wall-jump** (max. 3 achter elkaar) |
| `Shift` | Dash |
| `E` / `Q` | Special: **Sprongstoot** (schokgolf + lancering) |
| `1` `2` `3` / scrollwiel | Wapen wisselen |
| `R` | Herladen |
| `Tab` | Scorebord |
| `Esc` | Pauze |

## Wat zit erin

- **20 spelers per match** (jij + 19 bots) in afgebakende arena's met duidelijke muren en een energiebarrière erboven.
- **5 arena's** — Zonneweide, Koraalbaai, Wolkentuin en twee compacte, duistere arena's voor maximale chaos:
  **Neonkelder** (nachtelijke containerhal rond een bodemloze put) en **Lavakrater** (basalten ring rond een dodelijke lavaput).
- **Gestileerde personages** — heroïsche proporties, signatuurkleur en unieke headgear per personage.
  Loopanimatie vanuit de heup, salto bij dubbelsprong, trefferflits. 8 personages + 1 dagreeks-exclusief.
- **3 wapens met eigen effecten** — Pulsgeweer (snel, headshots), Stuiterwerper (stuitert, splash), Raketwerper (grote knal, knockback, raketsprong).
- **Duidelijke treffer-feedback** — hitmarkers, wegspringende schadecijfers (geel bij headshot), richting-indicator, vignet, camerashake.
- **Competitief** — vrij-voor-allen met 5 bots (3 niveaus), 3 minuten of 15 eliminaties, scorebord, podium,
  XP, ranglijstpunten, divisies (Brons → Diamant) en een seizoensranglijst.
- **Licht voor laptops** — toon-shading zonder post-processing, instancing, samengevoegde statische geometrie,
  gepoolde projectielen en deeltjes, kwaliteitsniveaus Laag/Midden/Hoog en automatische terugschakeling bij lage FPS.

## Skill

- **Wall-jumps** tegen elke muur: ontwijken, hoge plekken bereiken, tegenstanders verrassen.
- **Headshots** doen dubbele schade met het Pulsgeweer; een headshot-eliminatie geeft extra XP.
- **Raketsprong**, knockback en putten: blaas tegenstanders in de put of lava.
- Na elke match zie je je **nauwkeurigheid**, headshots en wall-jumps; uitdagingen en prestaties belonen precisie.

## Waarom je terugkomt

- **Korte matches**: *Flitsmatch* (90 s, 10 eliminaties) of *Standaard* (3 min, 15 eliminaties). Met `Enter` start je meteen opnieuw.
- **Directe beloning**: XP-popups per eliminatie, dubbele/triple eliminaties, reeksen, *Wraak!* op wie jou uitschakelde, ring-outs.
- **Dagelijkse uitdagingen**: elke dag dezelfde 3 voor iedereen, zodat je kunt vergelijken met vrienden. Je ziet live wanneer je er een haalt.
- **Levels en titels**, 12 **prestaties**, personages die je met XP vrijspeelt, ranglijstpunten en divisies.
- **Auto-moeilijkheid**: bots worden sterker naarmate jij beter wordt.

- **Dagreeks + dagelijkse beloning**: elke dag dat je speelt claim je XP (dag 1 → 7: 50 tot 300 XP).
  Op dag 7 verdien je het exclusieve personage **Solaris**, daarna elke 7e dag een bonuskist.

Geen loot boxes en geen betalingen: alles is te verdienen door te spelen.

## Structuur

```
src/
  main.js              renderer, menu's, match-verloop, auto-kwaliteit
  style/               kleurenpalet, toon-materialen, skins
  world/               arena-definities + lichte collisiewereld
  entities/            gestileerd personage + animaties
  game/                match, bots, wapens/projectielen, effecten, input, audio, opslag, progressie
  ui/                  HUD + stylesheet
docs/ART_DIRECTION.md  visuele stijlgids
```
