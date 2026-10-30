# Space: the principles of planning a room

Last updated: 2026-10-30. Part of `docs/reference/design-principles/` (see `README.md`).

This file builds on `../interior-design/craft-standards.md`, which already covers main walkways, sofa-to-coffee-table
distance, rug coverage, dining clearances, TV distance and zoning. Those numbers are not repeated here except where
this file adds a rule. **Code status** marks where a rule already lives in code (`lib/play/placement.ts`,
`lib/play/layout.ts`) and where it should go.

The numbers are residential rules of thumb from trade and retail sources, and they don't always agree. Where they
disagree, the range is given and the default Homebody should use is in **bold**.

---

## 1. Scale and proportion

*Scale* is how big a piece is relative to the room and the people in it; *proportion* is how its parts and its
neighbours relate to each other. Most rooms that "feel off" without a clear reason fail on scale: a sofa too small
for the wall, a rug floating like a bath mat, or a pendant the size of a grapefruit.

| Rule | Number | Check |
|---|---|---|
| Coffee table length vs sofa | 1/2 to 2/3 of the sofa's length (**2/3**) | `table.w / sofa.w ∈ [0.5, 0.75]` |
| Coffee table height | Within 1–2" of the sofa seat height, never above it | `abs(table.h − sofa.seatH) ≤ 2"` |
| Side table height | Within ~2" of the arm it sits beside; lower is better than higher | `abs(side.h − arm.h) ≤ 2"` |
| Furniture on a wall | A piece against a wall fills about 2/3 to 3/4 of that wall (or of the wall section between openings) | `piece.w / wallRun ∈ [0.5, 0.8]` |
| Art over furniture | 2/3 to 3/4 of the width of the piece below (craft rule; see `README.md` rule 12) | |
| Headboard / bed | Nightstands roughly level with the mattress top (±2"); lamps tall enough that the shade's bottom sits near seated eye level | |
| Pendant / chandelier diameter | 1/2 to 2/3 of the table width (**about 1/2 of the width**; "table width minus 12"" is an alternative that runs large on wide tables) | |
| Pendant over table | Bottom 30–36" above the tabletop with an 8 ft ceiling; +3" per extra foot of ceiling | see `lighting.md` |
| Room fill | Furniture footprints (plan area) take about **1/3 to 1/2** of the floor in living rooms; above ~60% reads crowded (practice heuristic, no standard) | `sum(footprints) / floorArea` |
| Vertical scale | In rooms with a ceiling above 9 ft, add something tall (bookcase, tall art, floor lamp, curtains hung high) so the upper third isn't empty; in rooms with a ceiling at 8 ft or below, prefer low, leggy pieces and hang curtains near the ceiling | |
| Proportional splits | Divide walls, gallery groupings and shelf styling around 2:1 or 3:2 (close to the 1.618 golden ratio), not 1:1, unless the scheme is formally symmetrical | |

**Scale to people as well as rooms.** A 6'4" household needs deeper seats and higher tables; a petite household
needs shallower seats (see `people.md`).

## 2. Focal point

- **One per room** (craft-standards). It's what the eye lands on from the entry: a fireplace, a view window, a
  built-in, a large artwork, a statement bed wall. A TV is a functional focal point; when the TV wall and the
  architectural focal point differ, either combine them (TV beside or above the fireplace, with a gallery wall
  around the TV) or let seating frame both.
- **The main seat faces or frames it.** Seating within about ±45° of facing the focal point counts as framing.
  `placement.ts` already does this (TV → fireplace → widest window).
- **Create one if the room has none:** a large artwork (or a gallery grouping at 2/3 of the wall), a statement rug,
  a bold headboard, an accent wall, or a single sculptural piece.
- **Don't fight it:** don't put a second strong element on the wall opposite the focal point, and don't block it with
  tall pieces between it and the seating.

## 3. Balance

**Visual weight** (see §14) must feel even across the room. Split the room along its focal axis; neither side should
carry clearly more weight.

- **Symmetrical (formal):** mirror-image pairs either side of a central axis: two sofas facing, matching lamps, twin
  nightstands. It feels calm, traditional and formal. It's the default for bedrooms (bed centred, a pair either side)
  and for traditional, transitional and art deco schemes.
- **Asymmetrical (informal):** different objects with equal weight: a sofa on one side balanced by two chairs and a
  floor lamp on the other; a big plant balancing a bookcase. It feels relaxed and modern. It suits mid-century,
  Japandi, eclectic, boho and open-plan rooms.
- **Radial:** arranged around a centre: a round table with chairs, or seating around a coffee table or round rug.
  It works for dining and conversation pits.
- **Checkable:** compute weight per object (§14), sum each half along the focal axis, and flag if one side exceeds
  ~60% of the total. Run the same check vertically: a room with everything below 36" looks bottom-heavy; aim for
  something in the 36–72" band and something above 72" (art, a tall lamp, a plant, curtains).

## 4. Rhythm and repetition

Rhythm moves the eye around the room through repeated elements: color, shape, material, line.

- **Repetition:** the same element repeated (an accent color three times, matching chairs, a recurring brass).
  The working rule is **repeat each accent color and each secondary material at least three times, in different
  places and at different heights.** See `coherence.md`.
- **Progression (gradation):** a sequence that changes in size or tone: nesting tables, a stack of books, a
  light-to-dark ombré of cushions.
- **Transition:** a curve that carries the eye: an arched doorway, a curved sofa, a round rug under square furniture.
- **Contrast/alternation:** a deliberate break: one round table in a room of rectangles, black against white.
- **Repeat shapes too:** if the coffee table is round, echo the curve twice (a round mirror, a globe pendant, an arched
  chair back). Make one shape language dominant (curvy or rectilinear) and let the other appear in 1 or 2 places only.

## 5. Emphasis

Emphasis is the *hierarchy* under the focal point: what's seen first, second and third.

- **One hero, two or three supporting stars, everything else quiet.** The hero is the focal point or the
  "splurge" piece; supporting stars are a statement light, a rug and a chair.
- Tools for emphasis: contrast (value, color, texture), scale (the biggest), isolation (negative space around it),
  light (an accent light on it), and position (the end of a sightline).
- **Don't let two pieces compete:** a patterned rug *and* a patterned sofa *and* a gallery wall means nothing leads.
  If the rug is bold, keep the sofa plain, and so on.

## 6. Harmony and unity

Unity is the sense that everything belongs to one idea; harmony is how well the parts get along. A unified room has:

- **One dominant style family** (60–80% of pieces), with at most one or two counterpoints. Taste Builder produces
  a blend (e.g. "60% warm minimal, 30% mid-century, a thread of Indian textiles"); hold pieces to that ratio.
- **A shared thread** running through different pieces: undertone, wood family, a line quality (thin legs everywhere),
  or a repeated color.
- **Variety inside unity**: identical everything is a showroom; designers repeat *attributes* (color, material,
  shape), not *objects*. Avoid buying a matching set (sofa + loveseat + chair in one fabric) unless the brief asks for it.

## 7. Circulation and clearances

Craft-standards covers main walkways (36"), secondary paths (30"), coffee table gap (14–18") and dining (36"/44").
Additional numbers:

| Situation | Clearance |
|---|---|
| Between furniture where nobody walks (e.g. chair beside sofa) | 4–12" (enough to read as separate) |
| Bed: sides and foot | **≥ 24"**, ideally 30–36" on any side used to get in or to make the bed; 36" at the foot if it's a path |
| In front of a dresser or chest | ≥ 36" (drawers open ~18–20" plus a person) |
| In front of a desk chair | 36" from the desk edge to the nearest obstacle behind |
| Kitchen work aisle | 42" for one cook, 48" for two |
| Door swing | Nothing within the swing arc; keep a 36" × 36" (or door-width) landing at each door |
| Windows | Leave operable windows reachable (a gap of at least about 18–24" in front, or furniture lower than the sill) |
| Wheelchair users | 36" continuous routes, 60" turning circle (67" in ICC A117.1-2017 new builds) near the bed, desk and seating (see `people.md`) |
| Traffic through a conversation area | Route walkways *around* a seating group, not through it, so no one passes between people and the TV or between the sofa and coffee table |

**Code status:** `placement.ts` has WALK = 0.91 m and SQUEEZE = 0.76 m, and checks doorway blocking. Add bed sides,
drawer fronts, window access and the rule against cutting through a seating group.

## 8. Conversation areas

- **Seat-to-seat distance:** people sitting in one group should be within **about 8 ft** (4–10 ft) of each other,
  face to face; beyond that, people raise their voices and can't read faces.
- **Shapes that work:** U (sofa + two chairs facing the focal point), L (sofa + chair or sectional), facing sofas
  (formal, symmetrical), a sofa + two chairs facing across a coffee table, and a "conversation pit" of four
  chairs around a round table.
- **Angle chairs in** about 10–30° toward the centre of the group.
- **Every seat needs a landing surface** (a coffee table, side table, or stool) within arm's reach, about 18–24" from
  the seat.
- **Every seat needs light:** a reading lamp within reach of at least the main reading seat (see `lighting.md`).
- **Large rooms** (over about 16 ft on the long side): make two groups (a main one by the focal point, a
  secondary reading nook or game table), each anchored by its own rug or light. Don't push everything against the walls.
- **Floating furniture off the wall** (pulling the sofa forward with a console behind it) is better in any room wider
  than about 12 ft. It shortens conversation distances and creates a walkway behind.
- **Rug for a group:** 8×10 ft for a sofa plus two chairs, 9×12 ft for larger groups. All front legs go on it.

## 9. Sightlines

- **From the entry:** the first view should land on the focal point or something beautiful, not the back of a
  sofa, a TV's cables or a laundry pile. If the sofa back must face the entry, put a console table with lamps behind it.
- **Through the room:** keep long axes clear (door → window, room → room in an open plan). Tall pieces (bookcases,
  armoires) go on walls parallel to the line of sight, not across it.
- **Seated eye level is about 42" from the floor;** standing is about 60–64". Things that matter seated (a TV's
  centre, a view out the window) should be visible at 42"; art is hung for standing eye level (57–60" centre).
- **TV viewing angle:** keep the main seat within about 30° of the screen's centre line horizontally, and avoid
  tilting the head up more than about 15° (so mounting high over a fireplace is a compromise).
- **The bed:** ideally sees the door without being in line with it ("commanding position", shared by feng shui and
  common practice); avoid the headboard under a window when possible.
- **Desks:** facing into the room or perpendicular to a window, not with the back to a door, and not facing the
  window directly when glare on a screen matters.

## 10. Zoning

Craft-standards says a rug, a lamp or a shelf marks each zone. In more detail:

- **Each activity gets a zone:** conversing, TV, reading, dining, working, playing, entry drop.
- **Anchor each zone** with at least one of these: a rug, a light above it (a pendant or a lamp), a change of
  furniture direction, or a low divider (sofa back, console, open shelving, a plant).
- **Sequence zones** by how public or private they are and how noisy: entry → dining/kitchen → living → reading
  nook/work. Keep the work zone out of the TV's sightline where possible.
- **Studios:** separate the bed from the living zone with something see-through (open shelving, a curtain, a
  half-height console). Give the bed its own rug and lamp.
- **Kids and pets:** a play zone visible from the kitchen and seating; pet beds out of walkways.

## 11. Layering

Layering builds depth: foreground → middle ground → background, and floor → furniture → walls → ceiling.

- **Rugs:** a large neutral, flat-weave or jute base with a smaller patterned or vintage rug on top. The top rug is
  roughly 2/3 the size of the base. Under a dining table, the rug extends **≥ 24"** past the table edge on all sides,
  so chairs stay on it when pulled out. Under a queen bed it's 8×10 ft; under a king, 9×12 ft. Show at least 18–24" of
  rug on each side of the bed.
- **Lighting:** three layers (ambient, task, accent), plus decorative fixtures; at least three light sources at
  different heights in every room (see `lighting.md`).
- **Textiles:** at least three textures on a sofa or bed (e.g. linen + wool knit + velvet); cushions in 2–3 sizes;
  a throw; curtains.
- **Walls:** paint or texture → art or mirror → shelving with objects → sconces.
- **Window layers:** blind or shade (privacy, light control) + curtains (softness, height). Hang the rod 4–6" above the
  frame or halfway to the ceiling, extended 8–12" beyond the frame each side; curtain length to just kiss the floor
  (break of 0–1").
- **Depth in vignettes:** stack back to front: tall (art or a lamp) at the back, medium (a vase or stacked books)
  in the middle, small (a bowl or an object) in front.

## 12. The rule of three and odd numbers

- **Group accessories in odd numbers (3, 5)**; even pairs read as formal and static, odd groups as natural. Pairs
  remain right for symmetry (lamps either side of a bed, sconces either side of a mirror).
- **Vary height, shape and texture inside a group,** but share one attribute (color, material or theme) so it reads
  as a family. Arrange as a **triangle**: the tallest at the back or side, stepping down.
- **Height spread:** the tallest item is about 1.5–2× the shortest.
- **Repeat an accent color three times** in the room (see `coherence.md`).
- **Patterns: up to three in a room,** in different scales (one large, one medium, one small) and sharing at least one
  color.

## 13. Negative space

Empty space is a design element: it lets the hero breathe and the eye rest.

- **Surfaces:** fill at most about 2/3 of a shelf, console or coffee table; leave about a third empty. On open shelving,
  mix books, objects and empty space; leave roughly 1 in 3 shelf bays lighter.
- **Walls:** not every wall needs art. Leave at least one wall quiet per room, so the focal wall reads.
- **Floor:** keep the centre of a living room clear except for the coffee table or rug; don't fill corners by reflex.
- **Minimal and Japandi blends** want more negative space (fill surfaces under half); maximalist and eclectic blends want
  less, but even maximalist rooms need resting points (a plain rug under a gallery wall, or a solid sofa).

## 14. Visual weight

How heavy a thing *looks*, separate from what it weighs. Heavier-looking:

| Factor | Heavier | Lighter |
|---|---|---|
| Size | Large | Small |
| Value | Dark | Light |
| Saturation | Saturated | Muted or neutral |
| Texture | Coarse, patterned | Smooth, plain |
| Base | Skirted, sits on the floor, solid sides | Leggy, raised, open frame |
| Material | Solid wood, stone, upholstery | Glass, acrylic, cane, wire, thin metal |
| Shape | Blocky, rectilinear | Curved, open, airy |
| Placement | Higher in the field of view, isolated | Low, grouped |

- **Use it to balance** (§3) and to size a room: in small rooms choose leggy, light-value, open pieces; in large rooms
  heavier pieces keep it from feeling empty.
- **Balance heavy with heavy:** a dark bookcase on one wall is balanced by a dark sofa or a big artwork, not by a single
  small lamp.
- **Approximate weight for code:** `weight ≈ footprintArea × heightFactor × (1 + darkness + saturation + texture) ×
  (solidBase ? 1.3 : 1)`, where darkness = 1 − L*/100 from the item's colour. This is a heuristic for flagging, not
  a law; tune it against designer-made layouts.

## 15. Room-specific numbers worth knowing

- **Living:** sofa to TV 1.5–2.5× the screen diagonal (craft-standards). Leave about 18" from sofa to coffee table
  at most for reach.
- **Dining:** 24" of table edge per person (30" is generous); round tables: 36–44" diameter seats 4, 48–54" seats
  4–6, 60" seats 6–8. Chair seat 10–12" below the tabletop.
- **Bedroom:** queen 60×80"; king 76×80"; full 54×75"; twin 38×75". Nightstand top within 2" of the mattress
  top. Leave 24–36" each side.
- **Entry:** a console 10–16" deep, a landing surface within 2 steps of the door, a mirror, hooks or a bench.
- **Office:** desk 28–30" high, at least 48" wide for a laptop and paper; monitor at arm's length, with the top of
  the screen at or slightly below eye level.

---

## Sources

- [Ballard Designs: How to space furniture in your room](https://www.ballarddesigns.com/howtodecorate/?p=58496)
- [Raymour & Flanigan: Create conversation areas](https://www.raymourflanigan.com/blog/expertise/how-to/create-conversation-areas)
- [House Digest: Symmetrical layout ratio for conversation](https://www.housedigest.com/1998638/symmetrical-living-room-layout-ratio-invites-more-conversations)
- [Mental Floss: Seating tricks (8 ft rule)](https://www.mentalfloss.com/article/537641/tricks-to-make-your-living-room-amazing)
- [Havenly: Rhythm and repetition](https://havenly.com/blog/rhythm-and-repetition)
- [Worthing Court: Principles of design, rhythm](https://www.worthingcourtblog.com/principle-of-design-rhythm/)
- [Livingetc: Light height over a dining table](https://www.livingetc.com/advice/light-height-over-dining-table)
- [Ballard Designs: Chandelier buying guide](https://ballarddesigns.com/trends-features/features/guide/chandelier-buying-guide)
- [Apartment Therapy: The 57" rule](https://www.apartmenttherapy.com/how-to-hang-artwork-properly-57-inches-above-the-floor-6174)
- [Livingetc: How high to hang art above furniture](https://www.livingetc.com/advice/how-high-to-hang-art-above-furniture)
- [US Access Board: ADA/IBC comparison, ch. 3 and 4](https://www.access-board.gov/ada/ada-ibc-comparison/chapter-3/)
- [Coohom: Space-planning rules for small living rooms](https://www.coohom.com/article/interior-design-space-planning-rules-for-small-living-rooms)

Several numbers here (bed and drawer clearances, round-table seating, curtain hanging, visual-weight factors,
fill ratios) are standard teaching material in interior-design courses and widely repeated by retailers, and they
were not each traced to a single primary source. Treat them as defaults to tune, and check any that drive a purchase.
