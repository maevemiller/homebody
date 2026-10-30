# Palettes, materials and patterns

Last updated: 2026-10-27. Part of the Homebody interior-design reference (see `README.md`).

Visual vocabularies the Taste Builder can render as tappable choices: palette strips, wood chips, metal dots,
fabric tiles, pattern tiles. Every item has an id-able name, hex values the UI can draw, and the style families it
points to (see `style-families.md`).

**About the hex values.** They're Homebody-authored approximations for on-screen swatches, not paint matches. Real
paint and wood shift with light; when we recommend real products, use the product's own swatch or photo.
Materials and patterns should be shown as **photographic close-ups**; the hex values here are the fallback (flat
swatches, loading states, the dossier drawing).

---

## 1. How designers use color (rules the UI should respect)

- **60-30-10:** about 60% dominant (walls, big pieces; usually a neutral), 30% secondary (upholstery, curtains, a
  rug), 10% accent (pillows, art, a lamp). Render each palette in this ratio so it reads like a room, not a paint
  chart.
- **Undertone matters more than hue.** Warm neutrals have yellow/red/pink undertones; cool neutrals have
  blue/green/grey. Blue-based accents sit best with cool whites and greys; red-based accents with warm whites.
- **Wood has undertones too.** Pick a dominant wood and keep undertones consistent; mix at most two or three
  finishes.
- **Light vs dark (value) is its own preference**, separate from hue. Ask it as its own this-or-that.

## 2. Palette families

Each palette has 6 swatches: three neutrals (the 60/30) and three accents (the 10). Render as a strip with the
first swatch widest.

### Warm neutrals
Cream, oat, sand, camel, terracotta hint. → warm minimal, organic, transitional, Japandi
| Warm white | Oat | Sand | Camel | Clay | Espresso |
|---|---|---|---|---|---|
| `#F4EEE3` | `#E6DCCB` | `#D3C2A6` | `#B08D62` | `#B8704E` | `#3E2C23` |

### Cool neutrals
Grey, stone, slate, crisp white. → minimal/modern, Scandinavian, transitional, coastal
| Crisp white | Mist | Pebble | Stone | Slate | Charcoal |
|---|---|---|---|---|---|
| `#F6F7F7` | `#E3E6E6` | `#C9CDCD` | `#A3A8A9` | `#6E777B` | `#33393D` |

### Earthy
Terracotta, ochre, olive, rust, mushroom. → organic, Mediterranean, boho, mid-century, Indian influences
| Mushroom | Ochre | Terracotta | Rust | Olive | Bark |
|---|---|---|---|---|---|
| `#CDBFAE` | `#C99A3E` | `#C0673F` | `#9C4A2A` | `#6F6F3C` | `#4A3A2C` |

### Jewel tones
Emerald, sapphire, ruby, amethyst, gold. → Art Deco, maximalist, traditional, Indian influences
| Ivory | Emerald | Sapphire | Ruby | Amethyst | Antique gold |
|---|---|---|---|---|---|
| `#F2EDE2` | `#1F5E4B` | `#24427A` | `#8E1F35` | `#5B3A6E` | `#B8913B` |

### Pastels (soft color)
Blush, sage, powder blue, butter, lilac. → Scandinavian, grandmillennial, French country, coastal
| Chalk | Blush | Butter | Sage | Powder blue | Lilac |
|---|---|---|---|---|---|
| `#F7F3EE` | `#EBC9C1` | `#F0DFA8` | `#B9C6AC` | `#B7CBDD` | `#CDBFD9` |

### Monochrome (tonal)
One hue in many values; shown here in greige, but the UI can offer any hue tonally. → warm minimal, Japandi,
minimal
| Bone | Linen | Greige | Taupe | Umber | Ink |
|---|---|---|---|---|---|
| `#EFEAE2` | `#DDD5C9` | `#BFB4A5` | `#958979` | `#615749` | `#2F2A24` |

### High contrast
Black and white with one strong accent. → minimal/modern, Art Deco, industrial, modern farmhouse
| Paper white | Black | Ash | Signal red | Cobalt | Brass |
|---|---|---|---|---|---|
| `#FAFAF8` | `#141414` | `#8C8C8A` | `#C2362B` | `#2B4FA3` | `#B5964A` |

