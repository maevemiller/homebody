# Color

Last updated: 2026-10-30. Part of `docs/reference/design-principles/` (see `README.md`).

This builds on `../interior-design/palettes-materials-patterns.md` (Homebody's 12 palette families, with hex values)
and `craft-standards.md` (60-30-10, undertones, and window orientation). It adds three things: a data source for
combinations with real taste (Wada Sanzō), the numbers behind interior color (LRV, area, light), and the rules a
model and code can check.

---

## 1. Wada Sanzō's *A Dictionary of Color Combinations*

**What it is.** Wada Sanzō (1883–1967), a Japanese painter, costume designer and color researcher, published
*Haishoku Sōkan* in six volumes in 1933–34. It lays out 348 combinations of two, three or four colors drawn from 159
named colors, pulling on Western Modernism and Japanese tradition. Seigensha reissued it in 2010 as *A Dictionary of
Color Combinations*, and designers use it widely as a taste reference because its pairings are surprising and
proven, not formula color-wheel harmonies.

**The data is downloaded.** It's in `data/wada-sanzo-colors.json` (MIT, from mattdesl/dictionary-of-colour-combinations;
provenance and license in `data/README.md`). There are 159 colors, each with name, hex, RGB, CMYK and Lab, plus the
ids of the combinations it belongs to. Of the 348 combinations, 120 have two colors, 120 three and 108 four.

Examples:

| # | Colors | Read |
|---|---|---|
| 1 | English Red `#d96629` + Cerulean Blue `#0093a5` | warm/cool complement, equal value (L* 57/55) |
| 121 | Brown `#7c4226` + Ochraceous Salmon `#d8a37b` + Lincoln Green `#555832` | earthy, mid-century, two darks + one light |
| 176 | Hermosa Pink `#f9c1ce` + Seashell Pink `#fdd4bd` + Calamine Blue `#78cdd0` | pastel, high-key |
| 348 | Olive Buff `#c1c494` + Cossack Green `#437742` + Deep Slate Olive `#253122` + Cotinga Purple `#501345` | moody, deep, one light lifter |

### How Homebody should use it

Wada's combinations are mostly **saturated, equal-area print palettes**. Painting a room in them literally would be
garish. Use them as a **taste oracle for the accent and secondary roles**, not as the wall color:

1. **Anchor matching.** Given a color already fixed in the room (a kept sofa, the floor, a rug, the user's chosen
   cobalt), find Wada colors within ΔE2000 ≤ 10 of it (in Lab; the data already has Lab). Every combination containing
   a match is a candidate set of *colors proven to go with that anchor*.
2. **Rank candidates** by fit with the person's palette family (from Taste Builder): mean ΔE from each Wada color
   to the nearest swatch in their palette, plus a penalty for colors in their "never" list.
3. **Assign roles by value and chroma, not by order:** the lightest, least saturated color, or a desaturated tint of
   it, goes to the 60% role (walls, the largest surfaces); the deepest goes to the 30% role or to wood and
   upholstery; the most saturated to the 10% role.
4. **Tone it down for large areas:** for any color used over about 10% of the visible area, lower Lab chroma by
   30–60% and keep the hue (see §3, area effect).
5. **Show the source.** "These three come from Wada Sanzō's 1933 dictionary, combination 121." It's a credible,
   charming detail the dossier or brief can cite.

This gives the model real, curated taste for *which colors go together* while 60-30-10, undertone and LRV rules
keep it livable. It costs about 60 KB of JSON and no model calls; the lookup is plain code.

## 2. 60-30-10, and when to bend it

Craft-standards has the base rule (60 dominant, 30 secondary, 10 accent, each role named). Additions:

- **Measure by visible area in the rendered view,** not by count of items. Walls, floor and the largest upholstery
  usually make up the 60% on their own.
- **Neutrals count.** In a warm minimal room, 60% oat walls + 30% walnut and camel leather + 10% black and rust is
  a full 60-30-10.
- **Variants:** 70-20-10 for minimal, Japandi or tonal schemes; 50-30-20 or 60-30-10 with two accents (5 + 5) for
  eclectic or maximalist. Above three non-neutral hues, there must be a unifying thread (a shared value or chroma
  level, or a shared undertone).
- **Accent repetition:** the 10% is spread over at least three locations (see `coherence.md`).
- **Value range:** a room needs a light, a mid and a dark. A room with no dark reads washed out; with no light, it
  reads heavy. Black (or the darkest value) in small doses (a picture frame, a lamp base, legs) "grounds" a scheme.

