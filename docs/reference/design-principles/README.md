# Design principles reference

Last updated: 2026-10-30.

The *taste* layer behind Homebody's design model: the foundational principles that make a room work, how they
interact across objects, and how they bend around the person. It exists so the model does more than "chair goes
here, sofa goes here". It builds on `../interior-design/` (the intake research, style families, palettes and
`craft-standards.md`), and doesn't repeat it.

## Index

| File | What's in it |
|---|---|
| [color.md](color.md) | Wada Sanzō's 348 combinations (data downloaded) and how to use them, 60-30-10 variants, LRV, the area effect, light direction and lamp temperature, undertones by Lab, harmony types, open palette sources and their licenses |
| [space.md](space.md) | Scale and proportion, focal point, balance, rhythm, emphasis, harmony, circulation, conversation areas, sightlines, zoning, layering, the rule of three, negative space, visual weight, with numbers |
| [materials-fabrics.md](materials-fabrics.md) | Wyzenbeek and Martindale, fabric-by-life table (kids, pets, sun), cleaning codes, wood species with Janka hardness and undertones, finishes, metals, stone, texture and warm/cool pairing |
| [lighting.md](lighting.md) | Layers as checkable rules, lumens per room, CCT, CRI and R9, fixture placement heights and spacing, daylight |
| [people.md](people.md) | Ergonomic heights and depths, accessibility (ADA numbers), lifestyle → decisions table, cultural practice (Vastu, feng shui, color meanings), how designers turn a brief into choices, budget allocation |
| [coherence.md](coherence.md) | How one change ripples through a room: the `DesignState` model, ripple rules by change type, what never ripples, ranking the smallest good ripple, the **ripple vs. keep** toggle |
| [storage-plan.md](storage-plan.md) | Where this knowledge should live (prompt, keyed JSON, code), sizes, whether a vector store is needed (no), and the recommended option |
| [data/](data/) | `wada-sanzo-colors.json` (MIT) with its license and provenance notes |

Real products (images, prices, dimensions, links) are in `../sourcing/README.md`.

## The 15 rules the placement and styling model must always apply

Each is written so code or a reviewer can check it: a pass/fail test, with the default number. "Room" means the
room being designed; "group" means a seating group. Where a rule is broken on purpose, the model must name the rule
and the reason (`coherence.md` §6), and only the hero piece or the personal nod may break a color or repetition rule.

1. **Clear paths.** Main walkways ≥ 36" (91 cm), secondary ≥ 30" (76 cm); no furniture in a door's swing or a
   36" landing at each door; operable windows reachable; walkways go around seating groups, not through them.
   With a wheelchair or walker user: 36" everywhere and a 60" turning circle beside the bed, seating and desk.
2. **One focal point, faced.** The room has exactly one primary focal point; the main seat faces it or frames it
   within ±45°, and nothing tall stands between them.
3. **Conversation distance.** Seats in one group are ≤ 8 ft (max 10 ft) apart, face to face; every seat has a
   landing surface within about 18–24" and the main reading seat has a lamp within reach.
4. **Coffee and side tables to scale.** Coffee table length = 1/2–2/3 of the sofa's (2/3 default), 14–18" from the
   seat edge, height within 2" of the seat. Side tables within 2" of the arm height; nightstands within 2" of the
   mattress top.
5. **Rugs big enough.** In a living group, at least the front legs of every seat are on the rug, with 12–18" of floor
   at the walls; under a dining table it extends ≥ 24" beyond the edge on all sides; under a bed it shows ≥ 18–24" on
   each side.
6. **Clearances around use.** 14–18" sofa to coffee table; 36" behind dining chairs (44" where people pass); ≥ 24–36"
   beside beds; ≥ 36" in front of dressers and desks; 42–48" kitchen aisles.
7. **Color roles.** Visible area splits about 60-30-10 (±10, or the blend's variant: 70-20-10 for minimal, looser
   for eclectic); a light, a mid and a dark value are all present; large-area colors are less saturated than accents;
   at most 3 non-neutral hue families (unless eclectic or maximalist).
8. **Accent repetition.** Every accent color (and every secondary material) appears in ≥ 3 places, across ≥ 2 zones
   and ≥ 2 heights, preferably as echoes within patterns or objects, not identical solids.
9. **One undertone story.** All neutrals, woods and stones in a view share a warm or cool undertone family, or the
   contrast is deliberate and repeated ≥ 2×; the room is about 70/30 warm/cool or the reverse.
10. **Material discipline.** ≤ 3 wood tones with one dominant; ≤ 2 metals plus black, with one dominant; every
    material appears ≥ 2×; ≥ 3 textures and both a matte and a glossy surface per room; ≤ 3 patterns, at
    different scales, sharing a color.
11. **Light in layers.** ≥ 3 light sources at ≥ 2 heights (ambient, task, accent); lumens ≥ floor ft² × the room's
    footcandle target; all sources 2700–3000K in one room, CRI ≥ 90, R9 ≥ 50; dining pendants 30–36" above the table,
    at 1/2–2/3 of its width.
12. **Things on walls at the right height.** Art centred 57–60" from the floor on open walls; above furniture, the
    bottom 6–10" above it and 2/3–3/4 of its width; sconces 60–66"; curtains hung 4–6" above the frame (or near the
    ceiling) and 8–12" past each side.
13. **Balance and weight.** Splitting the room along its focal axis, neither half carries more than about 60% of the
    visual weight (size × darkness × saturation × solidity); each wall band (floor to 36", 36–72", above 72") has
    something in it; small rooms favour leggy, light, open pieces.
14. **Fit the person.** Seat, table and bed heights suit the household (dining seat 10–12" below the table;
    sofa depth and height by body and age); fabrics meet the use (≥ 15k double rubs, ≥ 25–30k with kids or pets; no
    loop pile with claws; fade-resistant in sun); hard constraints (accessibility, cultural practice they follow,
    rental limits, budget) are filters, not preferences.
15. **Respect what's kept, and justify every choice.** Never move or replace a "Keep here" item; "Keep, move it" items
    may move but not be replaced; ripples never touch locks and stay inside budget. Every item and every change has
    a stated reason tied to function, the person, their taste, or one of these rules; a personal detail appears
    once, as a quiet nod, never as a theme.

Groupings of accessories in odd numbers (3 or 5) with varied heights, the zoning rules and negative space are in
`space.md`; they're styling defaults rather than must-pass rules.

## How the files feed the model

- The 15 rules go **verbatim into the cached system prompt** and are **implemented as code validators**
  (`storage-plan.md`).
- Tables (fabrics by life, lighting by room, ergonomics, woods) become **keyed JSON** that code injects only when
  relevant.
- Wada's combinations are **looked up by code** (ΔE match to an anchor color) and passed to the model as candidates.
- `coherence.md` defines the **ripple engine**: code detects violated rules after an edit; the model picks the
  beautiful fix and writes the reason; code re-checks.

## Source quality note

The numbers are residential rules of thumb from trade press, retailers, lighting makers, ADA and ICC standards
(as summarised by the US Access Board and code-prep sources), and textile test standards. Sources often disagree
by a few inches; the defaults chosen are the most commonly cited. IES lighting levels come from secondary summaries
(the handbook is paywalled). Each file lists its sources and flags numbers that are common practice rather than
traced to one source. Validate against real rooms and designer review before a number drives a purchase.