### Extra families worth offering on a "more" tap
| Family | Swatches | Points to |
|---|---|---|
| **Moody / dark** | `#2E2B28` `#3D4A44` `#4B3B47` `#6A5642` `#A8875B` `#E9E1D3` | Copenhagen dark, Art Deco, traditional library |
| **Coastal** | `#F5F3EE` `#E4DCCB` `#C8D7DC` `#8FB2C2` `#3F6A84` `#B7A98E` | coastal, Mediterranean |
| **Mid-century** | `#F1E8D8` `#D9A441` `#C2662D` `#6B7A3A` `#2F6F73` `#5A3B24` | mid-century |
| **Indian festive** | `#F3E9D6` `#E3A72F` (haldi) `#D9643A` (marigold) `#C2416B` (rani pink) `#2E3F7A` (indigo) `#2F5D4A` (deep green) | Indian influences |
| **Mediterranean** | `#F6F1E7` `#E5D3B3` `#C7764B` `#7A8450` `#2C5A8C` `#D9B44A` | Mediterranean |

## 3. Woods

Show as photographed planks with visible grain. Hex is a mid-tone of the plank.

| Wood | Hex | Undertone | Points to |
|---|---|---|---|
| Birch / maple | `#E8D6B5` | warm-neutral, very light | Scandinavian |
| Ash | `#DCC7A1` | neutral, light, strong grain | Scandinavian, Japandi |
| White oak (natural) | `#CDB48E` | warm-neutral | warm minimal, Japandi, Scandinavian, transitional |
| Bleached / whitewashed oak | `#DDD3C4` | cool-neutral | coastal, French country, warm minimal |
| Pine (knotty) | `#D9B27C` | warm yellow | Scandinavian rustic, farmhouse |
| Bamboo | `#D2B47C` | warm yellow | Japandi |
| Teak | `#A8743F` | warm golden | mid-century, Indian, outdoor/coastal |
| Cherry | `#8E4A2F` | warm red | traditional, grandmillennial |
| Walnut | `#5E4130` | warm-neutral brown | mid-century, transitional, warm minimal accent |
| Sheesham | `#6E4429` | warm red-brown | Indian influences |
| Reclaimed / weathered | `#8C7B68` | grey-warm | modern farmhouse, industrial, wabi-sabi |
| Ebonized / black-stained | `#2A2523` | neutral | Japandi accent, minimal, Art Deco |
| Mahogany | `#5A2A1E` | warm red | traditional |

## 4. Stone, plaster and ceramic

| Material | Hex | Points to |
|---|---|---|
| Limewash / plaster (warm) | `#E7DED1` | warm minimal, Mediterranean, wabi-sabi |
| Travertine | `#D9C7A8` | warm minimal, organic |
| Carrara marble | `#ECECEA` + grey veins `#B9BDBF` | transitional, minimal, traditional |
| Green marble | `#2F4A3E` | Art Deco |
| Black granite / slate | `#3A3C3D` | minimal, industrial |
| Polished concrete | `#A9A7A2` | minimal, industrial |
| Terracotta tile | `#B9653E` | Mediterranean, organic, Indian |
| Zellige (handmade tile) | `#D8E0DA` (and colors) | Mediterranean, boho |
| Exposed brick | `#9A5040` | industrial |
| Stoneware / raw clay | `#B9A58C` | wabi-sabi, Japandi, organic |

## 5. Metals

Show as small round finish chips with a highlight.

| Metal | Hex | Points to |
|---|---|---|
| Unlacquered / antique brass | `#B5964A` | mid-century, traditional, Indian, Art Deco |
| Polished brass / gold | `#D4AF37` | Art Deco, glam |
| Copper | `#B06A44` | French country, industrial |
| Bronze / oil-rubbed | `#4E3B2E` | traditional, transitional |
| Matte black steel | `#1E1E1E` | industrial, modern farmhouse, minimal |
| Chrome / polished nickel | `#C9CCCE` | Art Deco, minimal, transitional |
| Brushed nickel / stainless | `#A7A9A9` | transitional, minimal |
| Wrought iron | `#2B2A28` | Mediterranean, French country |
| Pewter / zinc | `#8A8D8F` | French country, industrial |

## 6. Textiles

Show as photographed fabric close-ups, ideally draped so you see how it moves.

| Textile | Feel | Points to |
|---|---|---|
| Linen (washed) | relaxed, breathable, creased | warm minimal, coastal, French country, Japandi |
| Cotton canvas | crisp, practical | Scandinavian, farmhouse |
| Wool / knit | warm, soft | Scandinavian, Copenhagen |
| Bouclé | nubby, sculptural | warm minimal, organic, mid-century revival |
| Velvet | rich, plush, light-catching | Art Deco, traditional, maximalist |
| Leather (cognac, worn) | patina, sturdy | mid-century, industrial |
| Sheepskin / shearling | cozy, textural | Scandinavian, organic |
| Jute / sisal / seagrass | coarse, natural | coastal, organic, boho |
| Rattan / cane / wicker | woven, airy | boho, coastal, grandmillennial, Indian, Japandi |
| Silk / dupioni | sheen | traditional, Indian |
| Handloom cotton / khadi | slubby, handmade | Indian, wabi-sabi |
| Performance fabric | practical, cleanable | any; kids and pets |
| Mohair | soft sheen, warm | mid-century, transitional |