## 3. Interior color science (what makes a swatch lie)

### Light reflectance value (LRV)
- **LRV** is the percentage of visible light a paint reflects (0 = black, 100 = perfect white). Paint makers
  publish it per color. Most whites run 80–94; mid-tones 30–60; deep colors under 15.
- **Computable from color:** LRV ≈ CIE relative luminance Y × 100 (from sRGB, linearised). Code can estimate it for
  any swatch, including Wada's.
- **Rules:**
  - Dim or north-facing rooms: walls with **LRV ≥ 60** (some sources say ≥ 55) and a warm undertone, or go
    deliberately dark and moody (LRV < 15). Avoid mid-tones (LRV 20–50) in low light; they turn muddy.
  - Bright, south- or west-facing rooms can take mid and dark values, and even benefit from them (less glare).
  - Ceilings are usually LRV 80+ (lighter than the walls) unless the scheme is color-drenched.
  - Trim vs wall: keep **≥ 5–10 points of LRV difference** for definition, or use the same color in a different
    sheen (drenching), on purpose.
  - Accessibility: **≥ 30 points LRV difference** between adjacent planes that people must tell apart (floor and
    wall, door and wall, a grab bar and the wall) for low vision; this is UK guidance (BS 8300), widely used (see
    `people.md`).

### The area effect
A color looks **lighter and more saturated on a large wall** than on a chip. Pick wall colors a step greyer and
lighter than the chip that looks right in hand. In code, when a color moves from a 10% role to a 60% role, drop its
chroma.

### Light direction and color temperature
Craft-standards gives window orientation (north is cool and even, south warm and bright, east warm in the morning
then cool, west cool then warm and strong in late afternoon; reverse it in the southern hemisphere). How that
shifts color:

| Light | Effect on color | Lean |
|---|---|---|
| North (cool, indirect) | Blues and greys go colder and darker; warm whites stay soft | warm undertones, higher LRV, or embrace depth |
| South (warm, strong) | Everything warms and brightens; yellows can go loud | cooler or greyer neutrals hold; saturated colors fine |
| East | Warm in the morning, flatter and cool after | plan for the time the room is used most |
| West | Flat in the morning, golden and intense in the evening | avoid hot oranges and yellows that over-warm at sunset |
| 2700K lamps | Warm: kills blues, enriches reds and woods | test cool colors under 2700K |
| 4000K+ lamps | Cool: flattens warm neutrals | rarely right at home (see `lighting.md`) |
| Low-CRI LEDs (< 90) | Reds and skin look dull | specify CRI ≥ 90 and R9 ≥ 50 |

**Metamerism:** two finishes that match in one light can split in another. A sofa and cushions that match in a
daylight photo can drift apart under 2700K, so match in the room's real light.

### Undertones
Craft-standards: warm whites with warm woods; cool whites with cool stone and steel. More detail:
- **Find an undertone** by comparing a neutral to a pure reference: against pure white, beige shows yellow,
  pink or green; grey shows blue, green or violet. In Lab, a* > 0 leans pink or red, a* < 0 green; b* > 0 leans
  yellow, b* < 0 blue. Code can classify any swatch this way.
- **Greige** (b* slightly positive, a* near 0) is the safe bridge between warm and cool.
- **Woods** have undertones too: red oak pink, white oak yellow-green-grey, walnut violet-brown, cherry red, maple
  yellow (see `materials-fabrics.md`).
- **The rule:** all neutrals in one view share an undertone family, or the room deliberately contrasts warm and cool
  (cool stone + warm wood) and repeats that contrast.

## 4. Harmony types (vocabulary for the model)

Hue angles in a perceptual space (LCh, OKLCH):
- **Monochrome / tonal:** one hue, 3–5 values. Calm, sophisticated (`monochrome` palette).
- **Analogous:** hues within about 30–60° of each other (e.g. olive, ochre, rust). Warm and easy.
- **Complementary:** about 180° apart (cobalt and rust/orange; green and pink). Lively; use one muted and one
  saturated, at unequal areas.
- **Split-complementary:** a base + the two hues ±30° from its complement. More forgiving than complementary.
- **Triadic:** three hues about 120° apart. Playful; mute two of them.
- **Neutral + accent:** most real homes. A neutral 60/30 with a single hue family for the 10.

