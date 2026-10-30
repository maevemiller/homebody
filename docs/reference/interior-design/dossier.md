# The client dossier

Last updated: 2026-10-27. Part of the Homebody interior-design reference (see `README.md`).

What a designer's client profile or brief contains, and how designers present it back. This feeds Homebody's
**live dossier**: a hand-drawn-feeling graphic that builds itself as the person talks, like a whiteboard "day in my
life" video, replacing a plain list of answers.

---

## 1. What a designer's client profile contains

Pulled together from brief templates (101 Studio, Milanote, Bonsai, paid designer toolkits) and the e-design
deliverables (Havenly, Modsy, Laurel & Wolf).

| Section | Contents | Homebody source |
|---|---|---|
| **Who** | Names, household (adults, kids and ages, pets), visitors, decision-makers | function questions |
| **Why now** | The trigger and the problem to solve | opening |
| **The room's jobs** | Ordinary-day uses and occasional scenarios; a day in the room | function questions |
| **The feeling** | 2–3 mood words for residents, sometimes one for guests | aesthetics |
| **Style direction** | A named blend with a mix ("warm minimal, with mid-century warmth") | image reactions |
| **Palette** | 5–6 colors in 60-30-10 order | palette picks + image extraction |
| **Materials** | Woods, metals, textiles, stone | swatch picks, keepers |
| **Pattern** | Appetite and favorite type | pattern picks |
| **Must-haves** | Keepers, the anchor piece, needs (storage, a desk that disappears) | Space Capture + function |
| **Never** | Hard nos | aesthetics |
| **Story** | Places that feel like home; heritage; the meaningful detail to nod to | personal story |
| **Practical** | Budget range and flexibility, splurge item, date that matters, rent/own, phasing, trade-off order | constraints |
| **Working style** | Collaborator or delegator; how many options they want | constraints |
| **Success** | "What would make you say 'this is it'" | closing |

## 2. How designers present it back

Designers rarely hand clients the raw brief. They turn it into a **concept**, presented in this order:

1. **"Here's what I heard."** A short spoken or written summary. 101 Studio suggests closing the first meeting with
   five parts: style, goals, must-haves, exclusions, dates and next step, confirmed in writing as one shared
   document.
2. **The concept statement.** A few sentences: the vision, where it came from, how it meets the client's needs. It
   is the guiding idea, not a theme. Designers often start from **a few adjectives** that set the mood, then let
   those words choose color, material and furniture.
3. **The mood (concept) board.** One or two hero images that set the emotional target, a restrained palette,
   key material swatches, furniture categories, lighting cues. Clients mostly judge the overall mood, the material
   direction, and how risky it feels.
4. **The reasoning.** Havenly includes designer notes explaining each choice; Modsy annotated layouts. Clients trust
   what's explained.
5. **Then the specifics:** floor plan, renders, shopping list.

What makes it land: it uses the client's own words, it is visual first, it names the style for them, and it invites
correction.

## 3. Designing Homebody's live dossier

### 3.1 The metaphor
A designer's sketchbook page about one person, drawn as they talk. Hand-drawn lines, handwritten labels, swatches
"taped" on, small ink illustrations of the room's jobs. It should feel like a thoughtful person is listening and
taking notes, not like a form saving.

### 3.2 Layout: zones that fill in section by section

```
 ┌─────────────────────────────────────────────────────────┐
 │  [Name]'s living room          "calm, warm, gathered"    │  ← title + mood words (handwritten)
 ├──────────────────────┬──────────────────────────────────┤
 │  A DAY IN THE ROOM   │  THE LOOK                        │
 │  - coffee by window  │  warm minimal  ████████ 60%      │
 │  - desk till 6       │  mid-century   ████ 30%          │
 │  - reading lamp      │  Indian thread ██ 10%            │
 │  - friends, sofa     │  [palette strip, taped on]       │
 │  (each line gets a  │  [wood chip][brass dot][linen]   │
 │   small drawn icon)  │  pattern: a little · block print │
 ├──────────────────────┼──────────────────────────────────┤
 │  WHO'S HERE          │  THE STORY                       │
 │  2 adults · 1 cat    │  Grew up in Pune; lived in       │
 │  (cat on sofa → no   │  Copenhagen. → brass + candles,  │
 │   velvet)            │  block-print, paper lamps        │
 │                      │  Nod: grandmother's brass lamp   │
 ├──────────────────────┴──────────────────────────────────┤
 │  KEEPING: walnut console (anchor)   NEVER: glossy white   │
 │  BUDGET: middle, splurge on sofa   BY: Dec 15 (guests)   │
 └─────────────────────────────────────────────────────────┘
```

