# Coherence: how one choice ripples through a room

Last updated: 2026-10-30. Part of `docs/reference/design-principles/` (see `README.md`).

Maeve wants the design model to think like a designer: change one thing and the room responds, the way a designer
who swaps a chair to cobalt would then reach for a cobalt-flecked cushion across the room and a blue-glazed vase on
the shelf, and quietly retire the rust throw that no longer fits. This file defines how that works, and the
**"ripple vs. keep" toggle**:

- **Keep:** change only what the person touched. Homebody checks the change against the room and *says* what
  it conflicts with, but doesn't touch anything else.
- **Ripple:** change what they touched, then propose the smallest set of follow-on changes that keeps the room
  coherent, shown as a preview the person accepts or rejects as a whole, or piece by piece.

---

## 1. The room as a set of relationships

Coherence is about *relationships*, not objects. Represent the room's design as roles that objects fill, so a change
to one object can be traced to what depends on it.

```ts
interface DesignState {
  palette: {                       // color roles (color.md §2)
    dominant: Swatch[];            // the 60: walls, floor, the largest upholstery
    secondary: Swatch[];           // the 30
    accents: { swatch: Swatch; carriers: ItemId[] }[];  // the 10, with every item that carries it
    undertone: "warm" | "cool" | "neutral";
  };
  materials: {
    woods: { name: string; tone: "light" | "mid" | "dark"; undertone: string; carriers: ItemId[]; dominant: boolean }[];
    metals: { name: string; temp: "warm" | "cool" | "neutral"; carriers: ItemId[]; dominant: boolean }[];
    textures: { name: string; scale: "fine" | "medium" | "coarse"; sheen: "matte" | "satin" | "gloss"; carriers: ItemId[] }[];
  };
  shapes: { dominant: "curved" | "rectilinear"; echoes: ItemId[] };
  patterns: { item: ItemId; scale: "large" | "medium" | "small"; colors: Swatch[] }[];  // ≤ 3
  style: { blend: Record<StyleFamily, number> };  // from Taste Builder
  hero: ItemId;                     // the emphasis piece (space.md §5)
  locks: Record<ItemId, "keep_here" | "keep_move" | "free">;   // Space Capture's green/yellow, plus user pins
  budget: { total: number; spent: number };
}
```

Every item has **attributes** (color swatches with their area, material, texture, sheen, shape, pattern, style family,
visual weight, price) and **carries** roles. Rules from the other files become checks on this state: accent
repeated ≥ 3×, ≤ 3 wood tones, ≤ 2 metals, undertone consistent, patterns ≤ 3 at different scales, style mix
near the blend, and so on.

## 2. What changes when one thing changes

The trigger is any edit: a new color, a swapped product, a resize, a removal or an addition. **Classify the change
by which roles it touches**, then apply the matching ripple rules.

### A. A color change on one item ("make the armchair cobalt")

1. **Decide the color's role from its area.** A small item (a cushion, a vase) → accent. A chair or ottoman →
   accent at the large end, or the start of a secondary. A sofa, rug, or wall → secondary or dominant.
2. **If it becomes an accent (the usual case):**
   - **Repeat it.** It needs **≥ 3 carriers in total, in ≥ 2 zones, at ≥ 2 heights**, so propose 2 more. Prefer
     echoes that carry the color *within a mix* (a cushion in a pattern with cobalt in it, art with cobalt, a
     blue-glazed ceramic, a stripe in a throw) over solid matches. Echoes read curated; identical solids read like a set.
   - **Distribute in a triangle:** the new item + one echo across the room at a different height + one at eye
     level (a shelf or art).
   - **Resolve the old accent.** If the room had an accent (say rust), check whether it harmonizes with the new
     one. Use the Wada dictionary (`color.md` §1): is there a combination with colors within ΔE ≤ 10 of both? Or is
     the pair a recognised harmony (cobalt + rust is complementary)? If **yes**, keep both, with the old one as a
     secondary accent. Two accents need a shared neutral base and each repeated. If **no**, propose retiring the old
     accent's small carriers (swap a rust cushion to a cobalt-patterned one) and keep its large carriers (don't
     reupholster the sofa).
   - **Cap the accent count:** if the room now has more than 2 accent hues (3 for eclectic or maximalist blends),
     propose retiring the weakest (the fewest carriers, or the cheapest to swap).
