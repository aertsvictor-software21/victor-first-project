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

## Structuur

```
src/
  main.js              renderer, menu's, match-verloop, auto-kwaliteit
  style/               kleurenpalet, toon-materialen, skins
  world/               arena-definities + lichte collisiewereld
  entities/            gestileerd personage + animaties
  game/                match, bots, wapens/projectielen, effecten, input, audio, opslag
  ui/                  HUD + stylesheet
docs/ART_DIRECTION.md  visuele stijlgids
```