Formula harmonies are a fallback; Wada's curated combinations (§1) and Homebody's palette families are better
taste sources. Use these names to *explain* a choice.

## 5. Color and feeling (use carefully)

General associations hold loosely in Western contexts. Cultural meaning varies, so ask and don't assume (see
`people.md`):
- Blues and greens: calm, restful, good for bedrooms. Too cool in north light.
- Warm reds and oranges: energy and appetite; dining rooms and accents, not bedroom walls.
- Yellow: cheerful in small doses; tiring over large areas in strong light.
- Dark colors: enveloping, intimate, they make walls recede in small rooms at night (a "moody" choice).
- Whites: they amplify light, but stark blue-whites feel clinical.

## 6. Other open palette and color-name sources

| Source | What | License | Use? |
|---|---|---|---|
| **Wada Sanzō (mattdesl)** | 159 colors, 348 combinations | MIT (book is PD in Japan) | **Yes, downloaded** |
| meodai/color-names | ~30k named colors (for naming a swatch: "Oat", "Bottle green") | MIT (per repo; verify) | Yes, for naming |
| xkcd color survey | 954 common color names from 200k people | CC0 (per xkcd; verify) | Yes, for plain-English names |
| COLOURlovers API | Millions of user palettes | CC BY-NC-SA 3.0 | **No**: non-commercial |
| Colormind | ML palette generator API | Terms unclear | Not without terms |
| Coolors, Adobe Color | Popular palettes | Proprietary, no bulk license | No |
| Paint makers (Sherwin-Williams, Benjamin Moore, Farrow & Ball) | Named colors with LRV | Names trademarked; data not openly licensed | Link to paint pages; don't redistribute |
| Munsell, NCS, Pantone | Color systems | Proprietary | No |

Paint recommendations should name the real paint (e.g. a real off-white with its LRV) through the sourcing layer, not
a hex value; the hex is a preview.

## 7. Checkable color rules

1. Areas by role are within ±10 points of the target ratio (60-30-10 or the blend's variant).
2. Each non-neutral accent hue appears in ≥ 3 places, in ≥ 2 zones, at ≥ 2 heights.
3. At most 3 non-neutral hue families in a room, unless the style is eclectic or maximalist.
4. All neutrals share an undertone (Lab a*/b* sign test), or the warm/cool contrast is repeated at least twice.
5. A light value (L* > 80), a mid value and a dark value (L* < 30) are all present.
6. Wall LRV ≥ 60 in a north-facing or dim room, unless the scheme is deliberately dark (LRV < 15).
7. Large-area colors have lower chroma than accent colors (`chroma(60%) < chroma(10%)`).
8. Fabric and finish colors are judged under the room's lamp temperature, not only daylight.

## Sources

- [mattdesl/dictionary-of-colour-combinations (MIT)](https://github.com/mattdesl/dictionary-of-colour-combinations)
- [npm: dictionary-of-colour-combinations](https://npmjs.com/package/dictionary-of-colour-combinations)
- [dblodorn/sanzo-wada (original data)](https://awesome.ecosyste.ms/projects/github.com%2Fdblodorn%2Fsanzo-wada)
- [Homes & Gardens: What is light reflectance value](https://homesandgardens.com/interior-design/what-is-light-reflective-value)
- [Livingetc: Guide to color LRV](https://www.livingetc.com/advice/guide-to-color-light-reflecting-values)
- [Homebuilding: What is paint LRV](https://www.homebuilding.co.uk/paint/what-is-paint-lrv)
- [Welsh Design Studio: LRV of paint](https://welshdesignstudio.com/light-reflectance-value-lrv-of-paint/)
- [Welsh Design Studio: Neutrals for north-facing rooms](https://welshdesignstudio.com/best-neutral-paint-colors-for-north-facing-rooms/)
- [Muro: How LRV affects paint choice](https://usemuro.com/en/blog/how-lrv-affects-your-paint-choice)
- [Resene: The rule of three](https://www.resene.co.nz/homeown/colour-inspiration/61-rule-of-three.htm)
- [Waveform Lighting: 80 vs 90 vs 95 CRI](https://www.waveformlighting.com/home-residential/does-color-rendering-matter-80-cri-vs-90-cri-vs-95-cri)
- [colourlovers R client README (data license)](https://packages.oit.ncsu.edu/cran/web/packages/colourlovers/readme/README.html)