Sections fill in the order of the conversation: who and the day (function) → the look → the story → the practical
strip. Empty zones show as faint pencil outlines, so people see what's coming without a question list.

### 3.3 Drawing behaviors
- **Each answer draws one thing.** A pet answer sketches a small cat; "dinner around a table" sketches a table; a
  palette pick tapes a swatch strip on. Stroke-by-stroke animation, ~400–900 ms, never blocking input.
- **Show the reasoning as arrows.** Designers' sketches connect cause and effect: "cat on sofa → performance
  fabric". These little arrows make the assistant feel thoughtful and are the user-facing version of the
  `because` reasons in `docs/taste-builder.md`.
- **Confidence as line weight.** Inferred things (from the scan or a single pick) are drawn lighter, in pencil, with
  a "?"; confirmed things are inked. Tapping a pencil item asks to confirm.
- **Their words, quoted.** Handwritten quotes ("I want it to feel like my grandmother's veranda") are the most
  personal element. Use one or two, not every answer.
- **Corrections are visible.** Crossing out and rewriting (rather than silent replacement) shows it listened.
- **The style mix grows.** Bars or a pie redraw as picks come in; the named blend appears only once confident.
- **Ends as a concept page.** When the conversation closes, the sketch tidies into a presentable one-page concept:
  title, three mood words, concept statement, palette, materials, hero image, story nod, practical strip. This is
  the "here's what I heard" moment, with "Did I get this right?" and edit affordances.

### 3.4 The concept statement template
Write it the way a designer would, in the client's words where possible:

> A **[mood word], [mood word]** living room for **[who]** that works as **[main jobs]**. It starts from
> **[anchor piece]** and **[style blend]**: **[2–3 materials]** in a **[palette]** palette, with **[pattern
> appetite]**. A quiet nod to **[story]** through **[one specific thing]**. Nothing **[hard no]**.

Example: *A calm, warm living room for two and a cat, for working by day and friends on the sofa at night. It starts
from the walnut console and leans warm minimal with mid-century warmth: oak, linen and brass in oat, clay and olive,
with a little block print. A quiet nod to Pune through a brass lamp like your grandmother's. Nothing glossy.*

### 3.5 What to leave out
- Raw question-and-answer pairs.
- Numbers people didn't give (no invented budgets or percentages without picks behind them).
- Sensitive details in large type (health, finances, family situations). Keep them in the brief, out of the drawing.
- Themes. A meaningful detail appears once, small.

---

## Sources

- [101: Interior design client brief template (closing summary, shared document)](https://101-app.com/en/blog/interior-design-client-brief-template)
- [Milanote: Interior design brief template](https://milanote.com/templates/interior-design-brief-template)
- [Bonsai: Interior design brief template](https://hellobonsai.com/a/interior-design-brief-example)
- [Havenly: What to expect from a design session (concept board, designer notes)](https://havenly.com/learn/what-to-expect-havenly-session)
- [Hunker: Modsy review (style results, designer notes)](https://www.hunker.com/13723769/modsy-bedroom-design-review/)
- [Digital Trends: Laurel & Wolf (First Looks, final style boards)](https://qa2.www.digitaltrends.com/home/laurel-and-wolf-digital-interior-design)
- [I For Style: The design process, concept](https://iforstyle.com.au/the-design-process-concept/)
- [Cindrebay: Mood boards and color schemes in interior design concepts](https://blog.cindrebay.com/of-mood-boards-and-color-schemes-creating-interior-design-concepts/)
- [ArchitectGPT: From mood board to render, aligning clients in one meeting](https://www.architectgpt.io/blog/mood-board-to-finished-render-aligning-clients-in-one-meeting)
- [Design Files: Moodboard layouts for interior designers](https://blog.designfiles.co/moodboard-layouts/)
- [Wix: How to make a mood board (start from adjectives)](https://www.wix.com/wixel/resources/how-to-make-a-mood-board)
- [Payhip: Designer's toolkit client profile template (listing)](https://payhip.com/designerstoolkitbycedarhouse)
