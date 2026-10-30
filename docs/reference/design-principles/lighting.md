# Lighting

Last updated: 2026-10-30. Part of `docs/reference/design-principles/` (see `README.md`).

Craft-standards already covers the three layers, 2700K/3000K/4000K and window orientation. This file adds the
amounts (lumens), quality (CRI), and where fixtures go.

---

## 1. Layers, made checkable

| Layer | Job | Typical sources |
|---|---|---|
| **Ambient** | Even base light to move around by | Ceiling fixtures, recessed downlights, cove, or several lamps together |
| **Task** | Bright light where eyes work | Reading lamps, desk lamps, under-cabinet strips, vanity sconces, island pendants |
| **Accent** | Draws attention, adds depth | Picture lights, shelf lighting, uplights on plants, wall washers |
| **Decorative** | The fixture is itself an object | Statement pendant, sculptural lamp; often doubles as ambient |

- **At least three light sources per room, at different heights** (ceiling, about eye level, low). A single
  overhead light is the most common lighting failure in homes.
- **Living rooms:** lamps in at least 3 of the 4 quadrants, so no corner is a black hole.
- **Every seat used for reading gets a task light within reach.** Every work surface (desk, counter, vanity) gets
  task light that doesn't cast the user's shadow onto it (light from the front or side, not behind).
- **Dimmers on ambient and decorative layers;** separate switching per layer.

## 2. How much light

A footcandle (fc) is 1 lumen per square foot. **Target lumens ≈ floor area (ft²) × target fc.** That ignores fixture
efficiency and dark finishes, so add about 20–30% in rooms with dark walls or high ceilings.

| Room | Ambient fc | Task fc | Lumens for a 12×14 ft (168 ft²) room |
|---|---|---|---|
| Living room | 10–20 | 30–50 at reading seats | ~1,700–3,400 |
| Bedroom | 10–20 | 30–50 reading | ~1,700–3,400 |
| Dining | 20–30 (at the table) | – | ~3,400–5,000 |
| Kitchen | 30–50 | 50–100 on counters | ~5,000–8,400 |
| Bathroom | 20–30 | 50–80 at the mirror | ~(small room) 1,000–2,500 |
| Home office | 30–50 | 50+ on the desk | ~5,000–8,400 |
| Hallway, entry | 5–10 | – | per area |

- **Older eyes need more:** people over about 60 need roughly 2× the light of a 20-year-old for the same task, plus
  less glare (see `people.md`).
- **Lamp equivalents:** a "60 W equivalent" LED ≈ 800 lm; "75 W" ≈ 1,100 lm; "100 W" ≈ 1,600 lm. A typical table
  lamp is 450–800 lm; a reading floor lamp 800–1,600 lm.

## 3. Color temperature (CCT)

- 2700K for living and bedrooms, 2700–3000K for kitchens and baths, 3000K for task (craft-standards). Add:
  - **Warm-dim** (LEDs that drop to about 1800–2200K as they dim) give an evening, candle-like feel in living,
    dining and bedrooms.
  - **One CCT per view:** mixing 2700K and 4000K in one room reads as a mistake; keep sources within about 300K of
    each other.
  - **Match the scheme:** warm palettes and woods want 2700K; cool, minimal schemes can take 3000K. 3500K and above
    rarely suit homes outside garages, laundry and closets.
  - Color choices should be judged under the room's real CCT (`color.md` §3).

## 4. Color rendering (CRI)

- **CRI ≥ 90 for all home lighting,** and check **R9 (saturated red) ≥ 50**; R9 ≥ 80 for dining, art, and wherever
  skin tones matter (vanities). California Title 24 requires 90+ CRI for residential sources (reported in the sources;
  not verified in the code text).
- Some "CRI 90+" products have R9 below 30. Read the datasheet.
- Newer metric: TM-30 (Rf for fidelity, Rg for saturation). Rf ≥ 90 is excellent.

## 5. Fixture placement

