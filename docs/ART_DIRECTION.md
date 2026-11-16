# ARENA — Art Direction

> Kleurrijk, vrolijk en toegankelijk op het eerste gezicht. Snel, competitief en vaardigheidsgericht zodra je speelt.

Dit document legt de visuele stijl van ARENA vast. Het verandert **niet** de kern van de gameplay
(korte matches, snelle schietgevechten, special abilities, competitieve ranglijsten) — alleen hoe de game eruitziet en aanvoelt.

ARENA heeft een volledig eigen identiteit. We gebruiken geen bestaande personages, figuren, logo's,
omgevingen of herkenbare ontwerpen uit andere games. De inspiratie is alleen de *sfeer*: helder, speels, uitnodigend.

---

## 1. Kernprincipes

| Principe | Betekenis |
|---|---|
| **Leesbaarheid eerst** | Spelers, projectielen en gevaren zijn altijd binnen een halve seconde herkenbaar. |
| **Speels, niet kinderachtig** | Ronde vormen en vrolijke kleuren, maar strakke typografie en een premium afwerking. |
| **Gestileerd > realistisch** | Toon-shading, egale kleurvlakken, contourlijnen. Geen fotorealisme. |
| **Licht en open** | Daglicht, blauwe lucht, zachte schaduwen. Geen donkere of neon-zware scènes. |
| **Licht op hardware** | Elk effect moet ook op een gewone laptop vloeiend draaien. |

## 2. Kleurenpalet

### Basis (wereld)
| Token | Hex | Gebruik |
|---|---|---|
| `sky-top` | `#4FB6FF` | Bovenkant lucht |
| `sky-horizon` | `#BFE9FF` | Horizon / mist |
| `grass` | `#6BD35A` | Grasvelden |
| `grass-dark` | `#3FAE4A` | Randen, schaduwzijde |
| `stone` | `#E8DCC6` | Rotsen, platforms |
| `water` | `#3DD6F5` | Water |
| `sun` | `#FFF4D6` | Zonlicht |

### Accenten (UI & gameplay)
| Token | Hex | Gebruik |
|---|---|---|
| `accent-sun` | `#FFC83D` | Primaire knoppen, highlights, #1 op ranglijst |
| `accent-coral` | `#FF5D73` | Schade, waarschuwingen, vijand-markers |
| `accent-mint` | `#2EE6A8` | Healing, positieve feedback |
| `accent-sky` | `#3D8BFF` | Eigen team / speler |
| `accent-grape` | `#8B5CF6` | Special abilities |
| `ink` | `#1B2340` | Tekst, contourlijnen |

**Regel:** projectielen gebruiken altijd verzadigde accentkleuren die *niet* in de omgeving van die arena voorkomen,
zodat ze nooit opgaan in de achtergrond.

## 3. Omgevingen

Elke arena heeft een eigen karakter, kleurcombinatie en één herkenbaar middelpunt.
Arena's zijn compact, symmetrisch genoeg voor eerlijk spel, met duidelijke hoogteverschillen.

| Arena | Karakter | Kleuren | Middelpunt |
|---|---|---|---|
| **Zonneweide** | Glooiend grasland, vijver, ronde rotsen | Groen, hemelsblauw, zandbeige | Vijver met springplatforms |
| **Koraalbaai** | Zonnig strand, turquoise lagune | Zandgeel, turquoise, koraalroze | Eiland in de lagune |
| **Wolkentuin** | Zwevende eilanden boven de wolken | Lavendel, mint, wit | Centrale zwevende toren |

Opbouw: zwevend basisplateau + platforms op 2–3 hoogtes + dekking (rotsen, kratten, pilaren) + decor buiten de speelzone
(bomen, wolken, bergen) dat nooit in de speelzone verstoort.

## 4. Personages

- **Silhouet:** groot hoofd (≈ 45% van de hoogte), compact lijf, korte ledematen, grote ogen.
- **Herkenbaarheid:** iedere speler heeft een unieke hoofdkleur + accessoire (oren, antenne, pet, hoorntjes, kuif)
  en een gekleurde ring onder de voeten. Contourlijn houdt figuren leesbaar tegen elke achtergrond.
- **Animatie:** squash & stretch bij springen en landen, huppelende loop, lean in de looprichting,
  knipperende ogen, terugdeinzen bij een treffer, vrolijke "pop" bij een knock-out (geen geweld/bloed).
- **Skins:** vrij te spelen via XP (zie `src/style/skins.js`).

## 5. Wapens & effecten

| Wapen | Projectiel | Impact |
|---|---|---|
| **Bubbelblaster** | Snelle cyaan bolletjes met korte staart | Kleine spetter |
| **Stuiterkanon** | Oranje ballen die stuiteren | Ring-explosie + confetti |
| **Konfettiraket** | Roze raket met rookspoor | Grote ronde knal, confetti, camerashake |

**Special — Sprongstoot:** paarse schokgolfring + opwaartse lancering. Altijd zichtbaar voor iedereen in de buurt.

**Treffer-feedback:** witte flits op het personage, wegspringende schadecijfers, hitmarker in het vizier,
korte squash van het getroffen personage. Kritieke treffers (hoofd) krijgen gele cijfers.

**Overzicht bewaren:** max. ~300 deeltjes tegelijk, effecten < 0,6 s, geen schermvullende flitsen.

## 6. Belichting

- Eén zonlicht (directional) met zachte schaduwen (PCF soft), plus een hemel/aarde-licht voor zachte vulling.
- Toon-shading met 3 tinten: licht, midden, schaduw.
- Lichte mist richting de horizonkleur geeft diepte zonder zware post-processing.
- Geen bloom, geen SSAO, geen realtime reflecties.

## 7. Interface

- **Typografie:** *Baloo 2* (koppen, speels maar strak) + *Inter* (tekst, cijfers).
- **Vormtaal:** afgeronde panelen (16–24 px radius), witte kaarten met lichte schaduw, gekleurde accentranden.
- **Beweging:** 150–300 ms ease-out overgangen, knoppen veren licht bij hover.
- **Ranglijst:** podiumkleuren goud/zilver/brons, eigen rij gemarkeerd, duidelijke cijfers in tabular numerals.
- **Premium, niet kinderachtig:** beperkt aantal kleuren per scherm, veel witruimte, geen cartoonlettertypes in lopende tekst.

## 8. Prestaties

| Instelling | Laag | Midden | Hoog |
|---|---|---|---|
| Render-resolutie | 0,75× | 1× | tot 2× (DPR) |
| Schaduwen | uit | 1024² | 2048² |
| Antialiasing | uit | aan | aan |
| Max. deeltjes | 120 | 250 | 400 |
| Decor-dichtheid | 50% | 100% | 100% |

- Low-poly geometrie (personage ≈ 1.5k driehoeken), gedeelde materialen, instancing voor gras/decor.
- Automatische kwaliteitsverlaging als de framerate langer dan enkele seconden onder 45 fps zakt.