3. **Check temperature and metals.** Cobalt is cool: in a warm room it's a deliberate contrast (fine, and repeating
   it makes it intentional). Brass with cobalt is a classic pairing, so keep it; chrome would cool the whole room
   further, so leave it.
4. **Check the neutrals.** A saturated cool accent next to yellow-cream walls can look sour. Flag it only if the
   wall's undertone fights it (a strong yellow b* > 15); suggest a greige or white with a slight cool or neutral
   lean only if the person is open to paint.
5. **Don't change:** the floor, walls (unless asked), the hero piece, anything locked, or any large item to match a
   small one.

### B. A material change ("swap the coffee table to marble")
- Is the material new to the room? Then it needs **a second carrier** (a marble tray on the console, a marble-based
  lamp, a stone object) or it looks orphaned.
- Did it remove the last carrier of a material? Then the material's other appearances may now be orphans; flag them.
- **Wood:** if this makes a 4th wood tone, propose matching it to an existing tone, or retire the minor one. If it's
  almost the same as an existing wood but not quite, flag it ("too close to match, too far to contrast").
- **Metal:** a 3rd metal (besides black) → propose aligning small metal items (lamp bases, frames, hardware) to the
  dominant one.
- **Temperature:** a cool material (marble, chrome) added to a warm room (or vice versa) should be repeated 2–3
  times as a counterpoint, or chosen in a warm version (warm-veined marble, travertine).
- **Texture:** if the room now lacks one of matte, satin or gloss, or one of fine, medium or coarse, suggest a textile
  or object to restore it.

### C. A size or shape change ("a bigger sofa")
- **Re-run space rules** (`space.md`): coffee table ≈ 2/3 the sofa's length; rug big enough for the front legs
  (it may need the next rug size up); clearances of 36"; conversation distance; balance across the focal axis; art
  over the sofa at 2/3–3/4 of its width.
- **Shape language:** a curved sofa in a rectilinear room needs 1–2 curved echoes (a round side table, a round
  mirror) or should be the single deliberate exception (the hero).
- **Visual weight:** a heavier sofa may need a counterweight on the other side (a larger chair, darker art, a tall
  plant).

### D. A style change ("this chair, but mid-century")
- Recompute the room's style mix. If one piece pushes it more than 10 points away from the person's blend, flag it.
- Mid-century tends to pull in walnut, tapered legs and brass. Propose a second mid-century echo (a lamp, or legs on a
  side table), so the piece belongs; otherwise it reads as a stray.

### E. A pattern change ("a patterned rug")
- **≤ 3 patterns** in the room, at **different scales** (one large, one medium, one small), sharing ≥ 1 color.
- A new large-scale pattern means the other large pattern becomes medium or solid (e.g. swap a large-print cushion
  to a small stripe).
- The pattern's colors join the palette, so its accent color gets repeat checks (A).
- A bold rug means a calmer sofa and fewer patterns at eye level (emphasis, `space.md` §5).

### F. Removals
- If the removed item was **an accent carrier**, the accent may now have < 3 carriers; propose a replacement echo.
- If it was the **only light in a quadrant** or a **reading light**, flag it (`lighting.md`).
- If it was **the hero**, ask what the new hero is, or promote the next strongest piece.
- If it opened space, check balance and whether the zone still has an anchor.

### G. Kept items arriving (Space Capture's green and yellow)
Kept items are fixed inputs. Their colors and materials **seed** the state: a kept walnut console makes walnut a
wood the room must repeat; a kept red sofa sets an accent or secondary role the scheme must honour. Ripple never
proposes changing them; it builds around them.

## 3. What should *not* ripple

- **Locked items** (green "Keep here", user pins): never changed, never moved. Yellow "Keep, move it" items can move
  but not be replaced.
- **Architecture:** floor, built-ins, fireplace, windows. Walls only if the person said paint is on the table.
- **Big, expensive anchors** (sofa, bed, dining table, main rug) aren't changed *to accommodate* a smaller item.
  Small things follow big things.
- **Things the person chose explicitly** in this session (a user-picked item is treated as locked for ripple, unless
  they unlock it).