| Fixture | Placement rule |
|---|---|
| **Pendant or chandelier over a dining table** | Bottom 30–36" above the tabletop (8 ft ceiling), +3" per extra foot of ceiling; diameter about 1/2 to 2/3 of the table width; for a long table, two or three pendants or a linear fixture covering about 2/3 of its length; at least 6" in from each table end |
| **Pendants over an island** | 30–36" above the counter; spaced 24–30" apart, centred on the island; 2 for islands under ~7 ft, 3 for longer |
| **Entry chandelier** | At least 7 ft clear below it; in a two-storey foyer, the bottom at about second-floor level or no lower than the first-floor ceiling height |
| **Ceiling fixture (general)** | At least 7 ft clearance in walkways; a flush mount below 8 ft ceilings, a semi-flush mount from 8 to 9 ft |
| **Recessed downlights** | Spacing ≈ ceiling height ÷ 2 (8 ft ceiling → about 4 ft apart); 18–36" from walls (closer washes the wall); avoid a grid that lights only the floor |
| **Wall sconces** | Centre about 60–66" from the floor in hallways and living rooms; either side of a mirror at about face height (~60–65"), 28–36" apart; over a bed, about 48–60" from the floor or about 24–30" above the mattress |
| **Bedside lamps** | Bottom of the shade about level with seated eye level in bed (roughly 20–24" above the mattress top); total height about 24–30" on a nightstand matched to the mattress height |
| **Reading floor lamp** | Behind or beside the reader's shoulder, on the side away from the dominant hand's page turn; shade bottom about at shoulder height when seated (~40–42" from the floor) |
| **Table lamp on a side table** | Bottom of the shade about at seated eye level (~38–42" from the floor), so the bulb isn't visible from the seat |
| **Desk lamp** | On the side opposite the writing hand (left for right-handed people); shade below eye level |
| **Picture lights / spot** | Aimed about 30° from vertical to avoid glare off glass, and to cover the artwork |
| **Under-cabinet** | Toward the front of the cabinet underside, so it lights the counter and not the backsplash only |
| **Bathroom vanity** | Light at face height from both sides (sconces) or a bar above the mirror at about 75–80"; avoid only overhead downlights (shadows under the eyes) |

## 6. Daylight

- **Daylight is a layer too.** Note window direction (craft-standards) and treat it as the morning or afternoon
  ambient layer. Glare control: sheers, solar shades, or blinds that tilt light upward.
- **Don't put screens perpendicular to a bright window at the user's back** (reflection) or directly facing it
  (glare). Desks perpendicular to the window are best.
- **Plants** go in the light they need (a south or west window for high light, north for low), not where they fill a
  corner; recommend grow lights otherwise.

## 7. Checkable lighting rules

1. ≥ 3 light sources at ≥ 2 different heights per room; living rooms cover 3 of 4 quadrants.
2. Total lumens ≥ floor area × the room's ambient fc (and +20–30% for dark finishes).
3. Every reading seat has a task lamp within about 24"; every desk and counter has task light.
4. All sources in a room within 2700–3000K (3000K max in living areas), CRI ≥ 90, R9 ≥ 50.
5. Dining pendant height 30–36" above the table (+3"/ft above 8 ft), diameter 1/2–2/3 of the table width.
6. Sconce centres at 60–66"; picture lights at about 30°; recessed spacing ≈ ceiling height ÷ 2.
7. Dimmers on ambient, and separate switching per layer.

## Sources

- [Penn State EGEE 102: How much lighting is needed](https://courses.ems.psu.edu/egee102/node/2363)
- [Super Bright LEDs: Residential recommended lighting levels](https://www.superbrightleds.com/blog/residential-recommended-lighting-levels.html)
- [LEDVANCE: Lighting requirements in residential settings](https://www.ledvance.it/en-us/professional-lighting/insights/blog/sustainability/lighting-requirements-in-residential-and-commercial-settings)
- [1000Bulbs: How many footcandles](https://lighting-blog.squarespace.com/home/how-many-footcandles-do-i-need)
- [Victoria Health: Light levels (dementia-friendly environments)](https://health.vic.gov.au/dementia-friendly-environments/light-levels)
- [Waveform Lighting: 80 vs 90 vs 95 CRI](https://www.waveformlighting.com/home-residential/does-color-rendering-matter-80-cri-vs-90-cri-vs-95-cri)
- [1000Bulbs: What is high CRI](https://blog.1000bulbs.com/home/what-is-high-cri)
- [Medium: R9, more important than CRI?](https://medium.com/@yeutterg/r9-more-important-than-cri-468f0efc0d58)
- [Livingetc: Light height over a dining table](https://www.livingetc.com/advice/light-height-over-dining-table)
- [Williams-Sonoma: Dining room lighting guide](https://www.williams-sonoma.com/pages/ws-home/design-inspiration/advice/design-by-room/dining-room/dining-room-lighting-guide/)
- [Golden Lighting: Pendant lights over a dining table](https://goldenlighting.com/blogs/the-golden-edit/pendant-lights-over-dining-room-table-a-guide)

The footcandle targets come from secondary summaries of IES guidance (the IES Lighting Handbook itself is paywalled).
The sconce, lamp and recessed spacing numbers are standard lighting-retailer and designer practice. Treat them as
defaults.
