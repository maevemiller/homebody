# Interior design reference

Last updated: 2026-10-27.

Research behind Homebody's **Taste Builder**: how great interior designers run a client intake, what they ask and
show, the style and material vocabularies, how to learn taste from images, and how designers present a client's
profile back. It answers Maeve's direction from 2026-10-27 (see the last section of `docs/product-vision.md`) and
should inform the next version of `docs/taste-builder.md` and `lib/taste/questions.ts`.

## Index

| File | What's in it |
|---|---|
| [intake-process.md](intake-process.md) | The shape and order of a professional intake; how Havenly, Modsy, Laurel & Wolf, Decorist and designer questionnaires do it; how designers read clients; the design brief; budget and timeline talk; pitfalls |
| [question-bank.md](question-bank.md) | The questions designers ask, by section (opening, function and life, aesthetics, personal story, practical, closing), with branching follow-ups, what each reveals, and asked vs shown |
| [style-families.md](style-families.md) | 19 style families (plus Copenhagen, contemporary, nautical and coastal-grandmother variants): traits, how people describe them, common confusions, and a four-slot image set for each |
| [palettes-materials-patterns.md](palettes-materials-patterns.md) | Palette families as hex swatches, woods, stone, metals, textiles and patterns, plus non-color this-or-that pairs; all renderable as UI choices |
| [learning-taste-from-images.md](learning-taste-from-images.md) | Quiz formats and their signal, how many choices, fatigue, Pinterest in intakes, and a scoring model that turns picks into a style mix, palette and material profile |
| [dossier.md](dossier.md) | What a designer's client profile contains, how designers present it back, and a design for the live, hand-drawn dossier |
| [craft-standards.md](craft-standards.md) | Clearances, lighting layers and color temperature, durability and sheen, 60-30-10 roles, lead times, and how a note or brief line is written (no stock filler) |

## The 10 most important takeaways for Homebody's intake

1. **Never ask "what's your style?"** Designers (Bobby Berk, and most practice writing) avoid style labels because
   people lack the vocabulary or mean different things by it. Ask how the room should *feel*, show images, and
   **name the style back to them** afterwards ("designers call this warm minimalism").

2. **Run it as a conversation in a designer's order:** why now and what isn't working → function and daily life →
   feeling and aesthetics → personal story → practical constraints → "what would make you say *this is it*?" →
   a read-back. That matches Maeve's three sections and adds a warm opening and close.

3. **The best first questions are "What made you want to do this now?" and "What isn't working?"** The trigger and
   the pain are more actionable than any preference, and they set the emotional stakes.

4. **Function decides the furniture list before style does.** "Walk me through a normal day in this room" is the
   single richest function question; it surfaces needs no checklist catches.

5. **Dislikes are as valuable as likes.** Every successful service asks for rooms you'd "never live in" and things
   you never want to see. Offer "never" alongside every visual choice.

6. **After any image pick, ask "what is it about this one?"** with tappable attribute chips (the wood, the light,
   the color, the clutter). Designers report clients loving a room only for its tile; this stops over-reading.

7. **Look for the thread across many reactions, not one hero image.** Turn picks into a **named blend with a mix**
   (e.g. "60% warm minimal, 30% mid-century, a thread of Indian textiles"), plus a 60-30-10 palette, 2–3 woods,
   metals and textiles, pattern appetite and hard nos. Modsy's "Rustic Warmth" and Stitch Fix's percentages show
   blends feel more personal than one label.

8. **Keep the visual section to about 10 interactions, and the "I'm not sure" path to 6–12 adaptive this-or-that
   pairs.** Completion drops past ~10 questions or ~7–8 minutes. Pairwise choices are easier and more reliable than
   ratings, but only if each pair is chosen to split the current top candidates (see the confusion table in
   `style-families.md`). Offer "both" and "neither"; stop early when it's clear.

9. **Personal story turns a catalog room into their room, but use it lightly.** Ask about places that felt like
   home and meaningful objects after rapport; turn each place into buyable specifics (Copenhagen → candles, paper
   lamps, mismatched chairs; India → block print, brass, cane, a jaali panel). One quiet nod, never a theme;
   heritage is a layer on a base style, not a costume.

10. **End with "here's what I heard", drawn, explained and correctable.** Designers close discovery with a short
    summary and then a concept (a few mood words, a concept statement, a restrained board) with the reasoning
    shown. The live dossier is this, built stroke by stroke: inferred things in pencil, confirmed things in ink,
    small "because" arrows, the person's own words quoted, and corrections visibly crossed out.

### Also worth carrying into the build
- Ask budget as a **range, framed as a design input**, after rapport, with "is there give?" and "what would you
  splurge on?". Ask timeline as **a date that matters** (guests, a move-in), not "how fast".
- Ask **"Is anyone else deciding with you?"**; couples often think they agree and don't. Let a partner react
  separately.
- Ask **collaborator or delegator** ("be part of every choice, or see a finished idea?"); it sets how many options
  to show later.
- Respond to signals the way a designer does: long answers, stories, strong words and contradictions mean *dig
  here*; "I don't know" means *switch to images*; a short dismissive answer means *move on*.

## Source quality note

Most sources are designer blogs, trade press (Business of Home, Designers Today), and the services' own pages and
reviews. Modsy (closed 2022) and Laurel & Wolf (closed 2020) are documented through archived reviews, and
Decorist's current quiz couldn't be verified directly. No published standard exists for "the right number of style
quiz questions"; the recommendations here combine survey drop-off benchmarks with preference-elicitation research.
Treat specifics as informed practice, and validate with our own funnel data.

## Sources

The main sources across all files (each file lists its own):
- [Havenly: What to expect from a Havenly design session](https://havenly.com/learn/what-to-expect-havenly-session)
- [Hunker: Modsy review](https://www.hunker.com/13723769/modsy-bedroom-design-review/)
- [Designers Today: Rethinking the intake process](https://www.designerstoday.com/designers/rethinking-the-intake-process-in-interior-design/)
- [Design Files: Discovery call questions](https://blog.designfiles.co/interior-design-discovery-call-questions/)
- [101: Interior design client brief template](https://101-app.com/en/blog/interior-design-client-brief-template)
- [Business of Home: 6 designers on inspiration images](https://businessofhome.com/articles/6-designers-on-how-they-make-the-most-of-inspiration-images)
- [Homes & Gardens: Bobby Berk on the one question never to ask](https://homesandgardens.com/interior-design/bobby-berk-says-this-is-the-one-question-you-should-never-ask-about-interior-design)
- [DesignDash: When a couple can't agree](https://designdash.com/integration/business/what-do-i-do-if-a-couple-cant-agree-on-a-design-direction/)
- [Princeton Info: Toby Israel, from memories, your next house](https://princetoninfo.com/coverstories/from-memories-your-next-house/)
- [Survicate: Survey completion rate](https://survicate.com/blog/survey-completion-rate/)
- [A practical guide to analysing pairwise comparison experiments](https://arxiv.org/pdf/1712.03686v1)
- [Studio Matrx: Indo-contemporary interiors](https://www.studiomatrx.org/guides/indo-contemporary-interiors-india)
- [Bed Threads: Copenhagen interior style](https://bedthreads.com.au/blogs/journal/copenhagen-interior-style-tips)