## 7. Patterns

Show as square tiles at a realistic scale (a pillow-sized crop). Group by **appetite** first ("none / a little /
lots"), then type.

| Pattern | What it is | Points to |
|---|---|---|
| Solid / tonal texture | No print; interest from weave | minimal, warm minimal, Japandi |
| Pinstripe / ticking stripe | Thin regular stripes | farmhouse, coastal, Scandinavian |
| Wide stripe / awning | Bold stripes | coastal, Mediterranean, grandmillennial |
| Gingham / buffalo check | Woven checks | farmhouse, French country, grandmillennial |
| Plaid / tartan | Crossed stripes | traditional, cabin |
| Small florals / ditsy | Small repeat florals | French country, grandmillennial |
| Chintz / large florals | Glazed large florals | grandmillennial, traditional |
| Toile | Pastoral scenes, one color | French country, grandmillennial |
| Damask | Tone-on-tone ornamental | traditional |
| Chinoiserie | Chinese-inspired scenes, birds, branches | grandmillennial, traditional |
| Geometric / chevron / fan | Hard-edged repeats | Art Deco, mid-century, modern |
| Atomic / starburst | Mid-century motifs | mid-century |
| Kilim / Persian / Oushak | Woven rug motifs | boho, traditional, eclectic |
| Ikat | Blurred resist-dye | boho, Indian, eclectic |
| Hand block print | Repeated hand-stamped motifs (Bagru, Sanganer) | Indian, boho, French country |
| Paisley / Mughal floral | Teardrop and botanical motifs | Indian, traditional |
| Suzani | Large embroidered medallions | boho, eclectic |
| Mud cloth | Hand-painted Malian geometrics | organic, boho |
| Terrazzo | Speckled chips | modern, Mediterranean |
| Abstract / painterly | Brushstroke prints | contemporary, eclectic |
| Scandinavian graphic (e.g. Marimekko-style) | Big flat florals, bold color | Scandinavian, mid-century |

## 8. Other visual this-or-thats (non-color)

Useful pairs for the "I'm not sure" exploration. Each pair splits families cleanly.

| Pair | Splits |
|---|---|
| Light airy room / dark moody room | value preference |
| Clear surfaces / collected shelves | minimal ↔ maximal |
| Straight lines / soft curves | modern, Deco ↔ organic, boho |
| Light wood / dark wood | Scandi, Japandi ↔ mid-century, traditional |
| Brass / black metal | warm-classic ↔ industrial-modern |
| Matching set / mismatched mix | traditional, transitional ↔ eclectic, Copenhagen |
| Low to the floor / tall and upright | Japandi, boho ↔ traditional |
| Linen / velvet | relaxed ↔ formal-luxe |
| Plants everywhere / one sculptural object | organic, boho ↔ minimal |
| Symmetrical / asymmetrical | traditional, Deco ↔ wabi-sabi, eclectic |

---

## Sources

- [Bob Vila: The 60-30-10 rule](https://bobvila.com/articles/60-30-10-rule)
- [MYMOVE: Color rules every interior design fan needs to know](https://www.mymove.com/home-inspiration/trends/these-are-the-color-rules-that-every-interior-design-fan-needs-to-know/)
- [Fernandina Beach News-Leader: Color rules designers swear by (warm vs cool neutrals)](https://www.fbnewsleader.com/regional-columns/color-rules-these-are-basics-interior-designers-swear-choosing-palette)
- [Sotheby's: A design guide to mixing woods](https://sothebys.com/a-design-guide-to-mixing-woods)
- [Studio McGee: How to mix wood tones](https://studio-mcgee.com/how-to-mix-wood-tones-in-your-home/)
- [Sunset: Mixing light and dark wood](https://sunset.com/home-garden/mixing-light-and-dark-wood-together)
- [Livingetc: Scandinavian vs mid-century (wood species and palettes)](https://www.livingetc.com/advice/scandinavian-vs-mid-century-modern)
- [Studio Matrx: Indo-contemporary interiors (block print, ikat, brass, colors)](https://www.studiomatrx.org/guides/indo-contemporary-interiors-india)
- [Studio Matrx: Warm minimal interiors (plaster, limewash, oak)](https://www.studiomatrx.org/guides/warm-minimal-interiors)
- [Rise Art: Art Deco interior design (materials, contrast)](https://www.riseart.com/guide/2430/art-deco-interior-design)
- [Havenly: Grandmillennial style (patterns, wicker)](https://havenly.com/blog/grandmillennial-style)
- [Homedesigns.ai: Japandi vs Scandinavian (palettes, materials)](https://homedesigns.ai/go/japandi-vs-scandinavian-key-differences-and-how-to-choose/)