- **The hero**, unless the change *is* to the hero.
- **The personal nod** (the grandmother's butterfly print): it's exempt from color matching. Meaning beats
  palette.

## 4. Choosing the smallest good ripple

When rules propose more fixes than the person would want, rank and cap them.

1. **Generate candidates:** each violated rule proposes 1–3 fixes (swap item X for Y, recolor, add, remove).
2. **Filter:** drop fixes that touch locked items, exceed the remaining budget, or break another rule (re-check the
   whole state after each fix, since fixes interact).
3. **Score:** `score = coherenceGain / (cost + disruption)`. Disruption counts how big and visible the changed item is
   (a cushion ≪ a rug ≪ a sofa). Coherence gain is the number of rule violations fixed, weighted by importance
   (safety and clearance > color roles > texture).
4. **Cap at about 3 changes per ripple** (5 for a style change). Prefer: accessories (cushions, throws, vases,
   art) → lighting → small furniture → textiles (rugs, curtains) → large furniture.
5. **Explain each one** in a line of trade language with its reason (craft-standards: "a fact and the decision it
   drives"):
   - "Cobalt cushion on the sofa's far end: repeats the chair's cobalt across the room (rule of three)."
   - "Rust throw → oat throw: two strong accents were competing; rust had one other carrier."
   - "Keep the brass lamp: brass warms the cobalt."

```jsonc
// A ripple proposal the UI can render as a preview
{
  "trigger": { "item": "armchair-1", "change": "color", "from": "#B8704E", "to": "#24427A" },
  "mode": "ripple",
  "proposals": [
    { "action": "swap", "item": "cushion-3", "to": "prod_123", "why": "Repeats cobalt across the room (rule of three)", "cost": 48 },
    { "action": "add", "item": "vase-blue", "to": "prod_456", "where": "shelf-2", "why": "Third cobalt note, at eye level", "cost": 35 },
    { "action": "swap", "item": "throw-rust", "to": "prod_789", "why": "Retires a competing accent with one carrier left", "cost": 60 }
  ],
  "kept_on_purpose": [
    { "item": "lamp-brass", "why": "Brass warms the cobalt; classic pairing" },
    { "item": "sofa", "why": "Large anchors don't follow small changes" }
  ],
  "warnings": [],
  "total_cost": 143
}
```

In **keep** mode, the same analysis runs, but only `warnings` and `kept_on_purpose` are returned, e.g.
"Cobalt appears once; it'll read as a one-off. Turn on ripple to echo it."

## 5. Ripple vs. keep in the product

- **The toggle default** follows the persona: delegators ("show me a finished idea") and quick-refresh users →
  ripple on; collaborators and gatherers ("be part of every choice", lots of locked pieces) → keep on, with warnings.
- **The preview** shows the room *with* the ripple, the changed items highlighted, and a one-line reason each.
  Accept all, accept some, or undo.
- **Cost always shows:** "+$143 across 3 small pieces."
- **Never ripple silently.** Even in ripple mode, proposals need a tap, because the person's sense of authorship
  matters more than the coherence score.

## 6. Who does what: code vs model

- **Code** (deterministic): maintain `DesignState`; detect violated rules after each edit; compute ΔE, undertone,
  LRV, visual weight and clearances; filter by locks and budget; look up Wada combinations; cap the count.
- **The model** (judgement): choose *which* echo is beautiful (patterned cushion vs a ceramic), find matching real
  products, decide when to break a rule on purpose (a single red chair in a monochrome room *is* the point), and
  write the reasons. The model receives the violated rules and candidate fixes as structured input and returns a
  ripple proposal in the JSON shape above. Code re-validates it before showing it.

Breaking a rule deliberately is allowed and is what taste looks like, but the model must **name the rule it's
breaking and why** ("one red chair, unrepeated: it's the hero"), and code accepts it only if it's the hero or the
personal nod.

## Sources

The repetition and rule-of-three practice is from `color.md` and `space.md`:
- [Resene: The rule of three](https://www.resene.co.nz/homeown/colour-inspiration/61-rule-of-three.htm)
- [Havenly: Rhythm and repetition](https://havenly.com/blog/rhythm-and-repetition)
- [Coohom: Strengthening visual unity in a room](https://www.coohom.com/article/how-to-strengthen-visual-unity-in-a-room-without-making-it-boring)
- [The accent colour mistake in almost every room](https://rlowell.kit.com/posts/the-accent-colour-mistake-i-see-in-almost-every-room)

The ripple model itself (roles, carriers, ranking, the keep/ripple modes) is Homebody's own design, built on those
principles. No published system was found to copy.
