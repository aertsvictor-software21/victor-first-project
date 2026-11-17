# ARENA

Een kleurrijke, vrolijke en competitieve **3D-arcade shooter** in de browser (Three.js).
Toegankelijk op het eerste gezicht, snel en vaardigheidsgericht tijdens het spelen.

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
| `Shift` | Dash |
| `E` / `Q` | Special: **Sprongstoot** (schokgolf + lancering) |
| `1` `2` `3` / scrollwiel | Wapen wisselen |
| `R` | Herladen |
| `Tab` | Scorebord |
| `Esc` | Pauze |

## Wat zit erin

- **3 arena's met eigen karakter** — Zonneweide (grasland + vijver), Koraalbaai (strand + lagune), Wolkentuin (zwevende eilanden).
  Springplatforms, water dat je vertraagt, dekking op meerdere hoogtes en health-pickups.
- **Gestileerde personages** — groot hoofd, grote ogen, contourlijn, gekleurde grondring.
  Squash & stretch, huppelende loop, salto bij dubbelsprong, knipperen, trefferflits, "pop" bij een KO.
  8 skins, waarvan 4 vrij te spelen met XP.
- **3 wapens met eigen effecten** — Bubbelblaster (snel, headshots), Stuiterkanon (stuitert, splash), Konfettiraket (grote knal, knockback, raketsprong).
- **Duidelijke treffer-feedback** — hitmarkers, wegspringende schadecijfers (geel bij headshot), richting-indicator, vignet, camerashake.
- **Competitief** — vrij-voor-allen met 5 bots (3 niveaus), 3 minuten of 15 KO's, scorebord, podium,
  XP, ranglijstpunten, divisies (Brons → Diamant) en een seizoensranglijst.
- **Licht voor laptops** — toon-shading zonder post-processing, instancing, samengevoegde statische geometrie,
  gepoolde projectielen en deeltjes, kwaliteitsniveaus Laag/Midden/Hoog en automatische terugschakeling bij lage FPS.

## Waarom je terugkomt

- **Korte matches**: *Flitsmatch* (90 s, 10 KO's) of *Standaard* (3 min, 15 KO's). Met `Enter` start je meteen opnieuw.
- **Directe beloning**: XP-popups per KO, Dubbel-/Driedubbel-KO's, reeksen, *Wraak!* op wie jou uitschakelde, ring-outs.
- **Dagelijkse uitdagingen**: elke dag dezelfde 3 voor iedereen, zodat je kunt vergelijken met vrienden. Je ziet live wanneer je er een haalt.
- **Levels en titels**, 12 **prestaties**, personages die je met XP vrijspeelt, ranglijstpunten en divisies.
- **Auto-moeilijkheid**: bots worden sterker naarmate jij beter wordt.

- **Dagreeks + dagelijkse beloning**: elke dag dat je speelt claim je XP (dag 1 → 7: 50 tot 300 XP).
  Op dag 7 verdien je het exclusieve personage **Zonnestraal**, daarna elke 7e dag een bonuskist.

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
