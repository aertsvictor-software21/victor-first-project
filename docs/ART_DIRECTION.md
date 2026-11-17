# ARENA — Art Direction (v2: volwassener, competitief)

> Gestileerd en kleurrijk, maar met de attitude van een competitieve shooter voor tieners.
> Denk aan het genre van gestileerde hero-/arena-shooters, met een volledig eigen identiteit:
> geen bestaande personages, logo's, lettertypes, menu-indelingen of herkenbare ontwerpen van andere games.

Dit document verandert alleen de visuele stijl. Gameplay en techniek blijven gelijk.

---

## 1. Kernprincipes

| Principe | Betekenis |
|---|---|
| **Cool, niet schattig** | Heroïsche proporties, vastberaden gezichten en tactische outfits. Geen bolle knuffelfiguren. |
| **Kleur als accent** | De wereld blijft zonnig en kleurrijk. De UI is donker, en felle accenten (volt-geel, cyaan, magenta) dragen de energie. |
| **Leesbaarheid eerst** | Elk personage heeft een signatuurkleur en een uniek silhouet door de headgear. Vijanden zijn magenta gemarkeerd. |
| **Snel en scherp** | Schuine (skew) vormen, afgeschuinde hoeken, condensed italic typografie: alles suggereert snelheid. |
| **Licht op hardware** | Toon-shading, geen post-processing, gedeelde materialen en samengevoegde geometrie. |

## 2. Kleurenpalet

### UI
| Token | Hex | Gebruik |
|---|---|---|
| `bg` | `#0B1230` | Panelen (82% dekking + blur), achtergrond |
| `volt` | `#FFD400` | Primaire acties, actieve tabs, #1, eigen speler |
| `cyan` | `#2EE0FF` | Info, level, uitdagingen, eigen rij |
| `magenta` | `#FF3D8B` | Vijanden, schade, eliminaties |
| `mint` | `#33F0A8` | Health, voltooid, positief |
| `violet` | `#8F5BFF` | Special ability, prestaties |
| `orange` | `#FF7A1A` | Dagreeks, beloningen |

### Wereld
De drie daglicht-arena's blijven zonnig: blauwe lucht, groen gras en turquoise water. Het licht is warmer en lager (namiddagzon) voor meer contrast en langere schaduwen.

### Duistere arena's
| Arena | Sfeer | Accenten | Licht |
|---|---|---|---|
| **Neonkelder** | Nachtelijke containerhal, skyline in de verte | Cyaan + magenta neon, violette put | Koel maanlicht + 3 gekleurde puntlichten |
| **Lavakrater** | Basalten ring met gloeiende scheuren en vulkanen | Oranje lava, opstijgende sintels | Laag warm licht + pulserend lavalicht |

Ook in de donkere arena's blijven personages goed leesbaar: het hemellicht is helder genoeg, en vijanden hebben magenta naamlabels.

### Arenagrenzen
Elke arena is afgebakend met een stevige muur (≈ 3,4–4,4 m) met een gekleurde band, plus een transparante energiebarrière erboven. Je ziet dus altijd waar de arena eindigt. De muren zijn onbeperkt hoog als collider en zijn het belangrijkste speelvlak voor wall-jumps.

## 3. Typografie

- **Koppen, cijfers en labels:** *Barlow Condensed*, 700–900, *italic*, HOOFDLETTERS.
- **Lopende tekst:** *Inter*, 400–700.
- Cijfers in de HUD en op scoreborden zijn tabular en groot. Een timer of HP-waarde moet je in een flits kunnen lezen.

## 4. Vormtaal UI

- Panelen met **afgeschuinde hoeken** (`clip-path`) in plaats van ronde hoeken.
- Knoppen en navigatie staan **schuin (skewX −8°)**, zodat ze snelheid uitstralen.
- Gekleurde **accentrand** bovenaan een paneel (geel = algemeen, magenta = gevaar, oranje = beloning).
- HP-balk in segmenten van 10%, schuin geplaatst.
- Animaties duren 150–350 ms en zijn kort en krachtig: vanaf een grotere schaal op hun plek "slaan" in plaats van stuiteren.

## 5. Personages

- **Proporties:** brede schouders, smalle taille, lange benen, stevige boots, middelgroot hoofd (~20% van de hoogte).
- **Uitrusting:** jas in signatuurkleur, borstplaat in accentkleur, rugzak, handschoenen. Het wapen wordt met twee handen vastgehouden.
- **Gezicht:** kleine ogen met schuine wenkbrauwen, voor een vastberaden uitdrukking.
- **Headgear als silhouet:** helm met vizier (Volt), omgedraaide pet (Blaze), hanenkam (Viper), koptelefoon (Nova), muts (Flash), capuchon met lichtstreep (Echo), bandana (Reef), zonnebril met stekels (Glitch) en kroon (Solaris, beloning voor de dagreeks).
- **Animatie:** benen zwaaien vanuit de heup, de romp draait mee, subtiele squash & stretch, salto bij de dubbelsprong en een flits bij een treffer.

## 6. Wapens & effecten

| Wapen | Uiterlijk | Effect |
|---|---|---|
| **Pulsgeweer** | Slank gunmetal met cyaan energielijn | Snelle cyaan pulsen, kleine impact |
| **Stuiterwerper** | Kort en dik, oranje trommel | Stuiterende granaten, ring-explosie |
| **Raketwerper** | Brede buis, magenta mond | Grote explosie met scherven en camerashake |

Explosies gebruiken felgekleurde energiescherven, geen bloed. Een eliminatie geeft een flits plus een burst in de kleur van het personage.

## 7. Toon van de teksten

Kort en stoer: *ELIMINATIE*, *TRIPLE ELIMINATIE*, *Kampioen van de arena*, *2 op rij*, *Dominant*.
Titels per level: Rookie → Challenger → Contender → Elite → Champion → Legend.

## 8. Prestaties

| Instelling | Laag | Midden | Hoog |
|---|---|---|---|
| Render-resolutie | 0,75× | 1× | tot 2× |
| Schaduwen | uit | 1024² | 2048² |
| Max. deeltjes | 120 | 250 | 400 |

Personages bestaan uit ~2k driehoeken. De automatische kwaliteit schakelt terug bij aanhoudend < 45 fps en start op *Laag* op Chromebooks en zwakke toestellen.
